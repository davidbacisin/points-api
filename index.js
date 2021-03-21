const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const { PointStore } = require('./PointStore')

const app = express()
const port = 3001
const pointStore = new PointStore()

function handleError(req, res, err) {
    console.log(err)
    res.status(500).send({
        status: 'error',
        message: 'An unexpected error occurred'
    })
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
        const addResult = pointStore.addTransaction({
            userId: req.params.user,
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

/**
 * Retrieve the balances for a user, grouped by payer
 */
app.get('/points/user/:user/balances', (req, res) => {
    try {
        const result = pointStore.getBalances({ userId: req.params.user})
        res.status(200).send(Object.fromEntries(result.entries()))
    }
    catch (err) {
        handleError(req, res, err)
    }
})

/**
 * Spend points for a user, returning an array of how those points 
 * were distributed among the payer balances
 */
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

        const plan = pointStore.createSpendingPlan({
            userId: req.params.user,
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
            pointStore.addTransaction({
                userId: req.params.user,
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