const { createClient } = require('redis')
const Subject = require('../model/Subject')
const { v1: uuidv1 } = require('uuid')

const sub = createClient()
const pub = createClient()

const connectPubSub = async () => {
    try {

        await sub.connect()
        await pub.connect()

    } catch (error) {

        console.log('Cannot connect to PUB SUB')
        console.log(error)

    }
}

const request = async ({ REQ_CHANNEL, RPLY_CHANNEL }, payload) => {
    try {
        const channelId = uuidv1()

        pub.publish(`${REQ_CHANNEL}:${channelId}`, JSON.stringify(payload))

        return new Promise((resolve, reject) => {
            try {

                sub.subscribe(`${RPLY_CHANNEL}:${channelId}`, (message, channel) => {
                    resolve(JSON.parse(message))
                })

            } catch (error) {

                reject(error)

            }
        })
    } catch (error) {

        console.log(`Failed To Subscribe ${REQ_CHANNEL}`)

    }
}

sub.pSubscribe('REQ_SUBJECT:*', async (message, channel) => {

    const channelId = channel.split(":")[1]

    try {

        const filter = JSON.parse(message)

        const subject = await Subject.find(filter)

        pub.publish(`RPLY_SUBJECT:${channelId}`, JSON.stringify(subject))

    } catch (error) {

        pub.publish(`RPLY_SUBJECT:${channelId}`, "0")
        console.log(error)

    }
})

module.exports = { request, connectPubSub }