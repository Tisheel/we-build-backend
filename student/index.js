require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const connectToMongoDB = require('./config/MongoDB')
const studentRoute = require('./routes/studentRoute')
const { connectToClient } = require('./redis/RedisClient')
const errorHandler = require('./middleware/errorHandler')
const { connectPubSub } = require('./redis/requestReply')

const app = express()

const { MONGO_URL, PORT, HOST } = process.env

const startApp = async () => {
    // Middleware
    app.use(bodyParser.json())
    app.use(bodyParser.urlencoded({ extended: true }))

    // Connect To Databases
    await connectToMongoDB(MONGO_URL, 'Student')
    await connectToClient()
    await connectPubSub()

    // Routes
    app.use('/api/v1/student', studentRoute)

    // error handler
    app.use(errorHandler)

    app.listen(PORT, () => {
        console.log(`Server running on PORT: ${PORT}`)
        console.log(`${HOST}:${PORT}`)
    })
}
startApp()