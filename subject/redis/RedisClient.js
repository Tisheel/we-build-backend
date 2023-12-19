const { createClient } = require('redis')

const client = createClient()

const connectToClient = async () => {
    try {

        await client.connect()
        console.log('Redis Client Connected')

    } catch (error) {

        console.log('Redis Client Failed')
        
    }
}

module.exports = { client, connectToClient }