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
- `EXCLUDES` (placeholder) - Exclude or not from results some tokens at some contracts, cause they are not losses. `true` by default.
- `RESULTS` (placeholder) - Pass to script previous results of script work without collecting actual values.

## Format of 'Excludes' file

Exclusions (exceptions) - situation when one ERC20 can normally exist on balance of another ERC20 token.
Exclusions list is an array of pairs, where 
 - 1st value - is token *Address*
 - 2nd value - array of *Addresses* of other tokens where 1st token can normally exist.

Actual list of known exceptions: [Token exceptions](https://gist.github.com/Dexaran/7ace3507f3e9f36cdcb56f96b96c6fb2)

## Contacts

[LinkedIn](https://www.linkedin.com/in/aleksandr-s-terekhov/)
