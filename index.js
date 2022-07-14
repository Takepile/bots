

const config = require('./config');

const LiquidationBot = require('./src/liquidation-bot');
const LimitOrderBot = require('./src/limit-order-bot');

const liquidationBot = new LiquidationBot(config);
const limitOrderBot = new LimitOrderBot(config);

liquidationBot.start();
limitOrderBot.start();