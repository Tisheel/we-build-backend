const jwt = require('jsonwebtoken')
const { request } = require('../redis/requestReply')
const { REQ_CHANNEL, RPLY_CHANNEL } = require('../redis/ProfessorChannel')
const client = require('../redis/RedisClient')
const AppError = require('../utils/AppError')
const { JWT_ERROR } = require('../utils/ErrorNames')

const admin = async (req, res, next) => {
    try {
        const { token } = req.headers
        const { JWT_SECRET } = process.env

        if (token) {

            const { _id } = jwt.verify(token, JWT_SECRET)

            const config = { REQ_CHANNEL, RPLY_CHANNEL }
            const payload = { _id }

            const professor = await request(config, payload)

            if (professor) {

                if (professor.role === 'Admin') {

                    const professorCacheToken = await client.get(`professor:${_id}`)

                    if (professorCacheToken === token) {

                        req.adminId = _id
                        next()

                    } else {

                        throw new AppError(JWT_ERROR, `Permission Denied try logging again`, 403)

                    }

                } else {

                    throw new AppError(JWT_ERROR, `Permission Denied`, 403)

                }

            } else {

                throw new AppError(JWT_ERROR, `Permission Denied`, 403)

            }

        } else {

            throw new AppError(JWT_ERROR, `Unauthorized [TOKEN NOT FOUND]`, 401)

        }

    } catch (error) {

        next(error)

    }
}

module.exports = admin