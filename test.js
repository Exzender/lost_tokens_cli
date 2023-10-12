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
            price: 1
        };

        const result = await getTokenInfo(web3provider, contractAddress);
        result.price = 1;

        assert.deepStrictEqual(result, expectedTokenInfo);
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

// describe('processOneToken', () => {
//     it('should process one token and return result', async () => {
//         // Mock web3 instance and contractList
//         const web3 = new Web3(rpc);
//         const contractList = ['0xabcdef123456789', '0x987654321fedcba'];
//         const tokenAddress = '0x123456789abcdef';
//         const expectedTokenResult = {
//             tokenAddress: '0x123456789abcdef',
//             ticker: 'TEST',
//             decimals: 18,
//             price: 10,
//             records: [
//                 {
//                     amount: '1000000000000000000',
//                     roundedAmount: 1,
//                     dollarValue: '10',
//                     contract: '0xabcdef123456789'
//                 },
//                 {
//                     amount: '2000000000000000000',
//                     roundedAmount: 2,
//                     dollarValue: '20',
//                     contract: '0x987654321fedcba'
//                 }
//             ]
//         };
//
//         const result = await processOneToken(web3, contractList, tokenAddress);
//
//         assert.deepStrictEqual(result, expectedTokenResult);
//     });
// });

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
            "asDollar": 100000000000000000000,
            "resStr": `TEST [0x123456789abcdef]: 10,000,000,000,000,000,000 tokens lost / $100,000,000,000,000,000,000
-----------------------------------------------
Contract 0xabcdef123456789 => 1 TEST ( $10 )
Contract 0x987654321fedcba => 2 TEST ( $20 )
`};

        const result = formatTokenResult(tokenResult);

        assert.deepStrictEqual(result, expectedFormattedResult);
    });
});

