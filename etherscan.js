const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const async = require('async');
const xpath = require('xpath');
const { DOMParser } = require('@xmldom/xmldom');

class ExampleSpider {
    constructor(concurrency) {
        this.array = new Map();
        this.name = "etherscan";
        this.processing = true;
        this.baseURL = "https://etherscan.io/tokens?ps=100&p=1";
        this.headers = {
            Host: "etherscan.io",
            Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,uk;q=0.6",
            "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
        };
        this.queue = async.queue(async (task, completed) => {
            const { url, method = "GET", callback } = task;
            try {
                const response = await fetch(url, {
                    method: method,
                    headers: this.headers,
                });
                if (!response.ok)
                    throw new Error(`HTTP error! Status: ${response.status}`);
                // const data = await response;
                if (response) {
                    callback(response); // Call callback with data if successful
                } else {
                    throw new Error("No data returned from fetch.");
                }
            } catch (error) {
                console.error(error.message);
                callback(error, null);
            }
            completed();
        }, concurrency);

    }

    async startRequests() {
        this.fetchPage(this.baseURL, "GET", this.parse);
    }

    fetchPage(url, method = "GET", callback) {
        this.queue.push({ url, method, callback });
    }

    getProcessing() {
        return this.processing;
    }

    getArray() {
        return this.array;
    }

    parse = async (response) => {
        // const page = xpath.fromPageSource(await response.text());
        const tree = new DOMParser({
            locator: {},
            errorHandler: {
                warning: function (w) {},
                error: function (e) {},
                fatalError: function (e) {
                    console.error(e);
                },
            },
        }).parseFromString(`${await response.text()}`);
        // const page = xpath.select("//h1/text()", tree)[0].data;
        // console.log(tree);
        const rows = xpath.select(
            "//div[@id='ContentPlaceHolder1_tblErc20Tokens']//tbody/tr",
            tree
        );
        // console.log(rows.length);
        rows.forEach((row) => {
            const rank = xpath.select("descendant::td[1]/text()", row)[0].data;
            const contract = xpath
                .select("descendant::td[2]/a/@href", row)[0]
                .value.split("/")
                .pop();
            const name = xpath.select("descendant::td[2]/a/div/div/text()", row)[0]
                .data;
            const symbol = xpath
                .select("descendant::td[2]/a/div/span/text()", row)[0]
                .data.replace("(", "")
                .replace(")", "");
            const price = xpath
                .select("descendant::td[4]//text()", row)[0]
                .data.trim()
                .replace("$", "")
                .replace(",", "");
            const obj = { rank, name, symbol, price };
            // console.log(obj);
            this.array.set(contract.toLowerCase(), obj);
        });

        const nextHrefElements = xpath.select(
            '//nav[@aria-label="Table navigation"]//a[@aria-label="Next"]/@href',
            tree
        );
        // console.log("Next href elements found:", nextHrefElements.length); // Debug the count of found elements

        if (nextHrefElements.length > 0) {
            const nextHref = nextHrefElements[0].value;
            if (nextHref) {
                console.log(`https://etherscan.io/${nextHref}`);
                this.fetchPage(`https://etherscan.io/${nextHref}`, "GET", this.parse);
            }
        } else {
            this.processing = false;
        }
    };
}

async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(-1), ms);
    });
}

// Запускаем скрапер
const getEtherscanPrices = async () => {
    console.log('Starting parsing etherscan');
    const spider = new ExampleSpider(10);
    await spider.startRequests();
    while (spider.getProcessing()) {
        await sleep(500);
    }
    console.log('Etherscan parsing finished');
    return spider.getArray();
}

module.exports = { getEtherscanPrices };