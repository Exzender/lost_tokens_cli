const eth_tokens = [
    '0xdac17f958d2ee523a2206206994597c13d831ec7' // USDT
    // '0xB8c77482e45F1F44dE1745F52C74426C631bDD52', // BNB
    // '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
    // '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
    // '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0', // MATIC
    // '0x3883f5e181fccaf8410fa61e12b59bad963fb645',
    // '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
]

const eth_contracts = [
    '0x6bba316c48b49bd1eac44573c5c871ff02958469',
    // '0x80fB784B7eD66730e8b1DBd9820aFD29931aab03',
    // '0x4a220e6096b25eadb88358cb44068a3248254675',
    // '0x622dFfCc4e83C64ba959530A5a5580687a57581b',
    // '0x543ff227f64aa17ea132bf9886cab5db55dcaddf',
    // '0x8a854288a5976036a725879164ca3e91d30c6a1b'
]

const bsc_tokens = [
    '0xad29abb318791d579433d831ed122afeaf29dcfe', // FTM
    '0x55d398326f99059ff775485246999027b3197955', // USDT
    '0x4B0F1812e5Df2A09796481Ff14017e6005508003', // TWT
    '0xe9e7cea3dedca5984780bafc599bd69add087d56', // BUSD
    '0xba2ae424d960c26247dd6c32edc70b295c744c43', // DOGE
    '0x12BB890508c125661E03b09EC06E404bc9289040', // RACA
    '0x76a797a59ba2c17726896976b7b3747bfd1d220f', // TON
    '0x603c7f932ED1fc6575303D8Fb018fDCBb0f39a95', // BANANA
    '0xf21768ccbc73ea5b6fd3c687208a7c2def2d966e', // REEF
    '0x6810e776880c02933d47db1b9fc05908e5386b96'  // [invalid] token
]

const bsc_contracts = [
    '0xad29abb318791d579433d831ed122afeaf29dcfe'
]

const polygon_tokens = [
    '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
    '0x3a3df212b7aa91aa0402b9035b098891d276572b', // FISH
]

const polygon_contracts = [
    '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
]

// export const contracts
const contracts = {
    eth: eth_contracts,
    bsc: bsc_contracts,
    polygon: polygon_contracts
}

// export const tokens
const tokens = {
    eth: eth_tokens,
    bsc: bsc_tokens,
    polygon: polygon_tokens
}

// export const rpcMap
const rpcMap = new Map([
    ['eth', 'https://rpc.mevblocker.io'], // https://eth.meowrpc.com'], // 'https://ethereum.publicnode.com'], // 'https://eth.llamarpc.com' // https://rpc.eth.gateway.fm
    ['eth2', 'https://eth.meowrpc.com'],
    ['bsc', 'https://binance.llamarpc.com'],
    ['polygon', 'https://polygon.llamarpc.com']
])

const ethRpcArray = [
    'https://eth.meowrpc.com', // 0:40
    // 'https://eth.meowrpc.com', // 0:40
    // 'https://eth.meowrpc.com', // 0:40
    // 'https://eth.meowrpc.com', // 0:40
    // 'https://eth.meowrpc.com', // 0:40
    // 'https://eth.meowrpc.com', // 0:40
    // 'https://eth.meowrpc.com', // 0:40
    'https://rpc.mevblocker.io', // 0:40
    'https://rpc.mevblocker.io', // 0:40
    'https://rpc.mevblocker.io', // 0:40
    // 'https://rpc.mevblocker.io', // 0:40
    // 'https://rpc.mevblocker.io', // 0:40
    // 'https://rpc.mevblocker.io', // 0:40
    // 'https://rpc.mevblocker.io', // 0:40
    'https://ethereum.blockpi.network/v1/rpc/public', // 0:40
    'https://ethereum.blockpi.network/v1/rpc/public', // 0:40
    // 'https://ethereum.blockpi.network/v1/rpc/public', // 0:40
    // 'https://ethereum.blockpi.network/v1/rpc/public', // 0:40
    // 'https://ethereum.blockpi.network/v1/rpc/public', // 0:40
    // 'https://ethereum.blockpi.network/v1/rpc/public', // 0:40
    'https://eth.drpc.org', // 0:40  // disabled
    // 'https://eth.drpc.org', // 0:40  // disabled
    // 'https://eth.drpc.org', // 0:40  // disabled
    'https://eth-pokt.nodies.app',  // 1:10
    'https://eth-pokt.nodies.app',  // 1:10
    'https://eth.llamarpc.com', // 1:50 // disabled
    // 'https://eth.llamarpc.com', // 1:50 // disabled
    'https://ethereum.publicnode.com', // 1:57
    'https://ethereum.publicnode.com', // 1:57

    'https://eth-mainnet.public.blastapi.io', // bad
    'https://eth-mainnet.public.blastapi.io', // bad
    // 'https://eth-mainnet.public.blastapi.io', // bad
    'https://rpc.payload.de', // bad // disabled
    'https://1rpc.io/eth', // 1:06 (with errors) // disabled
    'https://rpc.ankr.com/eth', // bad // disabled
    // 'https://core.gashawk.io/rpc', // timeout // disabled
    'https://api.securerpc.com/v1', // bad // disabled
    'https://cloudflare-eth.com', // bad // disabled

    // 'https://rpc.eth.gateway.fm',    // bad // disabled x2
    // 'https://api.zmok.io/mainnet/oaen6dy8ff6hju9k',  // bad // disabled x2
    // 'https://uk.rpc.blxrbdn.com',    // bad // disabled x2
    // 'https://virginia.rpc.blxrbdn.com',  // bad // disabled x2
    // 'https://singapore.rpc.blxrbdn.com', // bad // disabled x2
    // 'https://eth.api.onfinality.io/public', // bad // disabled x2
    // 'https://eth-mainnet-public.unifra.io', // bad // disabled x2
    // 'https://mainnet.gateway.tenderly.co', // bad // disabled x2
]

// export const ERC20
const ERC20 = [{"constant":true,"inputs":[],"name":"ticker","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"}]
const ERC20n = [{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"bytes32"}],"payable":false,"type":"function"}]

module.exports = { ERC20, ERC20n, rpcMap, tokens, contracts, ethRpcArray }