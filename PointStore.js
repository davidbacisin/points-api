function transactionByTimestampAscending(a, b) {
    if (a.timestamp > b.timestamp) return 1
    else if (a.timestamp < b.timestamp) return -1
    else return 0
}

exports.PointStore = class {
    constructor() {
        this._pointsByUser = new Map()
    }

    getOrCreate(userId) {
        if (this._pointsByUser.has(userId))
            return this._pointsByUser.get(userId)
    
        const defaultValue = []
        this._pointsByUser.set(userId, defaultValue)
        return defaultValue
    }

    addTransaction({ userId, payer, points, timestamp }) {
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
    
        const userPoints = this.getOrCreate(userId)
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

    getBalances({ userId }) {
        const userPoints = this.getOrCreate(userId)

        // Reduce points, matching on payer
        return userPoints.reduce((acc, transaction) => {
            // Default to 0 if the payer hasn't been initialized yet
            const currentSum = acc.get(transaction.payer) || 0
            acc.set(transaction.payer, currentSum + transaction.points)
            return acc
        }, new Map())
    }

    createSpendingPlan({ userId, points }) {
        // Sort those points in time order. Clone because sort is in-place
        const clonedPoints = [...this.getOrCreate(userId)]
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
    
}