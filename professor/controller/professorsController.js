const { default: mongoose } = require('mongoose')
const Professor = require('../model/Professor')
const { professorEditJoi, professorRegisterJoi, loginJoi } = require('../schema/professorJoi')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { client } = require('../redis/RedisClient')
const { REQ_CHANNEL, RPLY_CHANNEL } = require('../redis/SubjectChannel')
const { request } = require('../redis/requestReply')
const { SUBJECT_ERROR, PROFESSOR_ERROR, MONGO_ERROR } = require('../utils/ErrorNames')
const AppError = require('../utils/AppError')

module.exports.register = async (req, res, next) => {
    try {

        const { email, name, password, subjectCode } = await professorRegisterJoi.validateAsync(req.body, { abortEarly: false })

        const config = { REQ_CHANNEL, RPLY_CHANNEL }
        const payload = { subjectCode }

        const [subject] = await request(config, payload)

        if (subject) {

            const hashedPassword = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS))

            const professor = new Professor({ email, name, password: hashedPassword, subject: subject._id })

            await professor.save()

            res.status(201).json({
                message: 'ok'
            })

        } else {

            throw new AppError(SUBJECT_ERROR, `No Subject found for ${subjectCode}`, 404)

        }

    } catch (error) {

        next(error)

    }
}

module.exports.login = async (req, res, next) => {
    try {
        const { email, password } = await loginJoi.validateAsync(req.body, { abortEarly: false })

        const savedProfessor = await Professor.findOne({ email })

        if (savedProfessor === null) {

            throw new AppError(PROFESSOR_ERROR, `professor with email ${email} not found`, 404)

        } else {

            if (await bcrypt.compare(password, savedProfessor.password)) {

                const { JWT_SECRET, JWT_EXPIRY } = process.env
                const payload = { _id: savedProfessor._id }
                const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY })

                const expire1Day = 24 * 60 * 60

                await client.set(`ProfessorToken:${savedProfessor._id}`, token, { EX: expire1Day })

                res.status(201).json({ token })

            }
            else {

                throw new AppError(PROFESSOR_ERROR, 'Wrong password', 401)

            }
        }
    }
    catch (error) {

        next(error)

    }
}

module.exports.logout = async (req, res, next) => {
    try {
        const id = req.id

        await client.del(`ProfessorToken:${id}`)

        res.status(200).json({
            message: 'ok'
        })
    } catch (error) {

        next(error)

    }
}

module.exports.remove = async (req, res, next) => {
    try {
        const { id } = req.params

        if (mongoose.isValidObjectId(id)) {

            if (id !== req.adminId) {

                const deletedProfessor = await Professor.findByIdAndDelete(id)

                if (deletedProfessor === null) {

                    throw new AppError(PROFESSOR_ERROR, `Professor with id ${id} not found.`, 404)

                } else {


                    await client.del(`ProfessorToken:${id}`)

                    res.status(200).json({
                        message: 'ok'
                    })

                }

            } else {

                throw new AppError(PROFESSOR_ERROR, 'Not allowed [Cannot delete admin]', 403)

            }

        } else {

            throw new AppError(MONGO_ERROR, 'Invalid ObjectId', 400)

        }

    } catch (error) {

        next(error)

    }
}

module.exports.info = async (req, res, next) => {
    try {

        const id = req.id

        const professor = await Professor.findOne({ _id: id })

        if (professor === null) {

            throw new AppError(PROFESSOR_ERROR, `Professor with id ${id} not found.`, 404)

        } else {

            res.status(200).json(professor)

        }

    } catch (error) {

        next(error)

    }
}

module.exports.allProfessors = async (req, res) => {
    try {

        const professors = await Professor.find()

        if (professors.length === 0) {

            throw new AppError(PROFESSOR_ERROR, `No professors found`, 404)

        } else {

            res.status(200).json(professors)

        }

    } catch (error) {

        next(error)

    }
}

module.exports.edit = async (req, res, next) => {
    try {
        const { id } = req.params
        const { email, name, password, subjectCode } = await professorEditJoi.validateAsync(req.body, { abortEarly: false })
        let hashedPassword, subject

        if (mongoose.isValidObjectId(id)) {

            if (id === req.adminId) {

                throw new AppError(PROFESSOR_ERROR, 'Not allowed [Cannot update admin]', 403)

            } else {

                if (password) {

                    hashedPassword = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS))

                }

                if (subjectCode) {

                    const config = { REQ_CHANNEL, RPLY_CHANNEL }
                    const payload = { subjectCode }

                    const [sub] = await request(config, payload)

                    if (sub) {

                        subject = sub

                    } else {

                        throw new AppError(SUBJECT_ERROR, `No Subject found for ${subjectCode}`, 404)

                    }

                }

                const updatedProfessor = await Professor.findByIdAndUpdate(id, { email, name, password: hashedPassword, subject: subject?._id }, { new: true, runValidators: true })

                if (updatedProfessor === null) {

                    throw new AppError(PROFESSOR_ERROR, `Professor with id ${id} not found.`, 404)

                } else {

                    res.status(200).json({
                        message: 'ok'
                    })

                }

            }

        } else {

            throw new AppError(MONGO_ERROR, 'Invalid ObjectId', 400)

        }

    } catch (error) {

        next(error)

    }
}
