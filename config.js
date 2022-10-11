
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
  fromBlock: 47000000,
  gasPrice: 10000000000,
  gasLimit: 9900000,
  maxTriggerAttempts: 1,
  takepiles: [
    {
      address: "0x9882FBfbC0A632f896B319F76A76a8c6201B7aDC",
      name: "USDB Pile",
      symbol: "pileUSDB",
    },
    {
      address: "0xe031A7189609A8E2A49608237268F1997722b246",
      name: "USDB-10x Pile",
      symbol: "pileUSDB-10x",
    },
    {
      address: "0x7a83f10A19cFe012B0237b57fd27bC813086Db57",
      name: "USDB-25x Pile",
      symbol: "pileUSDB-25x",
    },
    {
      address: "0x23153292a6020BDB237AE4cb60746027C985af07",
      name: "USDB-50x Pile",
      symbol: "pileUSDB-50x",
    },
    {
      address: "0xdad94C25712174D785210209428519174721CCba",
      name: "USDB-200x Pile",
      symbol: "pileUSDB-200x",
    },
    {
      address: "0x530a868332CAbC7e11D382Cc4eb2DF8BD8f0414C",
      name: "FTM Pile",
      symbol: "pileFTM",
    },
    {
      address: "0x60AC53F4E32c508975926F0B9C4bE8c324B4D2e5",
      name: "FTM-10x Pile",
      symbol: "pileFTM-10x",
    },
    {
      address: "0x2C77b86b73c00De08eae115De2ECdF34368ED6b2",
      name: "FTM-25x Pile",
      symbol: "pileFTM-25x",
    },
    {
      address: "0xcDF271bad15E74589680daAa0a012497381f0985",
      name: "DAI-10x Pile",
      symbol: "pileDAI-25x",
    },
    {
      address: "0xD219023E13D69879910ac2484A22fAD2De448198",
      name: "DAI-25x Pile",
      symbol: "pileDAI-25x",
    },
  ]
};