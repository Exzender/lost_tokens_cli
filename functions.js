const path = require('path');
const { Web3 } = require('web3');
const BigNumber = require('bignumber.js');
const axios = require('axios');
const fsAsync = require('fs').promises;

const { ERC20, ERC20n, rpcMap, ethRpcArray
     } = require('./const');
const fs = require("fs");

// how many concurrent requests to make - different node may limit number of incoming requests - so 20 is a good compromise
// const asyncProcsNumber = 5;
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
//
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
function numberWithCommas(x, places = 2) {
    if (x < 0.000001) return '0.00'
    const parts = x.toString().split(".")
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    if (parts.length > 1) {
        parts[1] = parts[1].substring(0, places)
    }
    return parts.join(".")
}

/**
 * Retrieves information about a token using its contract address.
 *
 * @param {Object} web3 - The web3 instance.
 * @param {string} contractAddress - The contract address of the token.
 * @param {Object} tokenObject - Token info from Etherscan.
 * @return {Object} An object containing token information.
 */
async function getTokenInfo(web3, contractAddress, tokenObject) {
    const token = new web3.eth.Contract(ERC20, contractAddress);
    
    // NOTE with web3 v4 it will not provide data auto field when calling contract method - and some nodes will fail to
    // process request without data field
    let ticker, validToken, decimals;

    if (tokenObject) {
        ticker = tokenObject.symbol;
        validToken = true;
    } else {

        try {
            ticker = await token.methods.symbol().call({data: '0x1'}); // ticker
            console.log(`"symbol" ticker: ${ticker}`)
            validToken = true;
        } catch (e) {
            console.error('error getting token symbol');
        }

        if (!ticker) { // retry with another node
            if (rpcMap.has(`${chain}2`)) {
                const rpc2 = rpcMap.get(`${chain}2`);
                const web3provider = new Web3(rpc2);
                const token2 = new web3provider.eth.Contract(ERC20, contractAddress);
                try {
                    ticker = await token2.methods.symbol().call({data: '0x1'}); // ticker
                    console.log(`"2nd token symbol" ticker: ${ticker}`)
                    validToken = true;
                } catch (e) {
                    console.error('error getting token  symbol 2nd try');
                }
            }
        }

        if (!ticker) {
            try {
                ticker = await token.methods.ticker().call({data: '0x1'}); // ticker
                console.log(`"ticker" ticker: ${ticker}`)
                validToken = true;
            } catch (e) {
                // console.error(e);
            }
        }

        if (!ticker) {
            try {
                const tokenNonStd = new web3.eth.Contract(ERC20n, contractAddress);
                const symbol32 = await tokenNonStd.methods.symbol().call({data: '0x1'}); // ticker
                ticker = (web3.utils.hexToAscii(symbol32)).replaceAll(String.fromCharCode(0), '')
                console.log(`"bytes32" ticker: ${ticker}`)
                validToken = true;
            } catch (e) {
                // console.error(e);
                validToken = false;
                ticker = 'unknown';
            }
        }
    }

    try {
        decimals = await token.methods.decimals().call({data: '0x1'}); // decimals
    } catch (e) {
        decimals = 18;
    }

    // getting price from 3rd party API - may have limits on number of requests
    let priceObj = {
        price: 0,
        USD: 0
    };

    if (validToken) {

        try {
            const apiAddress = `https://api-data.absolutewallet.com/api/v1/currencies/minimal/${chain}/${contractAddress}?fiat=USD`;
            const req = await axios(apiAddress);
            priceObj = req.data;
        } catch (e) {
            // console.error(e);
        }
       
        if (priceObj.price === 0) { // || ticker === 'VET') {

            try {
                const req = (await axios(`https://min-api.cryptocompare.com/data/price?fsym=${ticker}&tsyms=USD`));
                priceObj = req.data;
            } catch (e) {
                console.error(e);
            }
        }

        if (tokenObject && tokenObject.price !== '0.00') {
            priceObj['price'] = Number(tokenObject.price);
            console.log(`[ES] ${ticker} price : ${priceObj['price']}`);
        }
    }
    
    return {
        address: contractAddress,
        ticker,
        valid: validToken,
        decimals: Number(decimals) || 18,
        price: priceObj['price'] ?? priceObj['USD'] ?? 0,
        logo: priceObj.logo
    }
}

/**
 * Retrieves the balance of a given address for a specific token.
 *
 * @param {Token} token - The token contract instance.
 * @param {string} address - The address for which to retrieve the balance.
 * @param {number} iteration - Limit number of retries .
 * @return {Promise<number>} A promise that resolves to the balance of the address.
 */
async function getBalanceOf (token, address, iteration){
    // console.log(`getBalance: ${address} | ${iteration}`);
    if (iteration > 1) return -1;

    const timeout = 4000;

    const task = token.methods.balanceOf(address).call({data: '0x1'}).catch(async () => {
        // console.error(`balanceOf error: ${token._requestManager._provider.clientUrl} | ${address} | ${iteration}`);
        return await getBalanceOf(token, address, ++iteration);
    })

    const waitPromise = sleep(timeout);
    return  Promise.race([waitPromise, task]);
}


/**
 * Distributes tasks to workers in a round-robin fashion.
 * @async
 * @function distributeTasks
 * @param {Array} workers - An array of worker objects.
 * @param {Array} contractList - An array of contract objects to be distributed.
 * @returns {Promise<Array>} - A promise that resolves to an array of completed tasks.
 */
async function distributeTasks(workers, contractList) {
    const taskQueue = [...contractList]; // Copy of the original tasks array.
    const completedTasks = [];

    async function processTask() {
        if (taskQueue.length === 0) {
            return;
        }

        // while (taskQueue.length > 0) {
        // Find the first available worker.
        const availableWorkerIndex = await findAvailableWorker(workers);
        if (availableWorkerIndex !== -1) {

            // Assign the next task to the available worker.
            const task = taskQueue.shift();
            if (!task) return;
            // console.log(`Processing: ${task}`);
            const worker = workers[availableWorkerIndex];
            // console.log(`at: ${worker.token._requestManager._provider.clientUrl}`);

            const result = executeTask(worker, task);

            result.then((taskResult) => {
                if (taskResult === -1) {
                    // Task failed, reassign it to the next available worker.
                    console.log(`Reassigning task: ${task}`);
                    taskQueue.push(task);
                } else {
                    completedTasks.push({address: task, balance: taskResult});
                }

                // Process the next task.
                processTask();
            });
        }
        // }
    }

    while (taskQueue.length || !getWorkersStatus(workers)) {
        // console.log(completedTasks.length);
        await processTask();
        await sleep(50);
    }

    // console.log(`Completed: ${completedTasks.length}`);

    // return await Promise.all(completedTasks);
    return completedTasks;
}

function getWorkersStatus(workers) {
    for (let worker of workers) {
        if (worker.isBusy && !worker.isDead) {
            // console.log(`Busy worker: ${worker.token._requestManager._provider.clientUrl} | ${worker.isBusy} | ${worker.isDead}`);
            return false;
        }
    }

    // check if all workers dead
    let flag = false;
    for (let worker of workers) {
        if (!worker.isDead) {
            flag = true;
            break;
        }
    }

    // if all workers dead - reset them
    if (!flag) {
        console.log('All workers are DEAD - resetting...');
        for (let worker of workers) {
            worker.isDead = false;
        }
        return false;
    }

    return true;
}

async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(-1), ms);
    });
}

/**
 * Finds the index of the first available worker in an array of worker objects.
 * @async
 * @function findAvailableWorker
 * @param {Array} workers - An array of worker objects.
 * @returns {Promise<number>} - A promise that resolves to the index of the first available worker.
 */
async function findAvailableWorker(workers) {
    return new Promise((resolve) => {
        const checkAvailability = () => {
            const index = workers.findIndex(worker => !(worker.isBusy || worker.isDead));

            if (index !== -1) {
                resolve(index);
            } else {
                setTimeout(checkAvailability, 10); // Check again in 100 milliseconds.
            }
        };

        checkAvailability();
    });
}


/**
 * Executes a task by assigning it to a worker and getting the balance of an Ethereum address using the worker's token.
 * @async
 * @function executeTask
 * @param {Object} worker - A worker object.
 * @param {string} address - An Ethereum address.
 * @returns {Promise<number>} - A promise that resolves to the balance of the Ethereum address.
 */
async function executeTask(worker, address) {
    return new Promise((resolve) => {
        worker.isBusy = true;
        // console.time(`getBalances: ${worker.token._requestManager._provider.clientUrl} ${address}`);
        getBalanceOf(worker.token, address, 0)
            .then((balance) => {
                // console.log(`balance: ${balance}`);
                if (balance < 0) {
                    worker.isDead = true;
                    resolve(balance);
                    console.error(`dead worker: ${worker.token._requestManager._provider.clientUrl}`);
                    return;
                }
                worker.isBusy = false;
                // console.timeEnd(`getBalances: ${worker.token._requestManager._provider.clientUrl} ${address}`);
                resolve(balance);
            });
    });
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
    const workers = [];

    if (chain === 'eth') {
        for (const rpc of ethRpcArray) {
            const web3provider = new Web3(rpc);
            workers.push({token: new web3provider.eth.Contract(ERC20, tokenObject.address), isBusy: false, isDead: false});
        }
    } else {
        workers.push({token: new web3.eth.Contract(ERC20, tokenObject.address), isBusy: false, isDead: false});
    }

    const balances = await distributeTasks(workers, contractList);
    // console.dir(balances);

    const records = []


    // format acquired balances
    for (let i = 0; i < balances.length; i++) {
        if (balances[i].balance > 0n) {
            const balanceBN = new BigNumber(balances[i].balance.toString());
            const powerBN = new BigNumber(`1e${tokenObject.decimals}`);
            const amountBN = balanceBN.div(powerBN);
            const amount = amountBN.toNumber();

            // const amount = Number(balances[i].balance / BigInt(Number(`1e${tokenObject.decimals}`)))
            const dollarValue = numberWithCommas(amount * tokenObject.price)
            records.push({
                amount: BigInt(balances[i].balance),
                roundedAmount: amount,
                dollarValue,
                contract: balances[i].address
            })
        }
    }

    // sort from max to min
    records.sort(function(a, b) {return b.roundedAmount - a.roundedAmount})

    return records
}


/**
 * Processes a single token by getting its information, finding its balances, and formatting the results.
 * @async
 * @function processOneToken
 * @param {Object} web3 - A Web3.js instance.
 * @param {Array} contractList - An array of contract objects.
 * @param {string} tokenAddress - The address of the token to be processed.
 * @param {Object} token - Token info got from Etherscan
 * @returns {Promise<Object>} - A promise that resolves to an object containing the processed token information.
 */
async function processOneToken(web3, contractList, tokenAddress, token) {
    const tokenObject = await getTokenInfo(web3, tokenAddress, token);

    let localList = [...contractList];

    if (!tokenObject.valid) {
        return {
            tokenAddress,
            price: 0,
            decimals: 18,
            ticker: null,
            records: []
        }
    }

    const results = await findBalances(web3, localList, tokenObject);

    // check if contract has extract or burn/mint functions    
    let contractCode = await getContractCode(tokenAddress);
    const exObj = await findExtractInContract(tokenAddress, contractCode);
    
    return {
        tokenAddress,
        ticker: tokenObject.ticker,
        decimals: tokenObject.decimals,
        price: tokenObject.price,
        logo: tokenObject.logo,
        hasExtract: exObj.functions.length > 0,
        hasBurnMint: exObj.burnMint,
        records: results
    }
}


/**
 * Formats the result of a token balance check.
 * @function formatTokenResult
 * @param {Object} res - An object containing the result of a token balance check.
 * @param {boolean} excludeList - Exclude some contracts from lost.
 * @param {boolean} excludeMint - Exclude some contracts from lost.
 * @param {boolean} excludeExtract - Exclude some contracts from lost.
 * @returns {Object} - An object containing the formatted result string and the value in dollars.
 */
function formatTokenResult(res, excludeList = true, excludeMint = true, excludeExtract = true) {
    let localStr = ''

    if (!res.ticker) { // invalid token
        return { resStr : `??? [${res.tokenAddress}] - unknown token\n`, asDollar: 0, amount: 0 }
    }

    if (res.price === -1) { // can't get price
        return { resStr : `${res.ticker} [${res.tokenAddress}]: not checked - no price found\n`, asDollar: 0, amount: 0 }
    }

    // normal process
    let sum = 0n
    const powerBN = new BigNumber(`1e${res.decimals}`);

    // records already sorted by value - formatting output
    for (const record of res.records) {
        let prefix = '';
        const amountN = (typeof record.amount === 'string') ? BigInt(record.amount) : record.amount;
        if ((record.exclude && excludeList) || (res.hasExtract && excludeExtract) || (res.hasBurnMint && excludeMint) ) {
            prefix = '[X] ';
        } else {
            sum += amountN;// BigInt(record.amount);
        }

        const balanceBN = new BigNumber(record.amount);
        const amountBN = balanceBN.div(powerBN);
        const amount = amountBN.toNumber();

        // const amount = Number(balances[i].balance / BigInt(Number(`1e${tokenObject.decimals}`)))
        const dollarValue = numberWithCommas(amount * res.price)

        // const str = `Contract ${prefix}${record.contract} => ${numberWithCommas(record.roundedAmount)} ${res.ticker} ( $${record.dollarValue} )`
        const str = `Contract ${prefix}${record.contract} => ${numberWithCommas(amount, 5)} ${res.ticker} ( $${dollarValue} )`
        localStr += str + '\n'
    }

    // increasing sum value
    const sumBN = new BigNumber(sum.toString());
    const roundedAmount = sumBN.div(powerBN).toNumber();
    const asDollar = roundedAmount * res.price

    const header = `${res.ticker} [${res.tokenAddress}]: ${numberWithCommas(roundedAmount, 5)} tokens lost / $${numberWithCommas(asDollar)}`
    localStr = header + '\n-----------------------------------------------\n' + localStr

    return { resStr: localStr, asDollar, amount: roundedAmount }
}

function loadExcludes() {
    const res = new Map();
    const excludesArray = require(path.resolve(__dirname + '/excludes.json'));
    for (let item of excludesArray) {
        const key = item[0].toLowerCase();
        const values = item[1].map((val) => val.toLowerCase());
        res.set(key, values);
    }
    return res;
}

async function saveContractAbi(address, abi) {
    const fileName = `${address.toLowerCase()}.abi`;
    
    if (abi.length) {
        const ret = [];
        // filter - get only function names
        for (let element of abi) {
            if (element['type'] === 'function') {
                ret.push(element['name'].toLowerCase());
            }
        }
        await fsAsync.writeFile(path.resolve(__dirname + '/abi_full', fileName), JSON.stringify(abi), 'utf8');
        await fsAsync.writeFile(path.resolve(__dirname + '/abi_functions', fileName), JSON.stringify(ret), 'utf8');
    } else {
        await fsAsync.writeFile(path.resolve(__dirname + '/abi_full', fileName), '[]', 'utf8');
        await fsAsync.writeFile(path.resolve(__dirname + '/abi_functions', fileName), '[]', 'utf8');
    }
}

async function getContractAbi(address) {
    const fileName = `${address.toLowerCase()}.abi`;
    try {
        const res = await fsAsync.readFile(path.resolve(__dirname + '/abi_functions', fileName), 'utf8');
        return JSON.parse(res);
    } catch (e) {
         // no file
    }
}

async function getContractCode(address) {
    const fileName = `${address.toLowerCase()}.sol`;
    try {
        const res = await fsAsync.readFile(path.resolve(__dirname + '/contracts', fileName), 'utf8');
        return res; //JSON.parse(res);
    } catch (e) {
         // no file
    }
}

async function saveContractCode(address, sol) {
    const fileName = `${address.toLowerCase()}.sol`;

    if (sol) {
        const ret = [];
        // filter - get only function names
        // for (let element of abi) {
        //     if (element['type'] === 'function') {
        //         ret.push(element['name'].toLowerCase());
        //     }
        // }
        await fsAsync.writeFile(path.resolve(__dirname + '/contracts', fileName), sol, 'utf8');
        // await fsAsync.writeFile(path.resolve(__dirname + '/abi_functions', fileName), JSON.stringify(ret), 'utf8');
    } else {
        // await fsAsync.writeFile(path.resolve(__dirname + '/abi_full', fileName), '[]', 'utf8');
        await fsAsync.writeFile(path.resolve(__dirname + '/contracts', fileName), JSON.stringify({}), 'utf8');
    }
}

function findContractBlocks(code) {
    const blocks = [];
    let startIndex = 0;
    let endIndex = 0;

    while (startIndex < code.length) {
        // Find the start of a contract
        startIndex = code.indexOf('\ncontract ', startIndex);
        if (startIndex === -1) break;

        // Find the corresponding opening brace '{'
        endIndex = code.indexOf('{', startIndex);
        if (endIndex === -1) break;

        // Initialize a counter for braces to match correctly
        let braceCount = 1;
        let currentIndex = endIndex + 1;

        // Loop until we find the closing brace
        while (braceCount > 0 && currentIndex < code.length) {
            if (code[currentIndex] === '{') {
                braceCount++;
            } else if (code[currentIndex] === '}') {
                braceCount--;
            }
            currentIndex++;
        }

        // If we matched all braces, push the block into the array
        if (braceCount === 0) {
            blocks.push(code.substring(startIndex, currentIndex));
        }

        // Move startIndex forward for the next search
        startIndex = currentIndex;
    }

    return blocks;
}

// Function to find all functions containing .transfer( in a contract block
function findTransferFunctions(contractBlocks) {
    const transferFunctions = [];

    for (const block of contractBlocks) {
        const lines = block.split('\n');
        const functions = [];

        let functionName = '';
        let functionBody = '';
        let isInFunction = false;
        let isMintFunction = false;
        let isBurnFunction = false;

        for (const line of lines) {
            // Check if it's the start of a function
            if (line.includes('function ') && !line.includes(' transfer(')) {

                if (line.includes(' burn')) isBurnFunction = true;
                if (line.includes(' mint')) isMintFunction = true;
                // If we were already inside a function, save the previous one
                if (isInFunction) {
                    // Only push if the function body contains .transfer( and not super.transfer(
                    if (functionBody.includes('.transfer(') && !functionBody.includes('super.transfer(') && !functionBody.includes('owner.transfer(')) {
                        functions.push({ name: functionName, body: functionBody.trim() });
                    }
                }

                // Reset for the new function
                functionName = line.split('function ')[1].split('(')[0].trim();
                functionBody = line;
                isInFunction = true;
            } else if (isInFunction) {
                // Continue building the function body
                functionBody += `\n${line}`;
            }

            // Check if we reached the end of the function
            if (isInFunction && line.includes('}')) {
                // Only push if the function body contains .transfer( and not super.transfer(
                if (functionBody.includes('.transfer(') && !functionBody.includes('super.transfer(') && !functionBody.includes('owner.transfer(')) {
                    functions.push({ name: functionName, body: functionBody.trim() });
                }
                isInFunction = false; // Reset
                functionName = '';
                functionBody = '';
            }
        }

        if (functions.length > 0 || (isBurnFunction && isMintFunction)) {
            transferFunctions.push({
                contract: block.split(' ')[1].trim(),
                functions: functions,
                burnMint: isBurnFunction && isMintFunction
            });
        }
    }

    return transferFunctions;
}

async function findExtractInContract(address, contract) {
    // const headers = 'address;contract;function;burn-mint\n'
    
    const contractBlocks = findContractBlocks(contract);
    const transferFunctions = findTransferFunctions(contractBlocks);

    let retObj = {
        address,
        contracts: [],
        functions: [],
        burnMint: false
    }
    
    transferFunctions.forEach(({ contract, functions, burnMint }) => {
        retObj.contracts.push(contract);
        if (burnMint) retObj.burnMint = true;
        functions.forEach(func => {
            retObj.functions.push(func.name);
        });
    });
    
    return retObj;
}


module.exports = {
    getTokenInfo,
    getBalanceOf,
    findBalances,
    processOneToken,
    formatTokenResult,
    parseAddress,
    numberWithCommas,
    loadExcludes,
    getContractAbi,
    saveContractAbi,
    saveContractCode,
    getContractCode,
    findExtractInContract
}