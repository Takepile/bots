const ethers = require('ethers');
const config = require('./config');

const TAKEPILE_DRIVER_ABI = require('./abi/TakepileDriver.json');
const TAKEPILE_TOKEN_ABI = require('./abi/TakepileToken.json');
const LIQUIDATION_PASS_ABI = require('./abi/LiquidationPass.json');

const DRIVER_ADDRESS = '0x852f6355e54de53E67f351472B650e1043A3d4cf';

(async () => {
  const provider = new ethers.providers.JsonRpcProvider('https://rpc.testnet.fantom.network/');
  const wallets = config.privateKeys.map((privateKey) => {
    return new ethers.Wallet(privateKey, provider);
  });

  const getLogs = async (address, abi, fromBlock, toBlock) => {
    const interface = new ethers.utils.Interface(abi);
    const filter = { address, fromBlock, toBlock };
    const logs = await provider.getLogs(filter);
    const decodedLogs = logs.map((log) => {
      try {
        return Object.assign(log, interface.parseLog(log));
      } catch { }
    });
    return decodedLogs;
  };

  const getPileLogs = async (address, fromBlock = 0, toBlock = undefined) => {
    return getLogs(address, TAKEPILE_TOKEN_ABI, fromBlock, toBlock);
  };

  const getDriverLogs = async (address, fromBlock = 0, toBlock = undefined) => {
    return getLogs(address, TAKEPILE_DRIVER_ABI, fromBlock, toBlock);
  };

  /**
   * Get all Takepiles created by driver
   * @returns
   */
  const getPiles = async () => {
    const driver = new ethers.Contract(DRIVER_ADDRESS, TAKEPILE_DRIVER_ABI, provider);
    const takepileCreatedFilter = driver.filters.TakepileCreated(null, null, null);
    const takepileCreatedEvents = await driver.queryFilter(takepileCreatedFilter);
    const takepiles = takepileCreatedEvents.map((e) => {
      return {
        address: e.args[0],
        name: e.args[1],
        symbol: e.args[2],
      };
    });
    return takepiles;
  };

  /**
   *
   * @param {*} pileAddress
   * @param {*} fromBlock
   * @param {*} toBlock
   * @param {*} existingPositions
   * @returns
   */
  const getLiquidatablePositions = async (
    pileAddress,
    fromBlock = 0,
    toBlock = undefined,
    existingPositions = null
  ) => {
    const pileToken = new ethers.Contract(pileAddress, TAKEPILE_TOKEN_ABI, provider);

    // Get logs since genesis
    const pileLogs = await getPileLogs(
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
  const processLiquidations = async () => {
    try {
      console.log(`[${new Date().toISOString()}] Processing Liquidations`);

      const driver = new ethers.Contract(DRIVER_ADDRESS, TAKEPILE_DRIVER_ABI, provider);
      const liquidationPassAddress = await driver.liquidationPass();
      const liquidationPass = new ethers.Contract(
        liquidationPassAddress,
        LIQUIDATION_PASS_ABI,
        provider
      );

      // Check wallets liquidation pass balance and native balance
      for (const wallet of wallets) {
        const passBalance = (await liquidationPass.balanceOf(wallet.address)).toNumber();
        const nativeBalance = ethers.utils.formatUnits(await provider.getBalance(wallet.address), 18);
        console.log(`${wallet.address} has ${passBalance} pass(es), Native balance ${nativeBalance}`);
      }

      // Send liq pass from wallet 0 to 1
      // const lpass = new ethers.Contract(liquidationPassAddress, LIQUIDATION_PASS_ABI, wallets[0]);
      // await lpass.transferFrom(wallets[0].address, wallets[1].address, 1);

      // Get all available piles from Driver contract
      const piles = await getPiles();

      for (const pile of piles) {
        const [positions, liquidatable] = await getLiquidatablePositions(pile.address, 9030000);
        console.log(`${pile.name} ${liquidatable.length}`);
        if (liquidatable.length) {
          for (const l of liquidatable) {
            console.log(`Liquidatable!`, JSON.stringify(l));
            for (const wallet of wallets) {
              try {
                // if ((await ask(`Attempt with ${wallet.address}? `)) != 'y') continue;
                console.log(`Attempting liquidation with ${wallet.address}`);
                const pileToken = new ethers.Contract(l.pileAddress, TAKEPILE_TOKEN_ABI, wallet);
                const tx = await pileToken.liquidate(l.who, l.symbol);
                await tx.wait();
                console.log(`Success!`);
                break;
              } catch (err) {
                console.log(`Liquidation failed with ${wallet.address}`);
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
   *
   * @param {*} pileAddress
   * @param {*} fromBlock
   * @param {*} toBlock
   * @returns
   */
  const getLimitOrders = async (pileAddress, fromBlock = 0, toBlock = undefined) => {
    const pileToken = new ethers.Contract(pileAddress, TAKEPILE_TOKEN_ABI, provider);

    // Get logs since genesis
    const pileLogs = await getPileLogs(
      pileToken.address, // pile token
      fromBlock,
      toBlock
    );

    const limitOrderMap = {};

    // Get open positions from logs
    for (const log of pileLogs) {
      if (log.name == 'LimitOrderSubmitted') {
        const [who, symbol, amount, collateral, isLong, limitPrice, index, deadline] = log.args;
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
  const processLimitOrders = async () => {
    try {
      console.log(`[${new Date().toISOString()}] Processing Limit Orders`);

      // Check wallets liquidation pass balance and native balance
      for (const wallet of wallets) {
        const nativeBalance = ethers.utils.formatUnits(await provider.getBalance(wallet.address), 18);
        console.log(`${wallet.address} native balance: ${nativeBalance}`);
      }

      // Get all available piles from Driver contract
      const piles = await getPiles();

      for (const pile of piles) {
        const limitOrders = await getLimitOrders(pile.address);
        const markets = [...new Set(limitOrders.map((o) => o.symbol))];
        const pileToken = new ethers.Contract(pile.address, TAKEPILE_TOKEN_ABI, provider);

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
          // TODO: there is currently a bug for decrease limit orders, it only specifies takeprofit
          // so for now just attempting everything
          order.isTriggerable = true;
        }

        console.log(`Processing ${limitOrders.length} Limit orders`);

        // Iterate over limit orders and trigger
        for (const order of limitOrders) {
          if (order.isTriggerable) {
            console.log(`Triggering limit order:`);
            console.log(`${order.who} ${order.symbol} ${order.index}`);
            const contract = new ethers.Contract(pile.address, TAKEPILE_TOKEN_ABI, wallets[0]);
            try {
              await contract.triggerLimitOrder(order.who, order.symbol, order.index);
            } catch (err) {
              console.log(`Trigger failed:`, err?.error?.reason);
            }
          }
        }
      }
    } catch (err) {
      console.log(`Processing limit orders failed: ${err.message}`);
    }
  };

  await processLimitOrders();
  await processLiquidations();

  setInterval(async () => {
    console.log(`[${new Date().toISOString()}] Processing`);
    await processLimitOrders();
    await processLiquidations();
  }, 1000 * 60 * 5); // Every 5 minutes

})();
