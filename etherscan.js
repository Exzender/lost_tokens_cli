const axios = require('axios');
const API_KEY = process.env.ETHERSCAN_KEY || 'no key';

const getEtherscanApiPrices = async () => {
    console.log('Starting parsing etherscan');
    const ret = new Map();
    
    try {
        const res = await axios('https://api.dex223.io/v1/etherscan/');

        const json = res.data;
        for (let o of Object.keys(json)) {
            ret.set(o, json[o]);
        }
    } catch (e) {
        // no results
    }
    
    return ret;
}

async function getEtherscanContractAbi(address) {
    try {
        const res = await axios(`https://api.etherscan.io/api?module=contract&action=getabi&address=${address}&apikey=${API_KEY}`);
        const json = res.data;
        if (json.status === '1') {
            return  JSON.parse(json.result);
        }
        
        return [];
    } catch (e) {
        // no results
        return [];
    }
}

async function getEtherscanContractCode(address) {
    try {
        const res = await axios(`https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${API_KEY}`);
        const json = res.data;
        
        function extractSources(textOb) {
            let out = '';
            for (let src of Object.keys(textOb)) {
                out += `// ${src}\n`;
                out += textOb[src].content + '\n\n';
            }
            return out;
        }
        
        if (json.status === '1') {
            const contractData = json.result[0];
            // console.dir(contractData);
            
            const sol =  contractData['SourceCode'];

            if (sol.indexOf('"sources":') === -1) {
                if (sol.indexOf('"content":') === -1) {
                    return sol;
                } else {
                    return extractSources(JSON.parse(sol));
                }
            } else {
                const s = sol.substring(1,sol.length-1);
                // console.log(s);
                const ob = JSON.parse(s);
                if (ob.sources) {
                    console.log(address);
                    return extractSources(ob.sources);
                }
            }
        }
        
        return [];
    } catch (e) {
        // no results
        return [];
    }
}

module.exports = { getEtherscanApiPrices, getEtherscanContractAbi, getEtherscanContractCode };          