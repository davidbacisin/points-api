const { expect } = require('chai')
const { default: Axios } = require('axios')
const { v4: uuidv4 } = require('uuid');

const requestOptions = {
    baseURL: 'http://localhost:3001/',
    validateStatus: (status) => status < 500,
}

/**
 * Writing a new test? Use uuidv4() to generate a new user ID, therefore 
 * allowing your tests to run independently of each other. Otherwise,
 * you'll get side effects of adding/spending points from another test
 */

describe('Points API', function () {
    it('is alive', async function () {
        let r = await Axios.get('/status', requestOptions)
        expect(r.status).to.equal(200)
        expect(r.data.status).to.equal('OK')
    })

    describe('Single points transaction', function () {
        const user = uuidv4()

        it('should add a single transaction', async function () {
            // Add points in 1 transaction
            let r = await Axios.post(`/points/user/${user}/transaction`, {
                payer: 'DANNON',
                points: 100,
                timestamp: new Date()
            }, requestOptions)

            // A new transaction should be considered '201 Created'
            expect(r.status).to.equal(201)
        })

        it('should return the number of points added per payer', async function () {
            // Verify those points were added
            let r = await Axios.get(`/points/user/${user}/balances`, requestOptions)
            expect(r.status).to.equal(200)
            expect(r.data).to.have.property('DANNON', 100)
        })
    })

    describe('Multiple transactions', function () {
        const user = uuidv4()

        before('add several transactions for several payers', async function () {
            await Axios.post(`/points/user/${user}/transaction`, {
                payer: 'DANNON',
                points: 100,
                timestamp: new Date()
            }, requestOptions)

            await Axios.post(`/points/user/${user}/transaction`, {
                payer: 'UNILEVER',
                points: 123,
                timestamp: new Date()
            }, requestOptions)

            await Axios.post(`/points/user/${user}/transaction`, {
                payer: 'MILLER COORS',
                points: 4000,
                timestamp: new Date()
            }, requestOptions)

            await Axios.post(`/points/user/${user}/transaction`, {
                payer: 'DANNON',
                points: 200,
                timestamp: new Date()
            }, requestOptions)

            await Axios.post(`/points/user/${user}/transaction`, {
                payer: 'MILLER COORS',
                points: -200,
                timestamp: new Date()
            }, requestOptions)
        })

        it('should sum all points by payer', async function () {
            let r = await Axios.get(`/points/user/${user}/balances`, requestOptions)
            expect(r.status).to.equal(200)
            expect(r.data).to.have.property('DANNON', 300)
            expect(r.data).to.have.property('UNILEVER', 123)
            expect(r.data).to.have.property('MILLER COORS', 3800)
        })
    })

    describe('Spending points with a negative transaction', function () {
        const user = uuidv4()

        before('add multiple transactions', async function () {
            await Axios.post(`/points/user/${user}/transaction`, {
                payer: 'DANNON',
                points: 300,
                timestamp: '2020-10-31T10:00:00Z'
            }, requestOptions)
            await Axios.post(`/points/user/${user}/transaction`, {
                payer: 'UNILEVER',
                points: 200,
                timestamp: '2020-10-31T11:00:00Z'
            }, requestOptions)
            await Axios.post(`/points/user/${user}/transaction`, {
                payer: 'DANNON',
                points: -100,
                timestamp: '2020-10-31T15:00:00Z'
            }, requestOptions)
        })

        it('should account for later negative transactions when spending earlier points', async function () {
            /* If it doesn't account for later negative transactions, then 
            spending 350 points would spend 300 from Dannon and 50 from Unilever.
            This would result in ending balances of { Dannon: -100, Unilever: 150 }, 
            which is not allowed. Instead, we expect the service to account for the 
            -100 from Dannon before it tries to spend any of the points. */
            let r = await Axios.post(`/points/user/${user}/spend`, {
                points: 350
            }, requestOptions)

            expect(r.status).to.equal(200)
            expect(r.data).to.be.an("Array")
            expect(r.data).to.have.lengthOf(2)
            expect(r.data).to.deep.include({ payer: 'DANNON', points: -200 })
            expect(r.data).to.deep.include({ payer: 'UNILEVER', points: -150 })
        })

        it('should return the correct remaining balances', async function () {
            let r = await Axios.get(`/points/user/${user}/balances`, requestOptions)
            expect(r.status).to.equal(200)
            expect(r.data).to.have.property('DANNON', 0)
            expect(r.data).to.have.property('UNILEVER', 50)
        })
    })


    describe('Multiple rounds of spending', function () {
        const user = uuidv4()

        before('add multiple transactions', async function () {
            await Axios.post(`/points/user/${user}/transaction`, {
                payer: 'DANNON',
                points: 1000,
                timestamp: '2020-11-02T14:00:00Z'
            }, requestOptions)
            await Axios.post(`/points/user/${user}/transaction`, {
                payer: 'UNILEVER',
                points: 200,
                timestamp: '2020-10-31T11:00:00Z'
            }, requestOptions)
            await Axios.post(`/points/user/${user}/transaction`, {
                payer: 'DANNON',
                points: -200,
                timestamp: '2020-10-31T15:00:00Z'
            }, requestOptions)
            await Axios.post(`/points/user/${user}/transaction`, {
                payer: 'MILLER COORS',
                points: 10000,
                timestamp: '2020-11-01T14:00:00Z'
            }, requestOptions)
            await Axios.post(`/points/user/${user}/transaction`, {
                payer: 'DANNON',
                points: 300,
                timestamp: '2020-10-31T10:00:00Z'
            }, requestOptions)
        })

        it('should spend the oldest points first', async function () {
            let r = await Axios.post(`/points/user/${user}/spend`, {
                points: 5000
            }, requestOptions)

            expect(r.status).to.equal(200)
            expect(r.data).to.be.an("Array")
            expect(r.data).to.have.lengthOf(3)
            expect(r.data).to.deep.include({ payer: 'DANNON', points: -100 })
            expect(r.data).to.deep.include({ payer: 'UNILEVER', points: -200 })
            expect(r.data).to.deep.include({ payer: 'MILLER COORS', points: -4700 })
        })

        it('should return the correct remaining balances', async function () {
            let r = await Axios.get(`/points/user/${user}/balances`, requestOptions)
            expect(r.status).to.equal(200)
            expect(r.data).to.have.property('DANNON', 1000)
            expect(r.data).to.have.property('UNILEVER', 0)
            expect(r.data).to.have.property('MILLER COORS', 5300)
        })

        it('should handle multiple spends', async function () {
            let r = await Axios.post(`/points/user/${user}/spend`, {
                points: 5600
            }, requestOptions)

            expect(r.status).to.equal(200)
            // No need for a type check, an earlier test checks that
            expect(r.data).to.deep.include({ payer: 'MILLER COORS', points: -5300 })
            expect(r.data).to.deep.include({ payer: 'DANNON', points: -300 })
        })

        it('should reject overspending', async function () {
            let r = await Axios.post(`/points/user/${user}/spend`, {
                points: 20000
            }, requestOptions)

            expect(r.status).to.equal(409)
            expect(r.data).to.have.property('status', 'error')
            expect(r.data).to.have.property('message')
        })
    })
})