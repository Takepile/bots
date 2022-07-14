
const EventEmitter = require('events');
const ethers = require('ethers');
const TakepileBot = require('./takepile-bot');

const TAKEPILE_DRIVER_ABI = require('../abi/TakepileDriver.json');
const TAKEPILE_TOKEN_ABI = require('../abi/TakepileToken.json');
const LIQUIDATION_PASS_ABI = require('../abi/LiquidationPass.json');

class LiquidationBot extends TakepileBot {

  constructor(config) {
    super(config);
    this.interval = config.interval;
    this.fromBlock = config.fromBlock;
  }

  /**
   *
   * @param {*} pileAddress
   * @param {*} fromBlock
   * @param {*} toBlock
   * @param {*} existingPositions
   * @returns
   */
  async getLiquidatablePositions(
    pileAddress,
    fromBlock = 0,
    toBlock = undefined,
    existingPositions = null
  ) {
    const pileToken = new ethers.Contract(pileAddress, TAKEPILE_TOKEN_ABI, this.provider);

    // Get logs since genesis
    const pileLogs = await this.getPileLogs(
      pileToken.address, // pile token
      fromBlock,
      toBlock
    );

    const positions = existingPositions || {};

    // Get open positions from logs
    for (const log of pileLogs) {
      if (log.name === 'IncreasePosition') {
        const [who, symbol, amount, newAmount, isLong, price, fees] = log.args;
        if (!(symbol in positions)) positions[symbol] = {};
        positions[symbol][who] = {
          amount: newAmount.toString(),
          price: price.toString(),
          isLong,
        };
      } else if (log.name === 'DecreasePosition') {
        const [who, symbol, amount, newAmount, isLong, price, reward, fees] = log.args;
        if (newAmount == 0) {
          delete positions[symbol][who];
        } else {
          positions[symbol][who] = {
            amount: newAmount.toString(),
            price: price.toString(),
            isLong,
          };
        }
      }
    }

    const liquidatable = [];
    // Iterate over open positions and get health factor
    for (const symbol in positions) {
      for (const who in positions[symbol]) {
        const healthFactor = await pileToken.getHealthFactor(who, symbol);
        positions[symbol][who].healthFactor = healthFactor.toString();
        positions[symbol][who].isLiquidatable = healthFactor.gt(ethers.utils.parseUnits('1', 18));
        if (positions[symbol][who].isLiquidatable) {
          liquidatable.push({
            pileAddress,
            who,
            symbol,
          });
        }
      }
    }

    return [positions, liquidatable];
  };

  /**
   * V1 Liquidation Bot
   * Get liquidatable positions and attempt to process them
   */
  async processLiquidations() {
    try {
      console.log(`[${new Date().toISOString()}] Processing Liquidations`);

      const driver = new ethers.Contract(this.driverAddress, TAKEPILE_DRIVER_ABI, this.provider);
      const liquidationPassAddress = await driver.liquidationPass();
      const liquidationPass = new ethers.Contract(
        liquidationPassAddress,
        LIQUIDATION_PASS_ABI,
        this.provider
      );

      // Check wallets liquidation pass balance and native balance
      for (const wallet of this.wallets) {
        const passBalance = (await liquidationPass.balanceOf(wallet.address)).toNumber();
        const nativeBalance = ethers.utils.formatUnits(await this.provider.getBalance(wallet.address), 18);
        console.log(`${wallet.address} has ${passBalance} pass(es), Native balance ${nativeBalance}`);
      }

      // Send liq pass from wallet 0 to 1
      // const lpass = new ethers.Contract(liquidationPassAddress, LIQUIDATION_PASS_ABI, wallets[0]);
      // await lpass.transferFrom(wallets[0].address, wallets[1].address, 1);

      // Get all available piles from Driver contract
      const piles = await this.getPiles();

      for (const pile of piles) {
        const [positions, liquidatable] = await this.getLiquidatablePositions(pile.address, this.fromBlock);
        console.log(`${pile.name} ${liquidatable.length}`);
        if (liquidatable.length) {
          for (const l of liquidatable) {
            console.log(`Liquidatable!`, JSON.stringify(l));
            for (const wallet of wallets) {
              try {
                console.log(`Attempting liquidation with ${wallet.address}`);
                const pileToken = new ethers.Contract(l.pileAddress, TAKEPILE_TOKEN_ABI, wallet);
                const tx = await pileToken.liquidate(l.who, l.symbol);
                await tx.wait();
                console.log(`Success!`);
                break;
              } catch (err) {
                console.log(`Liquidation failed with ${wallet.address}`);
                console.log(err);
              }
            }
          }
        }
      }
    } catch (err) {
      console.log(`Processing liquidations failed: ${err.message}`);
    }
  };


  /**
   * Start Limit Order Process
   */
  async start() {
    await this.processLiquidations();

    setInterval(async () => {
      await this.processLiquidations();
    }, this.interval || 1000 * 60 * 5);

  }
}

module.exports = LiquidationBot;