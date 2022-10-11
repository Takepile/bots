
const EventEmitter = require('events');
const ethers = require('ethers');
const TakepileBot = require('./takepile-bot');
const JsonDB = require('simple-json-db');

const TAKEPILE_TOKEN_ABI = require('../abi/TakepileToken.json');

class LimitOrderBot extends TakepileBot {

  constructor(config) {
    super(config);
    this.interval = config.interval;
    this.fromBlock = config.fromBlock;
    this.maxTriggerAttempts = config.maxTriggerAttempts || 1;
    this.db = new JsonDB('limit-db.json', {});

  }

  /**
   *
   * @param {*} pileAddress
   * @param {*} fromBlock
   * @param {*} toBlock
   * @returns
   */
  async getLimitOrders(pileAddress, fromBlock = 0, toBlock = undefined) {
    const pileToken = new ethers.Contract(pileAddress, TAKEPILE_TOKEN_ABI, this.provider);

    // Get logs since genesis
    const pileLogs = await this.getPileLogs(
      pileToken.address, // pile token
      fromBlock,
      toBlock
    );

    const limitOrderMap = {};

    // Get open positions from logs
    for (const log of pileLogs) {
      if (log.name == 'LimitOrderSubmitted') {
        const [who, symbol, amount, collateral, isLong, limitPrice, stopLoss, index, deadline] = log.args;
        if (!(symbol in limitOrderMap)) limitOrderMap[symbol] = {};
        if (!(who in limitOrderMap[symbol])) limitOrderMap[symbol][who] = [];
        limitOrderMap[symbol][who][index.toNumber()] = {
          pileAddress,
          who,
          symbol,
          amount: amount.toString(),
          collateral: collateral.toString(),
          isLong: isLong,
          limitPrice: limitPrice.toString(),
          stopLoss: stopLoss.toString(),
          index: index.toNumber(),
          deadline: new Date(deadline.toNumber() * 1000),
        };
      } else if (log.name == 'LimitOrderCancelled') {
        const [who, symbol, index] = log.args;
        delete limitOrderMap[symbol][who][index.toNumber()];
      } else if (log.name == 'LimitOrderTriggered') {
        const [who, symbol, index] = log.args;
        delete limitOrderMap[symbol][who][index.toNumber()];
      }
    }

    let limitOrders = [];
    for (const symbol in limitOrderMap) {
      for (const who in limitOrderMap[symbol]) {
        limitOrders = [...limitOrders, ...limitOrderMap[symbol][who].filter((x) => !!x)];
      }
    }

    return limitOrders;
  };

  /**
   *
   */
  async processLimitOrders() {
    try {
      console.log(`[${new Date().toISOString()}] Processing Limit Orders`);

      // Check wallets liquidation pass balance and native balance
      for (const wallet of this.wallets) {
        const nativeBalance = ethers.utils.formatUnits(await this.provider.getBalance(wallet.address), 18);
        console.log(`${wallet.address} native balance: ${nativeBalance}`);
      }

      // Get all available piles from Driver contract
      const piles = await this.getPiles();

      for (const pile of piles) {
        const limitOrders = await this.getLimitOrders(pile.address, this.fromBlock);
        const markets = [...new Set(limitOrders.map((o) => o.symbol))];
        const pileToken = new ethers.Contract(pile.address, TAKEPILE_TOKEN_ABI, this.provider);

        // Get prices
        const prices = {};
        for (const symbol of markets) {
          prices[symbol] = await pileToken.getLatestPrice(symbol);
        }

        // Preliminary checks to ensure limit order is triggerable
        for (const order of limitOrders) {
          const price = prices[order.symbol];
          order.marketPrice = price.toString();
          if (order.isLong) {
            order.isTriggerable = price.lte(ethers.BigNumber.from(order.limitPrice));
          } else {
            order.isTriggerable = price.gte(ethers.BigNumber.from(order.limitPrice));
          }
          if (new Date().getTime() > order.deadline.getTime()) {
            order.isTriggerable = false;
          }
          // order.isTriggerable = order.who !== '0x3cc01c28320c3Babd6F200aB9b61755CBB030317';
          order.isTriggerable = true;
        }

        console.log(`Processing ${limitOrders.length} Limit orders`);

        // Iterate over limit orders and trigger
        for (const order of limitOrders) {
          const orderId = order.deadline.getTime();
          const count = JSON.parse(this.db.get(orderId) || 0);
          if (order.isTriggerable) {
            const contract = new ethers.Contract(pile.address, TAKEPILE_TOKEN_ABI, this.wallets[0]);
            try {
              if (count > this.maxTriggerAttempts) {
                console.log('Exceeds maximum trigger attempt count, skipping');
                continue;
              }
              console.log(`Triggering limit order:`);
              const tx = await contract.triggerLimitOrder(order.who, order.symbol, order.index,
                {
                  gasPrice: this.gasPrice,
                  gasLimit: this.gasLimit,
                }
              );
              await tx.wait();
              console.log(`Limit order triggered successfully`);
            } catch (err) {
              console.log(`Trigger failed:`, err?.error?.reason);
              this.db.set(orderId, JSON.stringify(count + 1));
            }
          }
        }
      }
    } catch (err) {
      console.log(`Processing limit orders failed: ${err.message}`);
    }
  };

  /**
   * Start Limit Order Process
   */
  async start() {
    await this.processLimitOrders();

    setInterval(async () => {
      await this.processLimitOrders();
    }, this.interval || 1000 * 60 * 5);

  }
}

module.exports = LimitOrderBot;