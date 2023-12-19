require('dotenv').config()
const express = require('express')
const connectToMongoDB = require('./config/MongoDB')
const { connectToClient } = require('./redis/RedisClient')
const bodyParser = require('body-parser')
const subjectRoute = require('./routes/subjectRoutes')
const errorHandler = require('./middleware/errorHandler')
const { connectPubSub } = require('./redis/requestReply')

const app = express()

const { HOST, PORT, MONGO_URL } = process.env

const startApp = async () => {
    // Middleware
    app.use(bodyParser.json())
    app.use(bodyParser.urlencoded({ extended: true }))


    // Connect to DB
    await connectToMongoDB(MONGO_URL, 'Subject')
    await connectToClient()
    await connectPubSub()

    // Routes
    app.use('/api/v1/subject', subjectRoute)

    // Error Middleware
    app.use(errorHandler)

    app.listen(PORT, () => {
        console.log(`Server running on PORT: ${PORT}`)
        console.log(`${HOST}:${PORT}`)
    })
}
startApp()