import { ethers } from 'ethers';

enum JsonRpc {
  EthSendTransaction,
  EthCall,
  // NetVersion,
}

interface CallOptions {
  _compoundProvider?: any;
  abi?: string | object[];
  provider?: any;
  network?: string;
  from?: number | string;
  gas?: number;
  gasPrice?: number;
  gasLimit?: number;
  value?: number | string;
  data?: number | string;
  chainId?: number;
  nonce?: number;
  privateKey?: string;
  mnemonic?: string;
  // blockNumber?: string;
  // id?: number;
}

/**
 * This is a generic method for invoking JSON RPC's `eth_call` or `eth_send` 
 *     with ethers.js. This function supports the public `read` and `trx`
 *     methods in this module.
 *
 * @param {boolean} isWrite True for `eth_send` and false for `eth_call`.
 * @param {string} address The Ethereum address the transaction is directed to.
 * @param {string} method The smart contract member in which to invoke.
 * @param {any[]} [parameters] Parameters of the method to invoke.
 * @param {CallOptions} [options] Options to set for `eth_call`, optional ABI
 *     (as JSON object), and ethers.js method overrides. The ABI can be a string
 *     of the single intended method, an array of many methods, or a JSON object
 *     of the ABI generated by a Solidity compiler.
 *
 * @returns {Promise<any>} Return value of the invoked smart contract member 
 *     or an error object if the call failed.
 */
function _ethJsonRpc(
  jsonRpcMethod: JsonRpc,
  address: string,
  method: string,
  parameters: any[] = [],
  options: CallOptions = {}
): Promise<any> {
  return new Promise<any>((resolve: Function, reject: Function) => {
    const provider = options._compoundProvider || createProvider(options);

    const overrides = {
      gasPrice: options.gasPrice,
      nonce: options.nonce,
      value: options.value,
      chainId: options.chainId,
      from: options.from,
      gasLimit: options.gasLimit,
    };

    parameters.push(overrides);

    let contract;
    let abi: any;
    if (options.abi) {
      // Assumes `method` is a string of the member name
      // Assumes `abi` is a JSON object
      abi = options.abi;
      contract = new ethers.Contract(address, abi, provider);
    } else {
      // Assumes `method` is a string of the member definition
      abi = [ method ];
      contract = new ethers.Contract(address, abi, provider);
      method = Object.keys(contract.functions)[1];
    }

    if (jsonRpcMethod === JsonRpc.EthSendTransaction) {
      contract[method].apply(null, parameters).then((result) => {
        resolve(result);
      }).catch((error) => {
        try { delete parameters[parameters.length-1].privateKey } catch(e) {}
        reject({
          message: 'Error occurred during [eth_sendTransaction]. See {error}.',
          error,
          method,
          parameters,
        });
      });
    } else if (jsonRpcMethod === JsonRpc.EthCall) {
      contract.callStatic[method].apply(null, parameters).then((result) => {
        resolve(result);
      }).catch((error) => {
        try { delete parameters[parameters.length-1].privateKey } catch(e) {}
        reject({
          message: 'Error occurred during [eth_call]. See {error}.',
          error,
          method,
          parameters,
        });
      });
    }
  });
}

/**
 * This is a generic method for invoking JSON RPC's `eth_call` with ethers.js. 
 *     Use this method to execute a smart contract's constant or non-constant 
 *     member without using gas. This is a read-only method intended to read a 
 *     value or test a transaction for valid parameters. It does not create a 
 *     transaction on the block chain.
 *
 * @param {string} address The Ethereum address the transaction is directed to.
 * @param {string} method The smart contract member in which to invoke.
 * @param {any[]} [parameters] Parameters of the method to invoke.
 * @param {CallOptions} [options] Options to set for `eth_call`, optional ABI
 *     (as JSON object), and ethers.js method overrides. The ABI can be a string
 *     of the single intended method, an array of many methods, or a JSON object
 *     of the ABI generated by a Solidity compiler.
 *
 * @returns {any} Return value of the invoked smart contract member or an error 
 *     object if the call failed.
 */
export function read(
  address: string,
  method: string,
  parameters: any[] = [],
  options: CallOptions = {}
) : Promise<any> {
  return _ethJsonRpc(JsonRpc.EthCall, address, method, parameters, options);
}

/**
 * This is a generic method for invoking JSON RPC's `eth_sendTransaction` with 
 *     ethers.js. Use this method to create a transaction that invokes a smart 
 *     contract method. Returns an ethers.js `TransactionResponse` object.
 *
 * @param {string} address The Ethereum address the transaction is directed to.
 * @param {string} method The smart contract member in which to invoke.
 * @param {any[]} [parameters] Parameters of the method to invoke.
 * @param {CallOptions} [options] Options to set for `eth_sendTransaction`, 
 *     (as JSON object), and ethers.js method overrides. The ABI can be a string
 *     optional ABI of the single intended method, an array of many methods, or 
 *     a JSON object of the ABI generated by a Solidity compiler.
 *
 * @returns {any} Returns an ethers.js `TransactionResponse` object or an error 
 *     object if the transaction failed.
 */
export function trx(
  address: string,
  method: string,
  parameters: any[] = [],
  options: CallOptions = {}
) : Promise<any> {
  return _ethJsonRpc(JsonRpc.EthSendTransaction, address, method, parameters, options);
}

export async function getProviderNetwork(provider) {
  if (provider._isSigner) {
    provider = provider.provider;
  }

  let networkId;
  if (provider.send) {
    networkId = await provider.send('net_version');
  } else {
    networkId = provider._network.chainId;
  }

  networkId = isNaN(networkId) ? 0 : +networkId;

  const network: any = ethers.providers.getNetwork(networkId) || {};

  return {
    id: networkId,
    name: network.name === 'homestead' ? 'mainnet' : network.name
  };
}

export async function getBalance(address: string, provider: any) {
  if (typeof provider === 'object' && provider._isSigner) {
    provider = provider.provider;
  }

  let providerInstance = createProvider({ provider });
  if (!providerInstance.send) {
    const url = providerInstance.providerConfigs[0].provider.connection.url;
    providerInstance = new ethers.providers.JsonRpcProvider(url);
  }

  const balance = await providerInstance.send(
    'eth_getBalance', [ address, 'latest' ]
  );
  return balance;
}

export function createProvider(options: CallOptions = {}) : any {
  let provider = options.provider || (options.network || 'mainnet');
  const isADefaultProvider = !!ethers.providers.getNetwork(provider.toString());

  // Create an ethers provider, web3's can sign
  if (isADefaultProvider) {
    provider = ethers.getDefaultProvider(provider);
  } else if (typeof provider === 'object') {
    provider = new ethers.providers.Web3Provider(provider).getSigner();
  } else {
    provider = new ethers.providers.JsonRpcProvider(provider);
  }

  // Add an explicit signer
  if (options.privateKey) {
    provider = new ethers.Wallet(options.privateKey, provider);
  } else if (options.mnemonic) {
    provider = new ethers.Wallet(ethers.Wallet.fromMnemonic(options.mnemonic), provider);
  }

  return provider;
}
