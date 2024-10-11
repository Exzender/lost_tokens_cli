const assert = require('assert');
const { Web3 } = require('web3');
const { rpcMap } = require('./const');
const { getTokenInfo, getBalanceOf, findBalances, formatTokenResult } = require('./functions'); // processOneToken

const rpc = rpcMap.get('eth');

describe('getTokenInfo', () => {
    it('should retrieve token information', async () => {
        // Mock web3 instance
        const web3provider = new Web3(rpc);
        const contractAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // USDC
        const expectedTokenInfo = {
            address: contractAddress,
            ticker: 'USDC',
            valid: true,
            decimals: 6,
            price: 1,
            logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png'

        };

        const token = {
            "rank": 3,
            "name": "USDC",
            "logo": "https://etherscan.io/token/images/centre-usdc_28.png",
            "symbol": "USDC",
            "price": 1,
            "updated": "2024-10-05T01:09:15.356636"
        }
        
        // try {
            const result = await getTokenInfo(web3provider, contractAddress, token);
            console.log(result);
            
            result.price = 1;

            assert.deepStrictEqual(result, expectedTokenInfo);
        // } catch (e) {
        //     console.error(e);
        // }
    });
});

describe('getBalanceOf', () => {
    it('should retrieve balance of an address', async () => {
        // Mock token contract instance
        const token = {
            methods: {
                balanceOf: () => ({
                    call: () => Promise.resolve('1000000000000000000')
                })
            }
        };
        const address = '0xabcdef123456789';
        const expectedBalance = '1000000000000000000';

        const result = await getBalanceOf(token, address);

        assert.strictEqual(result, expectedBalance);
    });
});

describe('findBalances', () => {
    it('should find balances for multiple contracts', async () => {
        // Mock web3 instance and token contract
        const web3 = new Web3(rpc);
        const contractList = ['0x08711d3b02c8758f2fb3ab4e80228418a7f8e39c',
            '0xf7b098298f7c69fc14610bf71d5e02c60792894c',
            '0xb7cb1c96db6b22b0d3d9536e0108d062bd488f74'];
        const tokenObject = {
            address: '0x08711d3b02c8758f2fb3ab4e80228418a7f8e39c',
            ticker: 'EDG',
            valid: true,
            decimals: 0,
            price: 1
        };
        const expectedBalances = [
            {
                "amount": 11527n,
                "contract": "0x08711d3b02c8758f2fb3ab4e80228418a7f8e39c",
                "dollarValue": "11,527",
                "roundedAmount": 11527
            },
            {
                "amount": 5854n,
                "contract": "0xf7b098298f7c69fc14610bf71d5e02c60792894c",
                "dollarValue": "5,854",
                "roundedAmount": 5854
            },
            {
                "amount": 893n,
                "contract": "0xb7cb1c96db6b22b0d3d9536e0108d062bd488f74",
                "dollarValue": "893",
                "roundedAmount": 893
            }];

        const result = await findBalances(web3, contractList, tokenObject);

        assert.deepStrictEqual(result, expectedBalances);
    });
});

describe('formatTokenResult', () => {
    it('should format token result', () => {
        const tokenResult = {
            tokenAddress: '0x123456789abcdef',
            ticker: 'TEST',
            decimals: 18,
            price: 10,
            records: [
                { amount: '1000000000000000000', roundedAmount: 1, dollarValue: '10', contract: '0xabcdef123456789' },
                { amount: '2000000000000000000', roundedAmount: 2, dollarValue: '20', contract: '0x987654321fedcba' } ] };
        const expectedFormattedResult = {
            "amount": 3,
            "asDollar": 30,
            "resStr": `TEST [0x123456789abcdef]: 3 tokens lost / $30
-----------------------------------------------
Contract 0xabcdef123456789 => 1 TEST ( $10 )
Contract 0x987654321fedcba => 2 TEST ( $20 )
`};

        const result = formatTokenResult(tokenResult);
        assert.deepStrictEqual(result, expectedFormattedResult);
    });
});

