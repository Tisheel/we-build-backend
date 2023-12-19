require('dotenv').config();
const express = require('express')
const bodyParser = require('body-parser')
const ConnectToMongoDB = require('./config/MongoDB')
const QuestionBankRoute = require('./Routes/QuestionBankRoutes')
const errorHandler = require('./middlewares/errorHandler');
const { connectToClient } = require('./redis/RedisClient');
const { connectPubSub } = require('./redis/requestReply');

const app = express()

const { PORT, MONGO_URL } = process.env

const startApp = async () => {
    //middleware
    app.use(bodyParser.json())
    app.use(bodyParser.urlencoded({ extended: true }))

    //database connect 
    await ConnectToMongoDB(MONGO_URL, "QuestionBank")
    await connectToClient()
    await connectPubSub()

    //routing 
    app.use('/api/v1/questionBank', QuestionBankRoute)

    // error handling
    app.use(errorHandler)

    app.listen(PORT, () => {
        console.log(`Server running on PORT: ${PORT}`);
        console.log(`${process.env.HOST}:${process.env.PORT}`);
    })
}

startApp()