const QuestionBank = require('../models/QuestionBank')
const { QuestionAddJoi, QuestionEditJoi } = require('../schema/QuestionBankJoi')
const { default: mongoose } = require('mongoose')
const AppError = require('../utils/AppError')
const { QUESTIONBANK_ERROR, MONGO_ERROR } = require('../utils/ErrorNames')
const { client } = require('../redis/RedisClient')

module.exports.addQuestion = async (req, res, next) => {
    try {
        const { subject } = req.professor
        const { module, question, options, answer, level, value } = await QuestionAddJoi.validateAsync(req.body, { abortEarly: false })

        const Question = new QuestionBank({ subject, module, question, options, answer, level, value })

        await Question.save()

        res.status(200).json({
            message: "ok"
        })

    } catch (error) {

        next(error)

    }
}

module.exports.editQuestion = async (req, res, next) => {
    try {

        const { id } = req.params

        if (mongoose.isValidObjectId(id)) {

            const { module, question, options, answer, level, value } = await QuestionEditJoi.validateAsync(req.body, { abortEarly: false })

            const updatedQuestion = await QuestionBank.findByIdAndUpdate(id, { module, question, options, answer, level, value }, { new: true })

            if (updatedQuestion === null) {

                throw new AppError(QUESTIONBANK_ERROR, `Question with id ${id} not found`, 404)

            } else {

                res.status(200).json({
                    message: "ok"
                })

            }

        } else {

            throw new AppError(MONGO_ERROR, 'Invalid ObjectId', 400)

        }

    }
    catch (error) {

        next(error)

    }
}

module.exports.deleteQuestion = async (req, res, next) => {
    try {

        const { id } = req.params

        if (mongoose.isValidObjectId(id)) {

            const deletedQuestion = await QuestionBank.findByIdAndDelete(id)

            if (deletedQuestion === null) {

                throw new AppError(QUESTIONBANK_ERROR, `Question with id ${id} not found`, 404)

            } else {

                res.status(200).json({
                    message: "ok"
                })

            }

        } else {

            throw new AppError(MONGO_ERROR, 'Invalid ObjectId', 400)

        }

    } catch (error) {

        next(error)

    }
}

module.exports.getQuestions = async (req, res, next) => {
    try {

        const filter = req.body

        const questions = await QuestionBank.find(filter)

        if (questions.length === 0) {

            throw new AppError(QUESTIONBANK_ERROR, `No questions for parameters found`, 404)

        } else {

            res.status(200).json(questions)

        }

    }
    catch (error) {

        next(error)

    }
}

module.exports.getQuestion = async (req, res, next) => {
    try {

        const questionId = req.params.id

        if (mongoose.isValidObjectId(questionId)) {

            const catchedQuestion = await JSON.parse(client.get(`Questiion:${questionId}`))

            if (catchedQuestion) {

                const { answer, ...safeQuestion } = catchedQuestion
                res.status(200).json(safeQuestion)

            } else {

                const { _doc: question, ...rest } = await QuestionBank.findOne({ _id: questionId })

                if (question) {

                    const { answer, ...safeQuestion } = question
                    res.status(200).json(safeQuestion)

                } else {

                    throw new AppError(QUESTIONBANK_ERROR, `No question found for id ${questionId}`, 404)

                }

            }

        } else {

            throw new AppError(QUESTIONBANK_ERROR, 'Inavlid ObjectId', 400)

        }

    } catch (error) {

        next(error)

    }
}

module.exports.addManyQuestions = async (req, res, next) => {
    try {



    } catch (error) {

        next(error)

    }
}