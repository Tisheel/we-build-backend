const { default: mongoose } = require('mongoose')
const Student = require('../models/Student')
const { studentEditJoi, studentRegisterJoi, usnJoi, passwordJoi, studentLoginJoi } = require('../schema/studentJoi')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const sendMail = require('../utls/sendMail')
const forgot_password = require('../email templates/forgot_password')
const { client } = require('../redis/RedisClient')
const { request } = require('../redis/requestReply')
const { REQ_CHANNEL, RPLY_CHANNEL } = require('../redis/SubjectChannel')
const AppError = require('../utls/AppError')
const { SUBJECT_ERROR, STUDENT_ERROR } = require('../utls/ErrorNames')

module.exports.register = async (req, res, next) => {
    try {

        let subjects = []
        const { usn, email, phone, name, sem, branch, section, password, subjectCodes } = await studentRegisterJoi.validateAsync(req.body, { abortEarly: false })

        const newPhone = `+91 ${phone}`
        const hashedPassword = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS))

        const config = { REQ_CHANNEL, RPLY_CHANNEL }

        for (let subjectCode of subjectCodes) {

            const payload = { subjectCode }
            const [subject] = await request(config, payload)

            if (subject) {

                subjects.push(subject._id)

            } else {

                throw new AppError(SUBJECT_ERROR, `Subject ${subjectCode} not found`, 400)

            }
        }

        const student = new Student({ usn, email, phone: newPhone, name, sem, branch, section, password: hashedPassword, subjects })

        await student.save()

        res.status(201).json({ message: 'ok' })

    } catch (error) {

        next(error)

    }
}

module.exports.login = async (req, res, next) => {
    try {
        const { usn, password } = await studentLoginJoi.validateAsync(req.body)

        // check if student exsist
        const savedStudent = await Student.findOne({ usn })
        if (savedStudent === null) {

            throw new AppError(STUDENT_ERROR, `Student with USN ${usn} not found`, 404)

        } else {

            // check if password is correct
            if (await bcrypt.compare(password, savedStudent.password)) {

                // create a jwt token
                const { JWT_SECRET, JWT_EXPIRY } = process.env
                const payload = { _id: savedStudent._id }
                const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY })

                const expire1Day = 24 * 60 * 60

                // cache token
                await client.set(`StudentToken:${savedStudent._id}`, token, { EX: expire1Day })

                // sending token
                res.status(201).json({ token })
            } else {

                // wrong password
                throw new AppError(STUDENT_ERROR, 'Wrong password', 401)

            }
        }

    } catch (error) {

        next(error)

    }
}

module.exports.logout = async (req, res, next) => {
    try {
        const id = req.studentId

        // delete from cache
        await client.del(`StudentToken:${id}`)

        res.status(200).json({
            message: 'ok'
        })

    } catch (error) {

        next(error)

    }
}

module.exports.edit = async (req, res, next) => {
    try {
        const _id = req.studentId
        let subjects
        const { usn, email, phone, name, sem, branch, section, subjectCodes } = await studentEditJoi.validateAsync(req.body, { abortEarly: false })

        if (subjectCodes) {

            subjects = []
            const config = { REQ_CHANNEL, RPLY_CHANNEL }

            for (let subjectCode of subjectCodes) {

                const payload = { subjectCode }
                const [subject] = await request(config, payload)

                if (subject) {

                    subjects.push(subject._id)

                } else {

                    throw new AppError(SUBJECT_ERROR, `Subject ${subjectCode} not found`, 400)

                }
            }

        }

        const updatedStudent = await Student.findOneAndUpdate({ _id }, { usn, email, phone, name, sem, branch, section, subjects }, { new: true })

        if (updatedStudent === null) {

            throw new AppError(STUDENT_ERROR, `Student with id ${_id} not found`, 404)

        }

        const expire1Day = 24 * 60 * 60
        await client.set(`student:${_id}`, JSON.stringify(updatedStudent), { EX: expire1Day })

        res.status(200).json({
            message: 'ok'
        })
    } catch (error) {

        next(error)

    }
}

module.exports.remove = async (req, res, next) => {
    try {
        const _id = req.studentId

        const deletedStudent = await Student.findOneAndDelete({ _id })

        if (deletedStudent === null) {

            throw new AppError(STUDENT_ERROR, `Student with USN ${usn} not found`, 404)

        } else {

            // delete cache token
            await client.del(`StudentToken:${_id}`)

            // delete cache student
            await client.del(`student:${_id}`)

            res.status(200).json({
                message: 'ok'
            })

        }

    } catch (error) {

        next(error)

    }
}

module.exports.info = async (req, res, next) => {
    try {

        const _id = req.studentId

        const cacheStudent = JSON.parse(await client.get(`student:${_id}`))

        if (cacheStudent) {

            res.status(200).json(cacheStudent)

        } else {

            const student = await Student.findOne({ _id })

            if (student === null) {

                throw new AppError(STUDENT_ERROR, `Student with USN ${usn} not found`, 404)

            } else {

                // cache student
                const expire1Day = 24 * 60 * 60
                await client.set(`student:${_id}`, JSON.stringify(student), { EX: expire1Day })

                res.status(200).json(student)
            }
        }
    } catch (error) {

        next(error)

    }
}

module.exports.students = async (req, res, next) => {
    try {

        const students = await Student.find()

        if (students.length === 0) {

            throw new AppError(STUDENT_ERROR, `Student with USN ${usn} not found`, 404)

        } else {

            res.status(200).json(students)

        }

    } catch (error) {

        next(error)

    }
}

module.exports.forgotPasswordRequest = async (req, res) => {
    try {
        const usn = await usnJoi.validateAsync(req.params.usn, { abortEarly: false })

        const student = await Student.findOne({ usn })

        // if student not found
        if (student === null) {
            return res.status(404).json({
                message: `Student with USN:${usn} not found.`
            })
        }

        const { HOST, PORT } = process.env

        // creating one time secure token
        const payload = { usn }
        const secret = process.env.JWT_SECRET + student.password

        const token = await jwt.sign(payload, secret, { expiresIn: '15m' })

        // one time link to change password
        const link = `${HOST}:${PORT}/api/v1/student/forgot-password/${usn}/${token}`

        // sending email with link to change password
        await sendMail({
            to: student.email,
            subject: 'Reset Your Password - We Builddd',
            text: forgot_password(student.name, link)
        })

        res.status(200).json({
            message: 'ok'
        })
    } catch (error) {
        // sending joi validation error messages
        const { details } = error
        if (details) {
            let errorArray = []
            for (errMsg of details) {
                errorArray.push(errMsg.message)
            }
            return res.status(400).json({
                message: errorArray
            })
        }

        // server error
        res.status(500).json({
            message: 'Somthing went wrong'
        })
        console.log(error)
    }
}

module.exports.forgotPassword = async (req, res) => {
    try {
        const token = req.params.token
        const password = await passwordJoi.validateAsync(req.body.password)
        const usn = await usnJoi.validateAsync(req.params.usn)
        const confirmPassword = req.body.confirmPassword

        const student = await Student.findOne({ usn })

        // if student not found
        if (student === null) {
            return res.status(404).json({
                message: `Student with USN:${usn} not found.`
            })
        }

        // if both passwords are same
        if (password === confirmPassword) {
            // verifying the token and put new hashed password into the database

            const secret = process.env.JWT_SECRET + student.password
            await jwt.verify(token, secret)

            const hashedPassword = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS))

            student.password = hashedPassword

            await student.save()

            res.status(200).json({
                message: 'ok'
            })
        } else {
            res.status(400).json({
                message: 'Password and Confirm Password are not same.'
            })
        }
    } catch (error) {
        // sending joi validation error messages
        const { details } = error
        if (details) {
            let errorArray = []
            for (errMsg of details) {
                errorArray.push(errMsg.message)
            }
            return res.status(400).json({
                message: errorArray
            })
        }

        // jwt errors
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(498).json({
                message: 'Token has expired'
            })
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(498).json({
                message: 'Invalid token or signature'
            })
        }

        // server error
        res.status(500).json({
            message: 'Somthing went wrong'
        })
        console.log(error)
    }
}