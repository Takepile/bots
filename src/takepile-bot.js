
const EventEmitter = require('events');
const ethers = require('ethers');

const TAKEPILE_DRIVER_ABI = require('../abi/TakepileDriver.json');
const TAKEPILE_TOKEN_ABI = require('../abi/TakepileToken.json');
const LIQUIDATION_PASS_ABI = require('../abi/LiquidationPass.json');

class TakepileBot extends EventEmitter {

  constructor(config) {
    super();
    this.driverAddress = config.driverAddress;
    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    this.wallets = config.privateKeys.map((privateKey) => {
      return new ethers.Wallet(privateKey, this.provider);
    });
  }

  /**
   * 
   * @param {*} address 
   * @param {*} abi 
   * @param {*} fromBlock 
   * @param {*} toBlock 
   * @returns 
   */
  async getLogs(address, abi, fromBlock, toBlock) {
    const iface = new ethers.utils.Interface(abi);
    const filter = { address, fromBlock, toBlock };
    const logs = await this.provider.getLogs(filter);
    const decodedLogs = logs.map((log) => {
      try {
        return Object.assign(log, iface.parseLog(log));
      } catch { }
    });
    return decodedLogs;
  }

  /**
   * 
   * @param {*} address 
   * @param {*} fromBlock 
   * @param {*} toBlock 
   * @returns 
   */
  async getPileLogs(address, fromBlock = 0, toBlock = undefined) {
    return this.getLogs(address, TAKEPILE_TOKEN_ABI, fromBlock, toBlock);
  }

  /**
   * Get all Takepiles created by driver
   * @returns
   */
  async getPiles() {
    const driver = new ethers.Contract(this.driverAddress, TAKEPILE_DRIVER_ABI, this.provider);
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
  }


}

module.exports = TakepileBot;
