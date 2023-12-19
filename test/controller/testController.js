const Test = require('../models/Test')
const Answer = require('../models/Answer')
const { request } = require('../redis/requestReply')
const { REQ_CHANNEL, RPLY_CHANNEL } = require('../redis/QuestionBankChannel')
const { createTestMannualJoi, createTestAutoJoi, finishTestJoi } = require('../schema/testJoi')
const AppError = require('../utils/AppError')
const { QUESTIONBANK_ERROR, TEST_ERROR, JWT_ERROR } = require('../utils/ErrorNames')
const { client } = require('../redis/RedisClient')
const { default: mongoose } = require('mongoose')
const { MONGO_ERROR } = require('../utils/ErrorNames')
const jwt = require('jsonwebtoken')

module.exports.createTestMannual = async (req, res, next) => {
    try {

        const professorId = req.professor._id
        const subjectId = req.professor.subject

        let questions = []

        const { title, startTime, endTime, questionIds } = await createTestMannualJoi.validateAsync(req.body, { abortEarly: false })

        const currentTime = new Date().getTime()
        const testStartTime = new Date(startTime).getTime()
        const testEndTime = new Date(endTime).getTime()

        // const TEST_BUFFER = 15 * 60 * 1000 // 30 min buffer
        // const MINIMUM_TEST_DURATION = 15 * 60 * 1000 // 15 min

        // if (testStartTime <= (currentTime + TEST_BUFFER)) {
        //     throw new AppError(TEST_ERROR, `Cannot schedule test at ${startTime}.`, 400)
        // }

        // if ((testEndTime - testStartTime) <= MINIMUM_TEST_DURATION) {
        //     throw new AppError(TEST_ERROR, `Test duration should be minimum 15 min current test duration ${(testEndTime - testStartTime) / 60000} min`, 400)
        // }

        const config = { REQ_CHANNEL, RPLY_CHANNEL }

        for (let questionId of questionIds) {

            const payload = { _id: questionId, subject: subjectId }

            const [question] = await request(config, payload)

            if (question) {

                const { answer, ...saveQuestion } = question

                questions.push(saveQuestion)

            } else {

                throw new AppError(QUESTIONBANK_ERROR, `Question with id ${questionId} not found`, 404)

            }

        }

        const passKey = Math.floor(100000 + Math.random() * 900000)

        const newTest = await Test({ title, professor: professorId, subject: subjectId, startTime, endTime, questions, passKey })

        await newTest.save()

        res.status(200).json(newTest)

    } catch (error) {

        next(error)

    }
}

module.exports.createTestAuto = async (req, res, next) => {
    try {
        const professorId = req.professor._id
        const subjectId = req.professor.subject

        const { startTime, endTime, modules, numberOfQuestions } = await createTestAutoJoi.validateAsync(req.body, { abortEarly: false })

        const config = { REQ_CHANNEL, RPLY_CHANNEL }
        const payload = { subject: subjectId, module: modules }

        const questions = await request(config, payload)

        if (Array.isArray(questions) === true && questions.length !== 0) {

            if (questions.length >= numberOfQuestions) {

                const numberOfEasyQuestions = numberOfQuestions * 0.50
                const numberOfMediumQuestions = numberOfQuestions * 0.30
                const numberOfHardQuestions = numberOfQuestions * 0.20

                const easyQuestions = questions.filter((question) => question.level === 1).sort(() => Math.random() - 0.5)
                const mediumQuestions = questions.filter((question) => question.level === 2).sort(() => Math.random() - 0.5)
                const hardQuestions = questions.filter((question) => question.level === 3).sort(() => Math.random() - 0.5)

                if (easyQuestions.length > numberOfEasyQuestions && mediumQuestions.length > numberOfMediumQuestions && hardQuestions.length > numberOfHardQuestions) {

                    const questions = []

                    questions.push(...easyQuestions.slice(0, numberOfEasyQuestions))
                    questions.push(...mediumQuestions.slice(0, numberOfMediumQuestions))
                    questions.push(...hardQuestions.slice(0, numberOfHardQuestions))

                    const passKey = Math.floor(100000 + Math.random() * 900000)

                    const newTest = await Test({ professor: professorId, subject: subjectId, startTime, endTime, questions, passKey })

                    await newTest.save()

                    res.json(newTest)

                } else {

                    throw new AppError(TEST_ERROR, `Insufficient Questions to create test in ratio 50:30:20`, 400)

                }
            } else {

                throw new AppError(TEST_ERROR, `Questions from ${subjectId} modules ${modules} not sufficient to create test of ${numberOfQuestions} questions`, 400)

            }
        } else {

            throw new AppError(TEST_ERROR, 'Cannot create test somthing went wrong', 400)

        }

    } catch (error) {

        next(error)

    }
}

module.exports.startTest = async (req, res, next) => {
    try {

        const student = req.student
        const { testId } = req.params
        const { passKey } = req.body

        if (mongoose.isValidObjectId(testId)) {

            let test = JSON.parse(await client.get(`test:${testId}`))

            if (!test) {

                test = await Test.findOne({ _id: testId })

                if (test === null) {

                    throw new AppError(TEST_ERROR, `No test found for ${testId}`, 404)

                } else {

                    const expire1Min = 1 * 60
                    client.set(`test:${testId}`, JSON.stringify(test), { EX: expire1Min })

                }

            }

            const currentTime = new Date().getTime()
            const startTime = new Date(test.startTime).getTime()
            const endTime = new Date(test.endTime).getTime()

            if (currentTime >= startTime && currentTime <= endTime) {

                if (passKey === test.passKey) {

                    const token = await client.get(`AnswerToken:${test._id}:${student._id}`)

                    if (token) {

                        res.status(200).json({ token, test })

                    } else {

                        const newAnswer = await Answer({ student: student._id, test: test._id })
                        await newAnswer.save()

                        const EXPIRY_BUFFER = 60 * 1000

                        const { JWT_SECRET } = process.env
                        const EXPIRY = (endTime - currentTime) + EXPIRY_BUFFER
                        const payload = { answer: newAnswer._id }
                        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: parseInt(EXPIRY / 1000) })

                        await client.set(`AnswerToken:${test._id}:${student._id}`, token, { PX: EXPIRY })

                        res.status(200).json({ token, test })

                    }

                } else {

                    throw new AppError(TEST_ERROR, 'Wrong pass key', 403)

                }

            } else {

                throw new AppError(TEST_ERROR, `Test can only be accessed between ${test.startTime} - ${test.endTime}`, 400)

            }

        } else {

            throw new AppError(MONGO_ERROR, 'Invalid ObjectId', 400)

        }

    } catch (error) {

        next(error)

    }
}

module.exports.finishTest = async (req, res, next) => {
    try {

        const { token } = req.headers
        const { JWT_SECRET } = process.env
        const { questions } = await finishTestJoi.validateAsync(req.body, { abortEarly: false })
        let score = 0, maxMarks = 0

        if (token) {

            const { answer } = jwt.verify(token, JWT_SECRET)

            for (let prop of questions) {

                const question = JSON.parse(await client.get(`Question:${prop.question._id}`))

                if (question) {

                    if (JSON.stringify(question.answer) === JSON.stringify(prop.answer)) {

                        score = score + question.value

                    }
                    maxMarks = maxMarks + question.value

                } else {

                    const config = { REQ_CHANNEL, RPLY_CHANNEL }
                    const payload = { _id: prop.question._id }

                    const [question] = await request(config, payload)

                    if (question) {

                        if (JSON.stringify(question.answer) === JSON.stringify(prop.answer)) {

                            score = score + question.value

                        }
                        maxMarks = maxMarks + question.value

                    } else {

                        throw new AppError(QUESTIONBANK_ERROR, `Question with id ${prop.question._id} not found`, 404)

                    }

                }

            }

            const updatedAnswer = await Answer.findByIdAndUpdate(answer, { $set: { questions, result: { maxMarks, score } } }, { new: true })

            res.status(200).json({
                result: updatedAnswer.result
            })

        } else {

            throw new AppError(JWT_ERROR, `Unauthorized [TOKEN NOT FOUND]`, 401)

        }

    } catch (error) {

        next(error)

    }
}

module.exports.testDetail = async (req, res, next) => {
    try {

        const { testId } = req.params

        if (mongoose.isValidObjectId(testId)) {

            const test = await Test.findOne({ _id: testId })

            if (test) {

                res.status(200).json(test)

            } else {

                throw new AppError(TEST_ERROR, `No test found for ${testId}`, 404)

            }

        } else {

            throw new AppError(MONGO_ERROR, 'Invalid ObjectId', 400)

        }

    } catch (error) {

        next(error)

    }
}