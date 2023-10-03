const { Web3 } = require('web3')
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))
// NOTE default tokens and contracts list moved to const.js file
const { tokens, contracts, rpcMap, ERC20, functionSignature } = require('./const')
const chains = [...rpcMap.keys()]

// how many concurrent requests to make - different node may limit number of incoming requests - so 20 is a good compromise
const asyncProcsNumber = 20

function numberWithCommas(x) {
    const parts = x.toString().split(".")
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    if (parts.length > 1) {
        parts[1] = parts[1].substring(0, 2)
    }
    return parts.join(".")
}

async function getTokenInfo(web3, contractAddress) {
    const token = new web3.eth.Contract(ERC20, contractAddress)

    const promises = []
    // NOTE with web3 v4 it will not provide data auto field when calling contract method - and some nodes will fail to
    // process request without data field
    promises.push(token.methods.symbol().call({data: functionSignature.get('symbol')})) // ticker
    promises.push(token.methods.decimals().call({data: functionSignature.get('decimals')})) // decimals
    const results = await Promise.allSettled(promises)

    const validToken = results[0].status === 'fulfilled'
    const ticker = validToken ? results[0].value : 'unknown'

    const priceObj = validToken ? (await (await fetch(`https://min-api.cryptocompare.com/data/price?fsym=${ticker}&tsyms=USD`)).json()) : {}

    return {
        address: contractAddress,
        ticker,
        valid: validToken,
        decimals: Number(results[1].value) || 18,
        price: priceObj['USD'] ?? 0
    }
}

async function getBalanceOf (token, address){
    return await token.methods.balanceOf(address).call({data: functionSignature.get('balanceOf')}).catch(async () => {
        return await getBalanceOf(token, address)
    })
}

async function findBalances(web3, contractList, tokenObject) {
    const token = new web3.eth.Contract(ERC20, tokenObject.address)

    let promises = []
    let counter = 0;
    const balances = []
    const records = []

    for (const address of contractList) {
        counter++
        promises.push(getBalanceOf(token, address))
        if (counter % asyncProcsNumber === 0) {
            balances.push(...await Promise.all(promises))
            promises = []
            counter = 0
        }
    }
    if (promises.length) {
        balances.push(...await Promise.all(promises))
    }


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
    console.timeEnd('getTokenInfo')

    // exclude duplicates
    const contractList = Array.from(new Set(chainContracts.concat(chainTokens)));

    let wholeSum = 0

    console.time('getBalances')
    for (const token of objectTokens) {
        if (token.valid) {
            const results = await findBalances(web3provider, contractList, token);

            let sum = 0n

            for (const record of results) {
                const str = `Contract ${record.contract} => ${numberWithCommas(record.roundedAmount)} ${token.ticker} ($${numberWithCommas(record.dollarValue)})`
                sum += record.amount
                console.log(str)
            }

            const roundedAmount = Number(sum / BigInt(Number(`1e${token.decimals}`)))
            const asDollar = roundedAmount * token.price
            wholeSum += asDollar

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