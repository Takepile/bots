
require('dotenv').config()

module.exports = {
  privateKeys: process.env.PRIVATE_KEYS.split(','),
  rpcUrl: 'https://rpc.testnet.fantom.network/',
  driverAddress: '0x852f6355e54de53E67f351472B650e1043A3d4cf',
  interval: 1000 * 60 * 5, // 5 minutes
  fromBlock: 9030000
};