const { expect } = require('chai')
const { default: Axios } = require('axios')

const requestOptions = {
    baseURL: 'http://localhost:3001/',
    validateStatus: (status) => status < 500,
}

describe('Points API', function () {
    it('is alive', async function () {
        let r = await Axios.get('/status', requestOptions)
        expect(r.status).to.equal(200)
        expect(r.data.status).to.equal('OK')
    })

    describe('Single points transaction', function () {
        const user = 1

        before('add a single transaction', async function () {
            // Add points in 1 transaction
            await Axios.post(`/points/user/${user}/transaction`, {
                payer: 'DANNON',
                points: 100,
                timestamp: new Date()
            }, requestOptions)
        })

        it('should return the number of points added per payer', async function () {
            // Verify those points were added
            let r = await Axios.get(`/points/user/${user}/balances`, requestOptions)
            expect(r.status).to.equal(200)
            expect(r.data).to.have.property('DANNON', 100)
        })
    })
})