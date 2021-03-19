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

function transactionByTimestampAscending(a, b) {
    if (a.timestamp > b.timestamp) return 1
    else if (a.timestamp < b.timestamp) return -1
    else return 0
}

function handleError(req, res, err) {
    console.log(err)
    res.status(500).send({
        status: 'error',
        message: 'An unexpected error occurred'
    })
}

function addTransaction({ userPoints, payer, points, timestamp }) {
    if (typeof payer !== 'string') {
        return {
            status: 'error',
            message: `Parameter 'payer' must be a string`
        }
    }

    const ts = Date.parse(timestamp)
    if (isNaN(ts)) {
        return {
            status: 'error',
            message: `Parameter 'timestamp' must be an ISO timestamp`
        }
    }

    if (isNaN(points)) {
        return {
            status: 'error',
            message: `Parameter 'points' must be a number`
        }
    }

    userPoints.push({
        payer,
        points,
        timestamp: ts,
        spent: 0
    })

    return {
        error: null,
        message: null
    }
}

function createSpendingPlan({ userPoints, points }) {
    // Sort those points in time order. Clone because sort is in-place
    const clonedPoints = [...userPoints]
    clonedPoints.sort(transactionByTimestampAscending)

    // Remove negative transactions
    const positivePoints = []
    clonedPoints.forEach((transaction) => {
        if (transaction.points > 0) {
            // Create a copy of the transaction to avoid modifying the original
            positivePoints.push({
                payer: transaction.payer,
                points: transaction.points,
                timestamp: transaction.timestamp
            })
        }
        else if (transaction.points < 0) {
            // Neutralize negative points
            let pointsLeftToNeutralize = -transaction.points

            // positivePoints is already sorted, so just filter for this payer
            const payerPoints = positivePoints.filter(pp => pp.payer === transaction.payer)
            for (let i = 0; i < payerPoints.length && pointsLeftToNeutralize > 0; i++) {
                const pointsToNeutralizeNow = Math.min(pointsLeftToNeutralize, payerPoints[i].points)
                pointsLeftToNeutralize -= pointsToNeutralizeNow
                payerPoints[i].points -= pointsToNeutralizeNow
            }
        }
        // else skip 0 point transactions
    })

    // Spend those points. Note that we have to check all transactions 
    // in case later transactions have actually spent points from earlier 
    // transactions
    let pointsLeftToSpend = points
    const payers = new Map()
    for (let i = 0; i < positivePoints.length && pointsLeftToSpend > 0; i++) {
        let transaction = positivePoints[i]

        // We're going to spend these points. Initialize the payer in the payers Map
        if (!payers.has(transaction.payer))
            payers.set(transaction.payer, 0)

        // Spend only as many points as are available
        // If transaction.points == 0, this will be a no-op
        // If transaction.points < 0, this will increase pointsLeftToSpend. We'll have to spend them in a later transaction.
        const pointsToSpendNow = Math.min(pointsLeftToSpend, transaction.points)
        pointsLeftToSpend -= pointsToSpendNow
        payers.set(transaction.payer, payers.get(transaction.payer) - pointsToSpendNow)
    }

    return payers
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
    try {
        const userPoints = mapGetOrInit(pointStore, req.params.user, [])

        let addResult = addTransaction({
            userPoints,
            payer: req.body.payer,
            points: req.body.points,
            timestamp: req.body.timestamp
        })

        if (addResult.error) {
            res.status(400).send(addResult.error)
            return
        }

        res.status(201).send()
    }
    catch (err) {
        handleError(req, res, err)
    }
})

app.get('/points/user/:user/balances', (req, res) => {
    try {
        const userPoints = mapGetOrInit(pointStore, req.params.user, [])

        // Reduce points, matching on payer
        let result = userPoints.reduce((acc, transaction) => {
            // Default to 0 if the payer hasn't been initialized yet
            const currentSum = acc.get(transaction.payer) || 0
            acc.set(transaction.payer, currentSum + transaction.points)
            return acc
        }, new Map())

        res.status(200).send(Object.fromEntries(result.entries()))
    }
    catch (err) {
        handleError(req, res, err)
    }
})

app.post('/points/user/:user/spend', (req, res) => {
    try {
        const points = parseInt(req.body.points)
        if (isNaN(points)) {
            res.status(400).send({
                status: 'error',
                message: `Parameter 'points' is not a number`
            })
            return
        }

        const userPoints = mapGetOrInit(pointStore, req.params.user, [])
        const plan = createSpendingPlan({
            userPoints,
            points
        })

        const pointsSpent = [...plan.values()].reduce((acc, p) => acc + p, 0)
        if (-pointsSpent < points) {
            res.status(409).send({
                status: 'error',
                message: 'Cannot spend more points than the user has available'
            })
            return
        }

        // Execute the spending plan
        const summary = []
        const timestamp = new Date().toISOString()
        plan.forEach((points, payer) => {
            addTransaction({
                userPoints,
                payer,
                points,
                timestamp
            })

            // Also populate the response object
            summary.push({ payer, points })
        })

        // Spend was successful
        res.status(200).send(summary)
    }
    catch (err) {
        handleError(req, res, err)
    }
})

app.listen(port, () => {
    const apiUrl = `http://localhost:${port}/`
    console.log(`Running Points API at ${apiUrl}`)
})