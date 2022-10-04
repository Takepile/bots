
require('dotenv').config()

module.exports = {
  privateKeys: process.env.PRIVATE_KEYS.split(','),
  // Testnet
  // rpcUrl: 'https://rpc.testnet.fantom.network/',
  // driverAddress: '0x852f6355e54de53E67f351472B650e1043A3d4cf',
  // Mainnet
  rpcUrl: 'https://rpc.ftm.tools/',
  driverAddress: '0x5e0A8377E3df9A2b487BfCdA22828234E5800FF7',
  interval: 1000 * 60 * 5,
  fromBlock: 46000000,
  gasPrice: 10000000000,
  gasLimit: 9900000
};