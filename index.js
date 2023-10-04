const { Web3 } = require('web3')

// NOTE walkaround to use fetch from old node.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))

// NOTE default tokens and contracts list moved to const.js file
const { tokens, contracts, rpcMap, ERC20 } = require('./const')
const chains = [...rpcMap.keys()]

// how many concurrent requests to make - different node may limit number of incoming requests - so 20 is a good compromise
const asyncProcsNumber = 20

/**
 * Formats a number with commas (e.g. 123,234,660.12)
 *
 * @param {number} x - The number to be formatted.
 * @return {string} The formatted number as a string.
 */
function numberWithCommas(x) {
    const parts = x.toString().split(".")
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    if (parts.length > 1) {
        parts[1] = parts[1].substring(0, 2)
    }
    return parts.join(".")
}

/**
 * Retrieves information about a token using its contract address.
 *
 * @param {Object} web3 - The web3 instance.
 * @param {string} contractAddress - The contract address of the token.
 * @return {Object} An object containing token information.
 */
async function getTokenInfo(web3, contractAddress) {
    const token = new web3.eth.Contract(ERC20, contractAddress)

    const promises = []
    // NOTE with web3 v4 it will not provide data auto field when calling contract method - and some nodes will fail to
    // process request without data field
    promises.push(token.methods.symbol().call({data: '0x1'})) // ticker
    promises.push(token.methods.decimals().call({data: '0x1'})) // decimals
    const results = await Promise.allSettled(promises)

    // treating token as invalid when can't get its symbol from blockchain
    const validToken = results[0].status === 'fulfilled'
    const ticker = validToken ? results[0].value : 'unknown'

    // getting price from 3rd party API - may have limits on number of requests
    const priceObj = validToken ? (await (await fetch(`https://min-api.cryptocompare.com/data/price?fsym=${ticker}&tsyms=USD`)).json()) : {}

    return {
        address: contractAddress,
        ticker,
        valid: validToken,
        decimals: Number(results[1].value) || 18,
        price: priceObj['USD'] ?? 0
    }
}

/**
 * Retrieves the balance of a given address for a specific token.
 *
 * @param {Token} token - The token contract instance.
 * @param {string} address - The address for which to retrieve the balance.
 * @return {Promise<number>} A promise that resolves to the balance of the address.
 */
async function getBalanceOf (token, address){
    return await token.methods.balanceOf(address).call({data: '0x1'}).catch(async () => {
        return await getBalanceOf(token, address)
    })
}

/**
 * Retrieves all balances on multiple contracts for a given token.
 *
 * @param {Object} web3 - the web3 instance
 * @param {Array} contractList - the list of contract addresses to retrieve balances for
 * @param {Object} tokenObject - the token object containing token information
 * @return {Array} returns an array of records containing contract balances
 */
async function findBalances(web3, contractList, tokenObject) {
    // token - contract object
    const token = new web3.eth.Contract(ERC20, tokenObject.address)

    let promises = []
    let counter = 0;
    const balances = []
    const records = []

    // iterate contracts
    for (const address of contractList) {
        counter++
        promises.push(getBalanceOf(token, address))
        // process batch of async requests
        if (counter % asyncProcsNumber === 0) {
            balances.push(...await Promise.all(promises))
            promises = []
            counter = 0
        }
    }
    if (promises.length) {
        balances.push(...await Promise.all(promises))
    }


    // format acquired balances
    for (let i = 0; i < balances.length; i++) {
        if (balances[i] > 0n) {
            const amount = Number(balances[i] / BigInt(Number(`1e${tokenObject.decimals}`)))
            const dollarValue = numberWithCommas(amount * tokenObject.price)
            records.push({
                amount: BigInt(balances[i]),
                roundedAmount: amount,
                dollarValue,
                contract: contractList[i]
            })
        }
    }

    // sort from max to min
    records.sort(function(a, b) {return b.roundedAmount - a.roundedAmount})

    return records
}

// main ()
(async () => {
    // can provide active chain via env var.
    // list of supported predefined chains in rpcMap const.
    const chain = (process.env.CHAIN || chains[0]).toLowerCase()
    const rpc = rpcMap.get(chain)

    // can use any of supported chains
    const web3provider = new Web3(rpc)

    // get default tokens and contracts for current chain
    const chainTokens = tokens[chain]
    const chainContracts = contracts[chain]

    // NOTE append here custom tokens and contracts

    const objectTokens = []
    let promises = []
    let counter = 0

    console.time('getTokenInfo')

    // get info for provided tokens
    for (const token of chainTokens) {
        counter++
        promises.push(getTokenInfo(web3provider, token))
        if (counter % asyncProcsNumber === 0) {
            objectTokens.push(...await Promise.all(promises))
            promises = []
            counter = 0
        }
    }
    if (promises.length) {
        objectTokens.push(...await Promise.all(promises))
    }

    // check time taken by info gathering
    console.timeEnd('getTokenInfo')

    // exclude duplicates
    const contractList = Array.from(new Set(chainContracts.concat(chainTokens)));

    let wholeSum = 0

    console.time('getBalances')

    // process tokens - find lost balances
    for (const token of objectTokens) {
        if (token.valid) {
            const results = await findBalances(web3provider, contractList, token);

            let sum = 0n

            // records already sorted by value - formatting output
            for (const record of results) {
                const str = `Contract ${record.contract} => ${numberWithCommas(record.roundedAmount)} ${token.ticker} ($${numberWithCommas(record.dollarValue)})`
                sum += record.amount
                console.log(str)
            }

            // increasing sum value
            const roundedAmount = Number(sum / BigInt(Number(`1e${token.decimals}`)))
            const asDollar = roundedAmount * token.price
            wholeSum += asDollar

            // bottom line
            const header = `${token.ticker}: ${numberWithCommas(roundedAmount)} tokens lost / $${numberWithCommas(asDollar)}`
            console.log(header);
        }
    }
    console.timeEnd('getBalances')

    console.log()
    const itog = `Sum lost:  $${numberWithCommas(wholeSum)}`
    console.log(itog);

    // TODO sort tokens by result sum
})();