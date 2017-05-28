#!/usr/bin/env /usr/local/bin/node

const bitbar = require("bitbar");
const getExchangeRates = require("get-exchange-rates");
const bittrex = require("node.bittrex.api");
const table = require("text-table");
const jsonfile = require('jsonfile');

const config = require("./config");

const FONT = 'Fira Code';
const SIZE = 13;
//color
const COLOR_GREY = '#848484';
const COLOR_WHITE = '#dcdee0';

let arrayBitBar = [{
    text: "🤑",
    dropdown: false
},
bitbar.sep]

var totalInBTC = 0;
var coins = {}

var old = jsonfile.readFileSync(config.cache, { throws: false })
if (!old) old = {}

getExchangeRates().then(rates => {
    if (config.platforms.hasOwnProperty("bittrex")) {
        bittrex.options({
            apikey: config.platforms.bittrex.key,
            apisecret: config.platforms.bittrex.secret,
            stream: false,
            verbose: false,
            cleartext: false
        });

        return new Promise((resolve, reject) => {
            bittrex.getbalances(dataBalances => {
                var balances = dataBalances.result
                bittrex.getmarketsummaries(dataMarkets => {
                    var markets = dataMarkets.result
                    balances.forEach(balance => {
                        let market = markets.find(m => m.MarketName === "BTC-" + balance.Currency)
                        coins[balance.Currency] = {
                            name: balance.Currency,
                            qtyCur: balance.Balance,
                            avgBuy: 0,
                            qtyBuy: 0,
                            lastBuy: 0,
                            lastQty: 0,
                            sellOrder: 0,
                            sellQty: 0,
                            price: 1,
                            bid: 1,
                            ask: 1,
                            volume: 0,
                            prev: 1,
                            high: 0,
                            low: 0
                        }
                        if (balance.Currency !== "BTC") {
                            coins[balance.Currency].price = market.Bid
                            coins[balance.Currency].bid = market.Bid
                            coins[balance.Currency].ask = market.Ask
                            coins[balance.Currency].volume = market.BaseVolume
                            coins[balance.Currency].prev = market.PrevDay
                            coins[balance.Currency].high = market.High
                            coins[balance.Currency].low = market.Low
                        }
                    })

                    bittrex.getorderhistory({}, dataOrders => {
                        var orders = dataOrders.result.reverse()

                        orders.forEach(order => {
                            let coin = coins[order.Exchange.split("-")[1]]
                            let qty = order.Quantity - order.QuantityRemaining
                            if (order.OrderType.includes("BUY")) {
                                coin.avgBuy = (coin.qtyBuy * coin.avgBuy + qty * order.PricePerUnit) / (coin.qtyBuy + qty)
                                coin.qtyBuy += qty
                                coin.lastBuy = order.PricePerUnit
                                coin.lastQty = qty
                            }
                            else {
                                coin.sellOrder = order.PricePerUnit
                                coin.sellQty = qty
                            }
                        })

                        bittrex.getopenorders({}, dataOpened => {
                            var opened = dataOpened.result.reverse()
                            opened.forEach(open => {
                                let coin = coins[open.Exchange.split("-")[1]]
                                if (open.OrderType.includes("SELL")) {
                                    coin.sellOrder = open.Limit
                                    coin.sellQty = open.QuantityRemaining
                                }
                            })

                            if (!old.coins) {
                                old.coins = coins
                            }

                            var res = []
                            res.push(["Currency", "Evo", "24h %", "Price", "Qty"])

                            var sub = []
                            sub.push([])

                            let sorted = Object.values(coins).sort((c1, c2) => {
                                let val = c2.qtyCur * c2.price - c1.qtyCur * c1.price
                                if (val === 0) {
                                    let c1Per = 100 * ((c1.price - c1.prev) / c1.prev)
                                    let c2Per = 100 * ((c2.price - c2.prev) / c2.prev)
                                    return c2Per - c1Per
                                }
                                return val
                            })

                            sorted.forEach(coin => {
                                totalInBTC += parseFloat(coin.price * coin.qtyCur);
                                let percent = 100 * ((coin.price - coin.prev) / coin.prev)
                                let char = getChar(old.coins[coin.name].price, coin.price)

                                res.push([coin.name, char, percent.toFixed(2) + " %", coin.price.toFixed(8) + " ₿", (coin.price * coin.qtyCur).toFixed(8) + " ₿"])
                                sub.push([
                                    [coin.name],
                                    ["Price", coin.price.toFixed(8) + " ₿"],
                                    ["<=>", (coin.price / rates.BTC).toFixed(2) + " €"],
                                    ["Bid", coin.bid.toFixed(8) + " ₿"],
                                    ["Ask", coin.ask.toFixed(8) + " ₿"],
                                    ["Stats"],
                                    ["Volume", coin.volume.toFixed(2) + " ₿"],
                                    ["24h %", percent.toFixed(2) + " %"],
                                    ["24h High", coin.high.toFixed(8) + " ₿"],
                                    ["24h Low", coin.low.toFixed(8) + " ₿"],
                                    ["Available"],
                                    ["Qty", coin.qtyCur.toFixed(2) + "  "],
                                    ["===", (coin.price * coin.qtyCur).toFixed(8) + " ₿"],
                                    ["<=>", (coin.price * coin.qtyCur / rates.BTC).toFixed(2) + " €"],
                                    ["Last Buy"],
                                    ["Price", coin.lastBuy.toFixed(8) + " ₿"],
                                    ["Qty", coin.lastQty.toFixed(2) + "  "],
                                    ["===", (coin.lastQty * coin.lastBuy).toFixed(8) + " ₿"],
                                    ["<=>", (coin.lastQty * coin.lastBuy / rates.BTC).toFixed(2) + " €"],
                                    ["P\\L", ((coin.price - coin.lastBuy) / coin.lastBuy * 100).toFixed(2) + " %"],
                                    ["===", (coin.price * coin.lastQty - coin.lastBuy * coin.lastQty).toFixed(8) + " ₿"],
                                    ["<=>", ((coin.price * coin.lastQty - coin.lastBuy * coin.lastQty) / rates.BTC).toFixed(2) + " €"],
                                    ["Sell Order"],
                                    ["Price", coin.sellOrder.toFixed(8) + " ₿"],
                                    ["Qty", coin.sellQty.toFixed(2) + "  "],
                                    ["===", (coin.sellQty * coin.sellOrder).toFixed(8) + " ₿"],
                                    ["<=>", (coin.sellQty * coin.sellOrder / rates.BTC).toFixed(2) + " €"],
                                    ["P\\L", ((coin.sellOrder - coin.lastBuy) / coin.lastBuy * 100).toFixed(2) + " %"],
                                    ["===", (coin.sellOrder * coin.sellQty - coin.lastBuy * coin.sellQty).toFixed(8) + " ₿"],
                                    ["<=>", ((coin.sellOrder * coin.sellQty - coin.lastBuy * coin.sellQty) / rates.BTC).toFixed(2) + " €"],
                                    ["Buy Avg"],
                                    ["Price", coin.avgBuy.toFixed(8) + " ₿"],
                                    ["Qty", coin.qtyBuy.toFixed(2) + "  "],
                                    ["===", (coin.qtyBuy * coin.avgBuy).toFixed(8) + " ₿"],
                                    // ["<=>", (coin.qtyBuy * coin.avgBuy / rates.BTC).toFixed(2) + " €"],
                                    ["P\\L", ((coin.price - coin.avgBuy) / coin.avgBuy * 100).toFixed(2) + " %"]
                                    // ["===", (coin.price * coin.qtyBuy - coin.avgBuy * coin.qtyBuy).toFixed(8) + " ₿"],
                                    // ["<=>", ((coin.price * coin.qtyBuy - coin.avgBuy * coin.qtyBuy) / rates.BTC).toFixed(2) + " €"]
                                ])
                            })

                            let lines = table(res, { align: ['l', 'c', 'r', 'l', 'l'] }).split("\n")
                            arrayBitBar.push({
                                text: lines[0],
                                color: COLOR_GREY,
                                font: FONT,
                                size: SIZE,
                            })

                            for (var i = 1; i < lines.length; i++) {
                                var item = {
                                    text: lines[i],
                                    color: COLOR_WHITE,
                                    font: FONT,
                                    size: SIZE,
                                    submenu: []
                                }
                                var subLines = table(sub[i], { align: ['l', 'r'] }).split("\n")
                                for (var j = 0; j < subLines.length; j++) {
                                    let item2 = {
                                        text: subLines[j],
                                        color: sub[i][j].length === 1 ? COLOR_GREY : COLOR_WHITE,
                                        font: FONT,
                                        size: SIZE
                                    }
                                    if (sub[i][j].length > 1)
                                        item2.refresh = true
                                    item.submenu.push(item2)
                                }
                                arrayBitBar.push(item)
                            }

                            let zeroIndex = sorted.findIndex(c => c.qtyCur === 0)
                            arrayBitBar.splice(zeroIndex + 3, 0, bitbar.sep)

                            resolve(rates);
                        })
                    })
                })
            })
        })
    }
}).then(rates => {

    arrayBitBar[0].text = getChar(old.totalInBTC, totalInBTC, 2) + " " + totalInBTC.toFixed(2) + " ₿"
    arrayBitBar.push(bitbar.sep)

    var priceBtc = 1 / rates.BTC
    var euros = totalInBTC / rates.BTC;
    var real = euros - config.initEur;
    var percentBtc = (totalInBTC - config.initBtc) * 100 / config.initBtc
    var percentEur = real * 100 / config.initEur

    let result = []
    result.push(["1 ₿", getChar(old.priceBtc, priceBtc, 2), priceBtc.toFixed(2) + " €"])
    result.push(["Wallet", getChar(old.totalInBTC, totalInBTC), totalInBTC.toFixed(8) + " ₿"])
    result.push(["<=>", getChar(old.euros, euros, 2), euros.toFixed(2) + " €"])
    result.push(["₿ P\\L", getChar(old.percentBtc, percentBtc, 2), percentBtc.toFixed(2) + " %"])
    result.push(["€ P\\L", getChar(old.percentEur, percentEur, 2), percentEur.toFixed(2) + " %"])
    result.push(["===", getChar(old.real, real, 2), real.toFixed(2) + " €"])
    arrayBitBar.push({
        text: table(result, { align: ['l', 'l', 'r'] }),
        color: COLOR_WHITE,
        font: FONT,
        size: SIZE,
        refresh: true
    });
    bitbar(arrayBitBar);

    let cache = {
        totalInBTC: totalInBTC,
        priceBtc: priceBtc,
        percentBtc: percentBtc,
        euros: euros,
        real: real,
        coins: coins
    }
    jsonfile.writeFileSync(config.cache, cache)

}).catch(e => console.log(e));

function getChar(oldVal, newVal, precision = 8) {
    let char = "≃"
    if (oldVal && oldVal.toFixed(precision) < newVal.toFixed(precision))
        char = "↑"
    else if (oldVal && oldVal.toFixed(precision) > newVal.toFixed(precision))
        char = "↓"
    return char;
}