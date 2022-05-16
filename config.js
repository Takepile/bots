
require('dotenv').config()

module.exports =  {
  privateKeys: process.env.PRIVATE_KEYS.split(',')
};