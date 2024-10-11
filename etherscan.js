const axios = require('axios');

const getEtherscanApiPrices = async () => {
    console.log('Starting parsing etherscan');
    const res = await axios('https://api.dex223.io/v1/etherscan/');
    const json = res.data;
    
    const ret = new Map();
    for (let o of Object.keys(json)) {
        ret.set(o, json[o]);        
    }
    
    return ret;
}

module.exports = { getEtherscanApiPrices }; // getEtherscanPrices          