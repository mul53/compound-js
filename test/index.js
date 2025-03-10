// Compound.js Tests

// To run all tests: `npm test`
// To run a single file's tests: `npm test -- -g './src/eth.ts'`
// To run a single test: `npm test -- -g 'eth.getBalance'`

// Set up hardhat
const { TASK_NODE_CREATE_SERVER } = require("hardhat/builtin-tasks/task-names");
const hre = require('hardhat');
const ethers = hre.ethers;
let jsonRpcServer; // used to run a localhost fork of mainnet

// Source Files
const api = require('./api.test.js');
const comp = require('./comp.test.js');
const comptroller = require('./comptroller.test.js');
const cToken = require('./cToken.test.js');
const EIP712 = require('./EIP712.test.js');
const eth = require('./eth.test.js');
const gov = require('./gov.test.js');
const priceFeed = require('./priceFeed.test.js');
const util = require('./util.test.js');
const initialize = require('./initialize.test.js');

const mnemonic = hre.network.config.accounts.mnemonic;
const addresses = [];
const privateKeys = [];
for (let i = 0; i < 20; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${i}`);
  addresses.push(wallet.address);
  privateKeys.push(wallet._signingKey().privateKey);
}

let acc = [ addresses, privateKeys ]; // Unlocked accounts with test ETH

// Main test suite
describe('Compound.js', function () {

  before(async () => {
    console.log('Running a hardhat local fork of mainnet...');

    jsonRpcServer = await hre.run(TASK_NODE_CREATE_SERVER, {
      hostname: 'localhost',
      port: 8545,
      provider: hre.network.provider
    });

    await jsonRpcServer.listen();
  });

  beforeEach(async () => {
    await resetForkedChain();
  });

  after(async () => {
    await jsonRpcServer.close();
  });

  describe('./src/api.ts', api.bind(this, acc));
  describe('./src/comp.ts', comp.bind(this, acc));
  describe('./src/comptroller.ts', comptroller.bind(this, acc));
  describe('./src/cToken.ts', cToken.bind(this, acc));
  describe('./src/EIP712.ts', EIP712.bind(this, acc));
  describe('./src/eth.ts', eth.bind(this, acc));
  describe('./src/gov.ts', gov.bind(this, acc));
  describe('./src/priceFeed.ts', priceFeed.bind(this, acc));
  describe('./src/util.ts', util.bind(this, acc));
  describe('initialize', initialize.bind(this, acc));

});

async function resetForkedChain() {
  // Parent directory's hardhat.config.js needs these to be set
  const forkUrl = hre.config.networks.hardhat.forking.url;
  const forkBlockNumber = hre.config.networks.hardhat.forking.blockNumber;
  await hre.network.provider.request({
    method: 'hardhat_reset',
    params: [{
      forking: {
        jsonRpcUrl: forkUrl,
        blockNumber: forkBlockNumber
      }
    }]
  });
}
