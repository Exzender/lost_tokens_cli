const fs = require('fs');
const path = require('path');
const { Web3 } = require('web3')

// NOTE walkaround to use fetch from old node.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))

// NOTE default tokens and contracts list moved to const.js file
const { tokens, contracts, rpcMap, ERC20 } = require('./const')
const chains = [...rpcMap.keys()]

// how many concurrent requests to make - different node may limit number of incoming requests - so 20 is a good compromise
const asyncProcsNumber = 10

function checkEthAddress(web3, address) {
    try {
        web3.utils.toChecksumAddress(address);
        return true;
    } catch (e) {
        return false;
    }
}

function parseAddress(web3, address) {
    const result = [];
    const list = address.split(/\n|;|,|;\n|,\n/)

    for (const l of list) {
        const name = l.trim()
        if (checkEthAddress(web3, name)) {
            result.push(name)
        }
    }

    return result.join('\n')
}

/**
 * Formats a number with commas (e.g. 123,234,660.12)
 *
 * @param {number} x - The number to be formatted.
 * @return {string} The formatted number as a string.
 */
function numberWithCommas(x) {
    if (x < 0.000001) return '0.00'
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
    let priceObj = {
        USD: 0
    }
    try {
        if (validToken) {
            priceObj =(await (await fetch(`https://min-api.cryptocompare.com/data/price?fsym=${ticker}&tsyms=USD`)).json())
        }
    } catch (e) {
        console.error(e)
    }

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

async function processOneToken(web3, contractList, tokenAddress) {
    const tokenObject = await getTokenInfo(web3, tokenAddress)

    // console.dir(tokenObject);

    if (!tokenObject.valid) {
        return {
            tokenAddress,
            price: 0,
            decimals: 18,
            ticker: null,
            records: []
        }
    }

    if (tokenObject.price === 0) {
        return {
            tokenAddress,
            ticker: tokenObject.ticker,
            decimals: tokenObject.decimals,
            price: -1, // no price
            records: []
        }
    }

    const results = await findBalances(web3, contractList, tokenObject);
// console.dir(results)

    return {
        tokenAddress,
        ticker: tokenObject.ticker,
        decimals: tokenObject.decimals,
        price: tokenObject.price,
        records: results
    }
}

function formatTokenResult(res) {
    let localStr = ''

    if (!res.ticker) { // invalid token
        return { resStr : `??? [${res.tokenAddress}] - unknown token\n`, asDollar: 0 }
    }

    if (res.price === -1) { // can't get price
        return { resStr : `${res.ticker} [${res.tokenAddress}]: not checked - no price found\n`, asDollar: 0 }
    }

    // normal process
    let sum = 0n

    // records already sorted by value - formatting output
    for (const record of res.records) {
        const str = `Contract ${record.contract} => ${numberWithCommas(record.roundedAmount)} ${res.ticker} ( $${record.dollarValue} )`
        sum += record.amount
        localStr += str + '\n'
    }

    // increasing sum value
    const roundedAmount = Number(sum) / Number(`1e${res.decimals}`)
    const asDollar = roundedAmount * res.price

    const header = `${res.ticker} [${res.tokenAddress}]: ${numberWithCommas(roundedAmount)} tokens lost / $${numberWithCommas(asDollar)}`
    localStr = header + '\n-----------------------------------------------\n' + localStr

    return { resStr: localStr, asDollar }
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
    const chainTokensStr = tokens[chain].join('\n');
    const chainContractsStr = contracts[chain].join('\n');

    // add tokens from text file
    let parsed = '';
    let parsedContracts = '';
    if (chain === 'eth') {
        const tokensFromFile = fs.readFileSync(path.resolve(__dirname, 'tokens_list.txt'), 'utf8');
        parsed = parseAddress(web3provider, tokensFromFile) + '\n' + chainTokensStr;

        const contractsFromFile = fs.readFileSync(path.resolve(__dirname, 'excluded_tokens.txt'), 'utf8');
        parsedContracts = parseAddress(web3provider, contractsFromFile) + '\n' + chainContractsStr;
    }

    console.time('getBalances')

    // process tokens - find lost balances
    let chainTokens = parsed.split('\n')
    chainTokens = Array.from(new Set(chainTokens))
    const chainContracts = parsedContracts.split('\n')

    console.log(`Tokens: ${chainTokens.length}`);
    console.log(`Contracts: ${chainContracts.length}`);

    const contractListArray = Array.from(new Set(chainContracts.concat(chainTokens)))
    console.log(`Addresses: ${contractListArray.length}`);

    const resultsArray = []
    let wholeSum = 0
    let counter = 0

    for (const tokenAddress of chainTokens) {
        console.time('getOneBalance')
        const res = await processOneToken(web3provider, contractListArray, tokenAddress)

        const formatted = formatTokenResult(res)

        wholeSum += formatted.asDollar
        resultsArray.push({
            ...res,
            asDollar: formatted.asDollar
        })

        counter++;
        console.log(counter, '.', res.ticker, ':', formatted.asDollar);
        console.timeEnd('getOneBalance')
    }

    resultsArray.sort(function (a, b) {
        return b.asDollar - a.asDollar
    })

    let resStr = '';
    for (const res of resultsArray) {
        const formatted = formatTokenResult(res)
        resStr += formatted.resStr + '\n'
    }

    resStr = `WHOLE SUM: $${numberWithCommas(wholeSum)} for ${counter} tokens\n\n` + resStr;

    console.timeEnd('getBalances')

    fs.writeFileSync(path.resolve(__dirname, 'lost_tokens_result.txt'), resStr, 'utf8');
})();