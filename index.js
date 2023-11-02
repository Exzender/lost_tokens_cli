const fs = require('fs');
const path = require('path');
const { Web3 } = require('web3');

const { numberWithCommas, parseAddress, processOneToken, formatTokenResult } = require('./functions');

// NOTE default tokens and contracts list moved to const.js file
const { tokens, contracts, rpcMap } = require('./const');
const chains = [...rpcMap.keys()];

// NOTE: // default: 'eth_tokens_list.txt' // w/o zero price = 'tokens_list.txt'; // fast test = 'tokens_list_short.txt';
const TOKENS_FILE = process.env.TOKENS_FILE || 'tokens_list_short.txt';
// NOTE: // default: 'eth_contracts_list.txt' // w/o zero price = 'excluded_tokens.txt'; // fast test = 'tokens_list_short.txt';
const CONTRACTS_FILE = process.env.CONTRACTS_FILE || 'eth_tokens_list.txt';

// main ()
(async () => {
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
        const tokensFromFile = fs.readFileSync(path.resolve(__dirname + '/in', TOKENS_FILE), 'utf8');
        parsed = parseAddress(web3provider, tokensFromFile) + '\n' + chainTokensStr;

        const contractsFromFile = fs.readFileSync(path.resolve(__dirname + '/in', CONTRACTS_FILE), 'utf8');
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

    const resultsArray = [];
    let wholeSum = 0;
    let counter = 0;

    for (const tokenAddress of chainTokens) {
        console.time('getOneBalance');
        const res = await processOneToken(web3provider, contractListArray, tokenAddress);

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
    }

    resultsArray.sort(function (a, b) {
        return b.asDollar - a.asDollar;
    });

    let resStr = '';
    for (const res of resultsArray) {
        const formatted = formatTokenResult(res);
        resStr += formatted.resStr + '\n';
    }

    resStr = `WHOLE SUM: $${numberWithCommas(wholeSum)} for ${counter} tokens\n\n` + resStr;

    console.timeEnd('getBalances');

    fs.writeFileSync(path.resolve(__dirname + '/out', 'lost_tokens_result.txt'), resStr, 'utf8');
    fs.writeFileSync(path.resolve(__dirname + '/out', 'lost_tokens_result.json'), JSON.stringify(resultsArray, (_, v) => typeof v === 'bigint' ? v.toString() : v), 'utf8');
})();