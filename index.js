const fs = require('fs');
const path = require('path');
const { Web3 } = require('web3');
require('dotenv').config();

const { numberWithCommas, parseAddress, processOneToken, formatTokenResult, loadExcludes,
    getContractAbi, saveContractAbi, getContractCode, saveContractCode, findExtractInContract } = require('./functions');
const { getEtherscanApiPrices, getEtherscanContractAbi, getEtherscanContractCode } = require('./etherscan');
const excludedMap = loadExcludes();

const EXCLUDE_BY_LIST = process.env.EXCLUDE_BY_LIST !== 'false';
const EXCLUDE_BY_MINT = process.env.EXCLUDE_BY_MINT !== 'false';
const EXCLUDE_BY_EXTRACT = process.env.EXCLUDE_BY_EXTRACT !== 'false';
const ETHERSCAN = process.env.ETHERSCAN !== 'false';
const RESULTS = process.env.RESULTS || '';

// NOTE default tokens and contracts list moved to const.js file
const { tokens, contracts, rpcMap } = require('./const');
const {promises: fsAsync} = require("fs");
const chains = [...rpcMap.keys()];

// NOTE: // default: 'eth_tokens_list.txt' // w/o zero price = 'tokens_list.txt'; // fast test = 'tokens_list_short.txt';
const TOKENS_FILE = process.env.TOKENS_FILE || 'eth_tokens_list.txt';
// NOTE: // default: 'eth_contracts_list.txt' // w/o zero price = 'excluded_tokens.txt'; // fast test = 'tokens_list_short.txt';
const CONTRACTS_FILE = process.env.CONTRACTS_FILE || 'eth_tokens_list.txt';
const COLLECT_EXTRACT = process.env.COLLECT_EXTRACT !== 'false';

// main ()
(async () => {
    console.log('use excludes: ', EXCLUDE_BY_LIST, EXCLUDE_BY_MINT, EXCLUDE_BY_EXTRACT);
    
    let fromEtherscan; // map()
    let etherscanList = '';
    if (ETHERSCAN) {
        fromEtherscan = await getEtherscanApiPrices();
        let prefix = '';
        let counter = 0;

        const extractFileName= 'contracts_with_extract.csv';
        if (COLLECT_EXTRACT) {
            const headers = 'address;contract;function;burn-mint\n'
            await fs.writeFileSync(path.resolve(__dirname + '/out', extractFileName), headers, 'utf8');
        }
        
        for (const address of fromEtherscan.keys()) { // Using the default iterator (could be `map.entries()` instead)
            
            // test new functions with one token
            // if (address.toLowerCase() !== '0x3405a1bd46b85c5c029483fbecf2f3e611026e45') continue;
            
            etherscanList += prefix + address;
            prefix = '\n';
            counter++;
            
            let abi = await getContractCode(address);
            if (!abi) {
                abi = await getEtherscanContractCode(address);
                await saveContractCode(address, abi);
                // process.exit(1);
            }

            if (COLLECT_EXTRACT) {
                const exObj = await findExtractInContract(address, abi);
                if (exObj.burnMint || exObj.contracts.length) {
                    const outStr = [
                        exObj.address,
                        exObj.contracts.join(' | '),
                        exObj.functions.join(' | '),
                        exObj.burnMint ? 'yes' : ''
                    ].join(';') + '\n';
                    
                    fs.appendFileSync(path.resolve(__dirname + '/out', extractFileName), outStr, 'utf8');
                }
            }
        }
        console.log(`Contracts found on Etherscan: ${counter}`);
    }
    
    // can provide active chain via env var.
    // list of supported predefined chains in rpcMap const.
    const chain = (process.env.CHAIN || chains[0]).toLowerCase();
    const rpc = rpcMap.get(chain);

    // can use any of supported chains
    const web3provider = new Web3(rpc);

    // get default tokens and contracts for current chain
    const chainTokensStr = tokens[chain].join('\n');
    const chainContractsStr = contracts[chain].join('\n');

    // add tokens from text file
    let parsed;
    let parsedContracts;
    if (chain === 'eth') {
        const tokensFromFile = ETHERSCAN ? etherscanList : fs.readFileSync(path.resolve(__dirname + '/in', TOKENS_FILE), 'utf8');
        parsed = parseAddress(web3provider, tokensFromFile) + '\n' + chainTokensStr;

        const contractsFromFile = ETHERSCAN ? etherscanList : fs.readFileSync(path.resolve(__dirname + '/in', CONTRACTS_FILE), 'utf8');
        parsedContracts = parseAddress(web3provider, contractsFromFile) + '\n' + chainContractsStr;
    } else {
        parsed = chainTokensStr;
        parsedContracts = chainContractsStr;
    }

    console.time('getBalances');

    // process tokens - find lost balances
    let chainTokens = parsed.split('\n');
    chainTokens = Array.from(new Set(chainTokens));
    const chainContracts = parsedContracts.split('\n');

    console.log(`Tokens: ${chainTokens.length}`);
    console.log(`Contracts: ${chainContracts.length}`);

    const contractListArray = Array.from(new Set(chainContracts.concat(chainTokens)));
    console.log(`Addresses: ${contractListArray.length}`);

    let resultsArray = [];
    let wholeSum = 0;
    let counter = 0;

    if (!RESULTS) {

        for (const tokenAddress of chainTokens) {
            console.time('getOneBalance');
            const token = fromEtherscan.get(tokenAddress.toLowerCase());
            const res = await processOneToken(web3provider, contractListArray, tokenAddress, token);

            const formatted = formatTokenResult(res);

            wholeSum += formatted.asDollar;
            resultsArray.push({
                ...res,
                asDollar: formatted.asDollar,
                amount: formatted.amount
            });

            counter++;
            console.log(counter, '.', res.ticker, ':', formatted.asDollar);
            console.timeEnd('getOneBalance');
            console.log('');
        }

    } else {
        resultsArray = require(path.resolve(__dirname + '/' + RESULTS));
        // for (const res of resultsArray) {
        //     const formatted = formatTokenResult(res);
        //     res.asDollar = formatted.asDollar;
        //     res.amount = formatted.amount;
        // }
    }

    if (EXCLUDE_BY_LIST) {
        // mark excluded results
        for (const res of resultsArray) {
            const tokenAddress = res.tokenAddress.toLowerCase();
            if (excludedMap.has(tokenAddress)) {
                const excluded = excludedMap.get(tokenAddress);
                for (let item of res.records) {
                    if (excluded.includes(item.contract.toLowerCase())) {
                        item.exclude = true;
                    }
                }
            }
        }
    }

    for (const res of resultsArray) {
        const formatted = formatTokenResult(res);
        res.asDollar = formatted.asDollar;
        res.amount = formatted.amount;
    }

    resultsArray.sort(function (a, b) {
        return b.asDollar - a.asDollar;
    });

    wholeSum = 0;
    counter = 0;
    let resStr = '';
    for (const res of resultsArray) {
        const formatted = formatTokenResult(res, EXCLUDE_BY_LIST, EXCLUDE_BY_MINT, EXCLUDE_BY_EXTRACT);
        resStr += formatted.resStr + '\n';
        wholeSum += formatted.asDollar;
        counter++;
    }

    resStr = `WHOLE SUM: $${numberWithCommas(wholeSum)} for ${counter} tokens\n\n` + resStr;

    console.timeEnd('getBalances');

    fs.writeFileSync(path.resolve(__dirname + '/out', 'lost_tokens_result.txt'), resStr, 'utf8');
    fs.writeFileSync(path.resolve(__dirname + '/out', 'lost_tokens_result.json'), JSON.stringify(resultsArray, (_, v) => typeof v === 'bigint' ? v.toString() : v), 'utf8');
    process.exit(0);
})();