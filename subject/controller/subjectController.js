const Subject = require('../model/Subject')
const { client } = require('../redis/RedisClient')
const { default: mongoose } = require('mongoose')
const AppError = require('../utils/AppError')
const { SUBJECT_ERROR } = require('../utils/ErrorNames')

module.exports.subject = async (req, res, next) => {
    try {
        const { id } = req.params

        const subjectCache = JSON.parse(await client.get(`subject:${id}`))

        if (subjectCache === null) {

            const subject = await Subject.findOne({ _id: id })

            if (subject === null) {

                throw new AppError(SUBJECT_ERROR, `No subject found for ${id}`, 404)

            } else {

                const expire1Day = 24 * 60 * 60
                await client.set(`subject:${subject._id}`, JSON.stringify(subject), { EX: expire1Day })
                res.status(200).json(subject)

            }
        } else {

            res.status(200).json(subjectCache)
        }

    } catch (error) {

        next(error)

    }
}

module.exports.filterSubjects = async (req, res, next) => {
    try {
        
        const subjects = await Subject.find(req.body)

        if (subjects.length === 0) {

            throw new AppError(SUBJECT_ERROR, 'No subjects found', 404)

        } else {

            res.status(200).json(subjects)

        }

    } catch (error) {

        next(error)

    }
}

module.exports.addSubject = async (req, res, next) => {
    try {
        const { subjectName, subjectCode } = req.body

        const subject = await Subject({ subjectName, subjectCode })
        await subject.save()

        res.status(200).json({
            message: 'ok'
        })

    } catch (error) {

        next(error)

    }
}
