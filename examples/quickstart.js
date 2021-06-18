// ***************************************************************************************************
// ***************************************************************************************************
//       _____       _      _    _____ _             _   
//      |  _  |     (_)    | |  /  ___| |           | |  
//      | | | |_   _ _  ___| | _\ `--.| |_ __ _ _ __| |_ 
//      | | | | | | | |/ __| |/ /`--. \ __/ _` | '__| __|
//      \ \/' / |_| | | (__|   </\__/ / || (_| | |  | |_ 
//       \_/\_\\__,_|_|\___|_|\_\____/ \__\__,_|_|   \__| v1.0
//                          
// ***************************************************************************************************
// ***************************************************************************************************
//     
//       Launch your first AnyHedge contract in minutes
//
// ***************************************************************************************************


// How much money to hedge, measured in US cents.
const US_CENTS_TO_HEDGE = 500;

// You'll need two Bitcoin Cash addresses to run this example.
// You can get these keys with a standard Electron Cash wallet.
// For safety it is recommended to create a new wallet or use a testing wallet for this:
//   1. Go to the Addresses tab
//   2. Choose any address and take note of it so you can watch later for the automatic redemption to appear.
//   2. Right click the address --> Private Key
//   3. Copy the private key in the top box and paste it below as the HEDGE_WIF
//   4. Repeat the above steps with a different address for the LONG_WIF
const HEDGE_WIF = '';
const LONG_WIF = '';

// AnyHedge requires a settlement service provider.
// The easiest way is to use ours:
// Request a token once by running the following command in the terminal:
// curl -d 'name=<Your Name Here>' "http://api.anyhedge.com:6572/token"
const AUTHENTICATION_TOKEN = '';


// That's it. Save this file and run:
// node examples/quickstart.js


// *********************************************************************************************************************************************
// *********************************************************************************************************************************************




const CONTRACT_EARLIEST_LIQUIDATION_MODIFIER = 0;
const CONTRACT_MATURITY_MODIFIER = 1;
const CONTRACT_LOW_LIQUIDATION_PRICE_MULTIPLIER = 0.75;
const CONTRACT_HIGH_LIQUIDATION_PRICE_MULTIPLIER = 10.00;
const ORACLE_PUBLIC_KEY = '02bca289e12298914e45f1afdcb6e6fe822b9f9c7cd671fb195c476ac465725e6f';
const {
  AnyHedgeManager
} = require('../dist/main/lib/anyhedge.js');
const anyHedgeManager = new AnyHedgeManager({
  authenticationToken: AUTHENTICATION_TOKEN
});
const fetch = require('node-fetch');
const {
  instantiateSha256,
  decodePrivateKeyWif,
  hexToBin,
  bigIntToBinUint64LE,
  flattenBinArray,
  encodeDataPush,
  instantiateSecp256k1,
  createTransactionContextCommon,
  generateSigningSerializationBCH,
  binToHex,
  encodeTransaction,
  cashAddressToLockingBytecode,
  instantiateRipemd160,
  encodeCashAddress,
  CashAddressType,
  decodeTransactionUnsafe
} = require('@bitauth/libauth');
const {
  ElectrumNetworkProvider
} = require('cashscript');

const example = async function () {
  const [contractStartPrice, contractStartHeight] = await getStartConditions();
  const [hedgePrivateKey, hedgePublicKey, hedgeAddress] = await parseWIF(HEDGE_WIF);
  const [longPrivateKey, longPublicKey, longAddress] = await parseWIF(LONG_WIF);

  const contractCreationParameters = [
    ORACLE_PUBLIC_KEY,
    hedgePublicKey,
    longPublicKey,
    US_CENTS_TO_HEDGE,
    contractStartPrice,
    contractStartHeight,
    CONTRACT_EARLIEST_LIQUIDATION_MODIFIER,
    CONTRACT_MATURITY_MODIFIER,
    CONTRACT_HIGH_LIQUIDATION_PRICE_MULTIPLIER,
    CONTRACT_LOW_LIQUIDATION_PRICE_MULTIPLIER,
  ];

  try {
    let contractData;

    try {
      const {
        address
      } = await anyHedgeManager.createContract(...contractCreationParameters);
      contractData = await anyHedgeManager.getContractStatus(address);
      console.log(`Retrieved registered contract data for '${contractData.address}' from the settlement service.`);
    } catch (error) {
      contractData = await anyHedgeManager.registerContractForSettlement(...contractCreationParameters);
      console.log(`Registered '${contractData.address}' for automated settlement after funding is complete.`);
    }

    const fundingTransaction = await buildFundingTransaction(
      hedgePrivateKey, hedgePublicKey, hedgeAddress, longPrivateKey, longPublicKey, longAddress, contractData,
    );

    const decodedTransaction = decodeTransactionUnsafe(hexToBin(fundingTransaction));
    const dependencies = await Promise.all(decodedTransaction.inputs.map((input) => getTransaction(binToHex(input.outpointTransactionHash))));
    console.log(`Funding transaction: ${fundingTransaction}`);
    await anyHedgeManager.submitFundingTransaction(contractData.address, fundingTransaction, dependencies);
    console.log(`Wait for ${CONTRACT_MATURITY_MODIFIER} block(s) and the redemption service should mature your contract, paying out to hedge (${hedgeAddress}) and long (${longAddress}).`);
  } catch (error) {
    console.log('\n', error.toString());
  }
};

const getStartConditions = async function () {
  const bitpayResponse = await fetch('https://bitpay.com/api/rates/BCH/USD');

  if (!bitpayResponse.ok) {
    throw (new Error('Could not retrieve latest BCH price data from BitPay.'));
  }

  const bitpayData = await bitpayResponse.json();
  const contractStartPrice = Number(bitpayData.rate * 100);
  const contractStartHeight = await getBlockHeight();
  return [contractStartPrice, contractStartHeight];
};

const parseWIF = async function (wif) {
  const secp256k1 = await instantiateSecp256k1();
  const sha256 = await instantiateSha256();
  const ripemd160 = await instantiateRipemd160();

  const decodeResult = decodePrivateKeyWif(await instantiateSha256(), wif);

  if (typeof decodeResult === 'string') throw (new Error(decodeResult));

  const privateKeyBin = decodeResult.privateKey;
  const publicKeyBin = secp256k1.derivePublicKeyCompressed(privateKeyBin);
  const publicKeyHashBin = ripemd160.hash(sha256.hash(publicKeyBin));
  const address = encodeCashAddress('bitcoincash', CashAddressType.P2PKH, publicKeyHashBin);

  return [binToHex(privateKeyBin), binToHex(publicKeyBin), address];
};

const buildFundingTransaction = async function (hedgePrivateKey, hedgePublicKey, hedgeAddress, longPrivateKey, longPublicKey, longAddress, contractData) {
  const hedgeCoins = await getCoins(hedgeAddress);
  const longCoins = await getCoins(longAddress);
  const hedgeBalance = await sumCoins(hedgeCoins);
  const longBalance = await sumCoins(longCoins);
  const {
    hedgeInputSats,
    longInputSats,
    minerCost,
    dustCost
  } = contractData.metadata;
  const hedgeContractAmount = hedgeInputSats;
  const longContractAmount = longInputSats + minerCost + dustCost;
  const settlementServiceFee = contractData.fee.satoshis;
  const INPUT_SIZE = 148;
  const OUTPUT_SIZE = 34;
  const fixedFee = 10 + (4 * OUTPUT_SIZE);
  const hedgeMinerFee = (fixedFee / 2) + (INPUT_SIZE * hedgeCoins.length);
  const longMinerFee = (fixedFee / 2) + (INPUT_SIZE * longCoins.length);
  const hedgeSendAmount = hedgeContractAmount + hedgeMinerFee + settlementServiceFee;
  const longSendAmount = longContractAmount + longMinerFee;

  if ((hedgeBalance < hedgeSendAmount) || (longBalance < longSendAmount)) {
    throw (new Error(`Hedge (${hedgeAddress}) has ${hedgeBalance} sats and requires at least ${hedgeSendAmount} sats. Long (${longAddress}) has ${longBalance} sats and requires at least ${longSendAmount} sats.`));
  }

  const hedgeReturnAmount = hedgeBalance - hedgeSendAmount;
  const longReturnAmount = longBalance - longSendAmount;
  const outputs = [];

  outputs.push(createOutput(contractData.address, (hedgeContractAmount + longContractAmount)));
  outputs.push(createOutput(contractData.fee.address, contractData.fee.satoshis));

  const MIN_RETURN_AMOUNT = 546;

  if (hedgeReturnAmount >= MIN_RETURN_AMOUNT) {
    outputs.push(createOutput(hedgeAddress, hedgeReturnAmount));
  }

  if (longReturnAmount >= MIN_RETURN_AMOUNT) {
    outputs.push(createOutput(longAddress, longReturnAmount));
  }

  const inputs = [...hedgeCoins, ...longCoins].map(coinToInput);
  const transaction = {
    inputs,
    locktime: 0,
    outputs,
    version: 2,
  };

  transaction.inputs = await Promise.all(transaction.inputs.map(async (input, inputIndex) => {
    const inputBelongsToHedge = inputIndex < hedgeCoins.length;
    const publicKey = (inputBelongsToHedge ? hedgePublicKey : longPublicKey);
    const privateKey = (inputBelongsToHedge ? hedgePrivateKey : longPrivateKey);
    const address = (inputBelongsToHedge ? hedgeAddress : longAddress);
    const lockScriptResult = cashAddressToLockingBytecode(address);

    if (typeof lockScriptResult === 'string') throw (new Error(lockScriptResult));

    const lockScriptBin = lockScriptResult.bytecode;
    const SIGHASH_ALL = 0x41;
    const signatureBin = await signTransactionInput(transaction, input.satoshis, inputIndex, lockScriptBin, SIGHASH_ALL, hexToBin(privateKey));
    const unlockingBytecode = flattenBinArray([encodeDataPush(signatureBin), encodeDataPush(hexToBin(publicKey))]);
    const signedInput = {
      ...input,
      unlockingBytecode
    };

    return signedInput;
  }));

  const encodedTransaction = binToHex(encodeTransaction(transaction));

  return encodedTransaction;
};

const getBlockHeight = async function () {
  const provider = new ElectrumNetworkProvider();
  const blockHeight = await provider.getBlockHeight();

  return blockHeight;
};

const getCoins = async function (address) {
  const provider = new ElectrumNetworkProvider();
  const coins = await provider.getUtxos(address);

  return coins;
};

const getTransaction = async function (transactionId) {
  const provider = new ElectrumNetworkProvider();
  const transactionHex = await provider.getRawTransaction(transactionId);

  return transactionHex;
};

const sumCoins = async function (coins) {
  const balance = coins.reduce((totalSats, coin) => (totalSats + coin.satoshis), 0);

  return balance;
};

const createOutput = function (address, amount) {
  const lockScriptResult = cashAddressToLockingBytecode(address);

  if (typeof lockScriptResult === 'string') throw (new Error(lockScriptResult));

  const lockingBytecode = lockScriptResult.bytecode;
  const satoshis = bigIntToBinUint64LE(BigInt(amount));
  const output = {
    lockingBytecode,
    satoshis
  };

  return output;
};
const coinToInput = function (coin) {
  const input = {
    outpointIndex: coin.vout,
    outpointTransactionHash: hexToBin(coin.txid),
    sequenceNumber: 0,
    unlockingBytecode: new Uint8Array(),
    satoshis: coin.satoshis,
  };

  return input;
};
const signTransactionInput = async function (transaction, satoshis, inputIndex, coveredBytecodeBin, hashtype, privateKeyBin) {
  const signingSerialization = await createSigningSerialization(transaction, satoshis, inputIndex, coveredBytecodeBin, hashtype);
  const sha256 = await instantiateSha256();
  const sighash = sha256.hash(sha256.hash(signingSerialization));
  const secp256k1 = await instantiateSecp256k1();
  const signatureBin = secp256k1.signMessageHashSchnorr(privateKeyBin, sighash);
  const transactionSignature = Uint8Array.from([...signatureBin, hashtype]);

  return transactionSignature;
};
const createSigningSerialization = async function (transaction, satoshis, inputIndex, coveredBytecodeBin, hashtype) {
  const state = createTransactionContextCommon({
    inputIndex,
    sourceOutput: {
      satoshis: bigIntToBinUint64LE(BigInt(satoshis))
    },
    spendingTransaction: transaction,
  });

  const signingSerialization = generateSigningSerializationBCH({
    correspondingOutput: state.correspondingOutput,
    coveredBytecode: coveredBytecodeBin,
    forkId: new Uint8Array([0, 0, 0]),
    locktime: state.locktime,
    outpointIndex: state.outpointIndex,
    outpointTransactionHash: state.outpointTransactionHash,
    outputValue: state.outputValue,
    sequenceNumber: state.sequenceNumber,
    sha256: await instantiateSha256(),
    signingSerializationType: new Uint8Array([hashtype]),
    transactionOutpoints: state.transactionOutpoints,
    transactionOutputs: state.transactionOutputs,
    transactionSequenceNumbers: state.transactionSequenceNumbers,
    version: 2,
  });

  return signingSerialization;
};

example();