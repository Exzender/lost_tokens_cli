const { ERC20, rpcMap, ethRpcArray} = require('./const');
const { Web3 } = require('web3');

// how many concurrent requests to make - different node may limit number of incoming requests - so 20 is a good compromise
const asyncProcsNumber = 10
const chains = [...rpcMap.keys()];
const chain = (process.env.CHAIN || chains[0]).toLowerCase();

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
    const token = new web3.eth.Contract(ERC20, contractAddress);

    const promises = [];
    // NOTE with web3 v4 it will not provide data auto field when calling contract method - and some nodes will fail to
    // process request without data field
    promises.push(token.methods.symbol().call({data: '0x1'})); // ticker
    promises.push(token.methods.decimals().call({data: '0x1'})); // decimals
    const results = await Promise.allSettled(promises);

    // treating token as invalid when can't get its symbol from blockchain
    const validToken = results[0].status === 'fulfilled';
    const ticker = validToken ? results[0].value : 'unknown';

    // getting price from 3rd party API - may have limits on number of requests
    let priceObj = {
        price: 0,
        USD: 0
    };

    if (validToken) {
        try {
            const req = (await fetch(`https://api-data.absolutewallet.com/api/v1/currencies/minimal/${chain}/${contractAddress}?fiat=USD`));
            if (req.status === 200) {
                priceObj = (await req.json());
            }
        } catch (e) {
            console.error(e);
        }

        if (priceObj.price === 0) {
            try {
                const req = (await fetch(`https://min-api.cryptocompare.com/data/price?fsym=${ticker}&tsyms=USD`));
                if (req.status === 200) {
                    priceObj = (await req.json());

                }
            } catch (e) {
                console.error(e);
            }
        }
    }

    return {
        address: contractAddress,
        ticker,
        valid: validToken,
        decimals: Number(results[1].value) || 18,
        price: priceObj['price'] ?? priceObj['USD'] ?? 0
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
    return await token.methods.balanceOf(address).call({data: '0x1'}).catch(async (e) => {
        console.error('balanceOf error');
        console.dir(token._requestManager._provider.clientUrl);
        return await getBalanceOf(token, address);
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
    const tokens = [];

    if (chain === 'eth') {
        for (const rpc of ethRpcArray) {
            const web3provider = new Web3(rpc);
            tokens.push(new web3provider.eth.Contract(ERC20, tokenObject.address));
        }
    } else {
        tokens.push(new web3.eth.Contract(ERC20, tokenObject.address));
    }

    let promises = []
    let counter = 0;
    const balances = []
    const records = []

    // iterate contracts
    let token = tokens[0];



    const arrayLength = tokens.length - 1;
    for (const address of contractList) {
        counter++
        promises.push(getBalanceOf(token, address))
        // process batch of async requests
        if (counter % asyncProcsNumber === 0) {
            const idx = counter / asyncProcsNumber >> 0;
            if (idx > arrayLength) {
                balances.push(...await Promise.all(promises));
                promises = [];
                counter = 0;
                token = tokens[0];
            } else {
                token = tokens[idx];
            }
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

    // NOTE decided to find lost tokens even if there are no known price
    // if (tokenObject.price === 0) {
    //     return {
    //         tokenAddress,
    //         ticker: tokenObject.ticker,
    //         decimals: tokenObject.decimals,
    //         price: -1, // no price
    //         records: []
    //     }
    // }

    const results = await findBalances(web3, contractList, tokenObject);

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

module.exports = {
    getTokenInfo,
    getBalanceOf,
    findBalances,
    processOneToken,
    formatTokenResult,
    parseAddress,
    numberWithCommas
}