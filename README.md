# Points API
Sample HTTP web service for managing user points, written in Node.js + Express and tested with Mocha + Chai.

## Background
Our users have points in their accounts. Users only see a single balance in their accounts. 
But for reporting purposes we actually track their points per payer/partner. 
In our system, each transaction record contains: payer (string), points (integer), timestamp (date).

For earning points it is easy to assign a payer, we know which actions earned the points. 
And thus which partner should be paying for the points.

When a user spends points, they don't know or care which payer the points come from. But, 
our accounting team does care how the points are spent. There are two rules for determining 
what points to "spend" first:
* We want the oldest points to be spent first (oldest based on transaction timestamp, not the order they're received)
* We want no payer's points to go negative.

## Usage
This service was written for use with Node.js v12. If you don't have Node installed, you can 
grab v12 here: https://nodejs.org/dist/latest-v12.x/. Be sure to install npm package manager as well.

From the root of the project download the project dependencies using the command line:
```Shell
npm install
```

To launch the service on localhost at port 3001, run:
```Shell
npm run start
```

You can navigate to http://localhost:3001/status to verify that the service is running.

To run the end-to-end tests, launch the service and in another console, run:
```Shell
npm test
```

## Endpoints
To check if the API is running,
```http
GET /status
```
returns:
```json
{ "status": "OK" }
```

### Add a transaction
For a user with id `:user` (which may be any string identifier), add a points
transaction for a specific payer and at a specific point in time.
```http
POST /points/user/:user/transaction HTTP/1.1
Content-Type: application/json

{
    "payer": "PAYER1",
    "points": 50,
    "timestamp": "2021-03-21T10:00:00Z"
}
```

### Get current point balances
For a user with id `:user`, return the balance of points available 
for each payer.
```http
GET /points/user/:user/balances
```
returns:
```json
{
    "PAYER1": 100,
    "PAYER2": 200
}
```

### Spend points
For a user with id `:user`, spend the oldest points from any and 
all payers, without any payer negative.
```http
POST /points/user/:user/spend HTTP/1.1
Content-Type: application/json

{
    "points": 300
}
```
returns how the points were spent:
```json
[
    { "payer": "PAYER1", "points": -100 },
    { "payer": "PAYER2", "points": -200 }
]
```
