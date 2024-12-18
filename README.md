# Script for finding lost ERC20 tokens on EVM blockchains 
# (CLI version)

This is an improved version of script introduced by @Dexaran [ERC20_losses](https://dexaran.github.io/erc20_losses/)

Read more in Dexaran's article: [Known problems of ERC-20 token standard](https://dexaran820.medium.com/known-problems-of-erc20-token-standard-e98887b9532c)

Full processing of *1238* ERC20 tokens currently listed on CMC may take up to *4 hrs*.

## Running locally

Install the app's dependencies:

```bash
npm install
```

Set up your local environment variables by copying the example into your own `.env` file:

```bash
cp .env.local.example .env
```

Your `.env` now contains the following environment variables:

- `CHAIN` (placeholder) - Blockchain ticker - where to search for losses. `eth` by default
- `EXCLUDE_BY_LIST` (placeholder) - Exclude or not from results some manually selected contracts. `true` by default.
- `EXCLUDE_BY_MINT` (placeholder) - Exclude or not from results some contracts, having BURN and MINT functions. `true` by default.
- `EXCLUDE_BY_EXTRACT` (placeholder) - Exclude or not from results some contracts, possibly having Extract function. `true` by default.
- `RESULTS` (placeholder) - Pass to script previous results of script work without collecting actual values.
- `ETHERSCAN` (placeholder) - Flag to use etherscan scanner to get actual tokens list and their prices. `true` by default.
- `ETHERSCAN_KEY` (placeholder) - API key to query requests to Etherscan - for checking smart-contracts code.
- `COLLECT_EXTRACT` (placeholder) - Collect contract codes from Etherscan and store them locally.

Start app:

```bash
npm start
```

Results in **OUT** folder:
- `lost_tokens_result.json` - unsorted JSON version maybe used for further used. **Rewrites on each run!**   
- `lost_tokens_result.txt` - human-readable sorted results

## Format of 'Excludes' file

Exclusions (exceptions) - situation when one ERC20 can normally exist on balance of another ERC20 token.

Exclusions (exceptions) listed in `excludes.json` file

Exclusions list is an array of pairs, where 
 - 1st value - is token *Address*
 - 2nd value - array of *Addresses* of other tokens where 1st token can normally exist.

Actual list of known exceptions: [Token exceptions](https://gist.github.com/Dexaran/7ace3507f3e9f36cdcb56f96b96c6fb2)

## Contacts

[LinkedIn](https://www.linkedin.com/in/aleksandr-s-terekhov/)
