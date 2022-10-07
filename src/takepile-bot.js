
const EventEmitter = require('events');
const ethers = require('ethers');

const TAKEPILE_TOKEN_ABI = require('../abi/TakepileTokenV2.json');

class TakepileBot extends EventEmitter {

  constructor(config) {
    super();
    this.driverAddress = config.driverAddress;
    this.gasPrice = config.gasPrice;
    this.gasLimit = config.gasLimit;
    this.takepiles = config.takepiles;
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
    return this.takepiles;
  }


}

module.exports = TakepileBot;
