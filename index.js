const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')

const app = express()
const port = 3001
const pointStore = new Map()

function mapGetOrInit(map, key, defaultValue) {
    if (map.has(key))
        return map.get(key)
    
    map.set(key, defaultValue)
    return defaultValue
}

app.use(bodyParser.json())

/**
 * Status endpoint to check if the API is running.
 * @returns { 'status': 'OK' } if the API is alive.
 */
app.get('/status', (req, res) => res.status(200).send({ status: 'OK' }))

/**
 * Add a transaction for a specific payer and date
 */
app.post('/points/user/:user/transaction', (req, res) => {
    const userPoints = mapGetOrInit(pointStore, req.params.user, [])
    userPoints.push({
        payer: req.body.payer,
        points: req.body.points,
        timestamp: req.body.timestamp
    })
    res.status(200).send()
})

app.get('/points/user/:user/balances', (req, res) => {
    const userPoints = mapGetOrInit(pointStore, req.params.user, [])

    // Reduce points, matching on payer
    let result = userPoints.reduce((acc, transaction) => {
        // Default to 0 if it the payer hasn't been initialized yet
        const currentSum = acc.get(transaction.payer) || 0
        acc.set(transaction.payer, currentSum + transaction.points)
        return acc
    }, new Map())

    res.status(200).send(Object.fromEntries(result.entries()))
})

app.listen(port, () => {
    const apiUrl = `http://localhost:${port}/`
    console.log(`Running Points API at ${apiUrl}`)
})