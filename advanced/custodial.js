/* eslint-disable no-console, no-use-before-define */

// Custodial example of establishing the parameters for an AnyHedge contract and funding it.
// The contract will redeem through the default redemption service.
// After making settings, you can run the sample one time to get the required funding details for hedge and long.
// After funding the addresses, you can run again for the example to create an actual contract.

// Set how many US cents that Hedge would like to protect against price volatility.
const NOMINAL_UNITS = 500;

// There are 3 important timing settings.
// The example code sets the contract start block to the current block for you.
// The earliest liquidation modifier sets the earliest point after start block that a contract can be liquidated. Typically zero.
// The maturity modifier sets the exact point after start block that a contract can be matured.
const CONTRACT_EARLIEST_LIQUIDATION_MODIFIER = 0;
const CONTRACT_MATURITY_MODIFIER = 1;

// Set the multipliers for how much the price can change before the contract is liquidated.
// For example assuming the price today is $300 then:
//   if low multiplier = 0.75, the low liquidation price will be $300 * 0.75 = $225.
//   if high multiplier = 10, the high liquidation price will be $300 * 10 = $3,000.
const CONTRACT_LOW_LIQUIDATION_PRICE_MULTIPLIER = 0.75;
const CONTRACT_HIGH_LIQUIDATION_PRICE_MULTIPLIER = 10.00;

// The contract requires addresses for payout and public keys for validating mutual redemptions.
// Set these values to compressed WIF keys that you control and the example will use it for the public key and address.
// You can get WIF keys with a standard Electron Cash wallet.
// For safety it is recommended to create a new wallet or use a testing wallet for this:
//   1. Go to the Addresses tab
//   2. Choose any address and take note of it so you can watch later for the automatic redemption to appear.
//   2. Right click the address --> Private Key
//   3. Copy the private key in the top box.
const HEDGE_WIF = '';
const LONG_WIF = '';

// To use the automated redemption service, you need to request an authentication token from the service provider.
// Request a token once by running the following command in the terminal:
// curl -d 'name=<Your Name Here>' "http://api.anyhedge.com:6572/token"
const AUTHENTICATION_TOKEN = '';

// Set the oracle public key to one that you know is operational and available. This is the production USD price oracle.
const ORACLE_PUBLIC_KEY = '02bca289e12298914e45f1afdcb6e6fe822b9f9c7cd671fb195c476ac465725e6f';

// Load the AnyHedge library.
const {
	AnyHedgeManager
} = require('../dist/main/lib/anyhedge.js');

// Create an instance of the AnyHedge manager using the authentication token.
const anyHedgeManager = new AnyHedgeManager({
	authenticationToken: AUTHENTICATION_TOKEN
});

// Add support for fetching data.
const fetch = require('node-fetch');

// Load Bitcoin Cash utilities from the Libauth library.
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

// Load CashScript's ElectrumNetworkProvider for communicating with the blockchain.
const {
	ElectrumNetworkProvider
} = require('cashscript');

// Wrap the example code in an async function to allow async/await.
const example = async function () {
	// Collect all the parameters that we need to create a contract
	const [contractStartPrice, contractStartHeight] = await getStartConditions();
	const [hedgePrivateKey, hedgePublicKey, hedgeAddress] = await parseWIF(HEDGE_WIF);
	const [longPrivateKey, longPublicKey, longAddress] = await parseWIF(LONG_WIF);

	// Gather all contract creation parameters.
	const contractCreationParameters = [
		ORACLE_PUBLIC_KEY,
		hedgePublicKey,
		longPublicKey,
		NOMINAL_UNITS,
		contractStartPrice,
		contractStartHeight,
		CONTRACT_EARLIEST_LIQUIDATION_MODIFIER,
		CONTRACT_MATURITY_MODIFIER,
		CONTRACT_HIGH_LIQUIDATION_PRICE_MULTIPLIER,
		CONTRACT_LOW_LIQUIDATION_PRICE_MULTIPLIER,
	];

	try {
		// Declare contractData.
		let contractData;

		try {
			// Retrieve contract data from the settlement service if a contract with these details is already registered.
			const {
				address
			} = await anyHedgeManager.createContract(...contractCreationParameters);
			contractData = await anyHedgeManager.getContractStatus(address);

			// Log the contract address for easier debugging.
			console.log(`Retrieved registered contract data for '${contractData.address}' from the settlement service.`);
		} catch (error) {
			// If no contract is registered under this address yet, we register it with the settlement service.
			contractData = await anyHedgeManager.registerContractForSettlement(...contractCreationParameters);

			// Log the contract address for easier debugging.
			console.log(`Registered '${contractData.address}' for automated settlement after funding is complete.`);
		}

		// Build a transaction that funds the contract and pays a service fee to the settlement service provider.
		const fundingTransaction = await buildFundingTransaction(
			hedgePrivateKey, hedgePublicKey, hedgeAddress, longPrivateKey, longPublicKey, longAddress, contractData,
		);

		// Extract a list of "dependency transactions" to pass into the submitFundingTransaction().
		// Note: This is optional and usually not necessary, but it can be used to ensure that the settlement service
		// knows about the necessary dependency transactions. This can be useful if these dependency transactions were
		// submitted very shortly before submitting the funding transaction.
		const decodedTransaction = decodeTransactionUnsafe(hexToBin(fundingTransaction));
		const dependencies = await Promise.all(decodedTransaction.inputs.map((input) => getTransaction(binToHex(input.outpointTransactionHash))));

		// Output the raw hex-encoded funding transaction to the console.
		console.log(`Funding transaction: ${fundingTransaction}`);

		// Send the funding transaction to the settlement service for validation and broadcasting.
		await anyHedgeManager.submitFundingTransaction(contractData.address, fundingTransaction, dependencies);

		// Log the next steps.
		console.log(`Wait for ${CONTRACT_MATURITY_MODIFIER} block(s) and the redemption service should mature your contract, paying out to hedge (${hedgeAddress}) and long (${longAddress}).`);
	} catch (error) {
		// Output the error to the console on a new line.
		console.log('\n', error.toString());
	}
};

// Get the external start conditions for an AnyHedge contract (start price, start block height)
const getStartConditions = async function () {
	// Fetch the current price in US dollars.
	const bitpayResponse = await fetch('https://bitpay.com/api/rates/BCH/USD');

	// Check that the request to BitPay was successful.
	if (!bitpayResponse.ok) {
		throw (new Error('Could not retrieve latest BCH price data from BitPay.'));
	}

	// Retrieve the BitPay response data as JSON.
	const bitpayData = await bitpayResponse.json();

	// Set the starting price of the contract in US cents.
	const contractStartPrice = Number(bitpayData.rate * 100);

	// Set the starting contract height to the current block height.
	const contractStartHeight = await getBlockHeight();

	return [contractStartPrice, contractStartHeight];
};

// Parse a WIF string into a private key, public key and address.
const parseWIF = async function (wif) {
	// Instantiate Libauth crypto interfaces
	const secp256k1 = await instantiateSecp256k1();
	const sha256 = await instantiateSha256();
	const ripemd160 = await instantiateRipemd160();

	// Attempt to decode WIF string into a private key
	const decodeResult = decodePrivateKeyWif(await instantiateSha256(), wif);

	// If decodeResult is a string, it represents an error, so we throw it.
	if (typeof decodeResult === 'string') throw (new Error(decodeResult));

	// Extract the private key from the decodeResult.
	const privateKeyBin = decodeResult.privateKey;

	// Derive the corresponding public key.
	const publicKeyBin = secp256k1.derivePublicKeyCompressed(privateKeyBin);

	// Hash the public key hash according to the P2PKH scheme.
	const publicKeyHashBin = ripemd160.hash(sha256.hash(publicKeyBin));

	// Encode the public key hash into a P2PKH cash address.
	const address = encodeCashAddress('bitcoincash', CashAddressType.P2PKH, publicKeyHashBin);

	return [binToHex(privateKeyBin), binToHex(publicKeyBin), address];
};

// Build a transaction that funds a contract and pays a settlement service fee.
const buildFundingTransaction = async function (hedgePrivateKey, hedgePublicKey, hedgeAddress, longPrivateKey, longPublicKey, longAddress, contractData) {
	// Get a list of coins for the hedge and long addresses.
	const hedgeCoins = await getCoins(hedgeAddress);
	const longCoins = await getCoins(longAddress);

	// Sum all hedge and long coins to calculate the balances.
	const hedgeBalance = await sumCoins(hedgeCoins);
	const longBalance = await sumCoins(longCoins);

	// Extract relevant data from contract metadata.
	const {
		hedgeInputSats,
		longInputSats,
		minerCost,
		dustCost
	} = contractData.metadata;

	// Calculate the amounts necessary to fund the contract.
	const hedgeContractAmount = hedgeInputSats;
	const longContractAmount = longInputSats + minerCost + dustCost;

	// Extract the settlement service fee amount. This is paid fully by the hedge party.
	const settlementServiceFee = contractData.fee.satoshis;

	// Roughly calculate the miner fees for the funding transaction for both sides.
	// See https://bitcoin.stackexchange.com/questions/1195/how-to-calculate-transaction-size-before-sending-legacy-non-segwit-p2pkh-p2sh/46379
	const INPUT_SIZE = 148;
	const OUTPUT_SIZE = 34;

	// The fixed part of the transaction fee consists of a base of 10 plus 4 outputs (funding, fee, 2 return outputs).
	const fixedFee = 10 + (4 * OUTPUT_SIZE);

	// Both parties pay for their own inputs and half of the fixed fee.
	const hedgeMinerFee = (fixedFee / 2) + (INPUT_SIZE * hedgeCoins.length);
	const longMinerFee = (fixedFee / 2) + (INPUT_SIZE * longCoins.length);

	// Calculate the total amount needed to perform the funding transaction.
	const hedgeSendAmount = hedgeContractAmount + hedgeMinerFee + settlementServiceFee;
	const longSendAmount = longContractAmount + longMinerFee;

	// Verify that the hedge has enough funds to enter the contract.
	if ((hedgeBalance < hedgeSendAmount) || (longBalance < longSendAmount)) {
		throw (new Error(`Hedge (${hedgeAddress}) has ${hedgeBalance} sats and requires at least ${hedgeSendAmount} sats. Long (${longAddress}) has ${longBalance} sats and requires at least ${longSendAmount} sats.`));
	}

	// Calculate return amounts by subtracting the send amount from the total balance
	const hedgeReturnAmount = hedgeBalance - hedgeSendAmount;
	const longReturnAmount = longBalance - longSendAmount;

	// Initialize an empty array of outputs
	const outputs = [];

	// Set the target amount to be sent to the contract.
	outputs.push(createOutput(contractData.address, (hedgeContractAmount + longContractAmount)));

	// Add an output to pay the service fee to the settlement service.
	outputs.push(createOutput(contractData.fee.address, contractData.fee.satoshis));

	// It is a rule of the BCH network that an output must have a minimum value of 546 satoshis.
	const MIN_RETURN_AMOUNT = 546;

	// Send the remainder back to the wallets if it is at least the min return amount.
	// If it is below the min return amount, the remainder is instead added to the miner fee.
	// NOTE: Change address is the same address as we will be sending from.
	if (hedgeReturnAmount >= MIN_RETURN_AMOUNT) {
		outputs.push(createOutput(hedgeAddress, hedgeReturnAmount));
	}
	if (longReturnAmount >= MIN_RETURN_AMOUNT) {
		outputs.push(createOutput(longAddress, longReturnAmount));
	}

	// Convert all coins to the Libauth Input format (unsigned)
	const inputs = [...hedgeCoins, ...longCoins].map(coinToInput);

	// Assemble the unsigned transaction.
	const transaction = {
		inputs,
		locktime: 0,
		outputs,
		version: 2,
	};

	// Sign all inputs and add the generated unlocking scripts to the transaction.
	transaction.inputs = await Promise.all(transaction.inputs.map(async (input, inputIndex) => {
		// Check whether the current input belongs to the hedge (if not, they belong to the long)
		const inputBelongsToHedge = inputIndex < hedgeCoins.length;

		// Pick the correct keys & address depending on the input index
		const publicKey = (inputBelongsToHedge ? hedgePublicKey : longPublicKey);
		const privateKey = (inputBelongsToHedge ? hedgePrivateKey : longPrivateKey);
		const address = (inputBelongsToHedge ? hedgeAddress : longAddress);

		// Derive the input's locking script from its address.
		const lockScriptResult = cashAddressToLockingBytecode(address);

		// If lockScriptResult is a string, it represents an error, so we throw it.
		if (typeof lockScriptResult === 'string') throw (new Error(lockScriptResult));

		// Extract the bytecode (locking script) from the lockScriptResult.
		const lockScriptBin = lockScriptResult.bytecode;

		// Use the SIGHASH_ALL hashtype for signing (with BCH replay protection included).
		const SIGHASH_ALL = 0x41;

		// Generate a transaction signature for this input.
		const signatureBin = await signTransactionInput(transaction, input.satoshis, inputIndex, lockScriptBin, SIGHASH_ALL, hexToBin(privateKey));

		// Build the unlocking script that unlocks the P2PKH locking script.
		const unlockingBytecode = flattenBinArray([encodeDataPush(signatureBin), encodeDataPush(hexToBin(publicKey))]);

		// Add the unlocking script to the input.
		const signedInput = {
			...input,
			unlockingBytecode
		};

		return signedInput;
	}));

	// Hex encode the built transaction.
	const encodedTransaction = binToHex(encodeTransaction(transaction));

	return encodedTransaction;
};

// Retrieve the current block height using an ElectrumNetworkProvider.
const getBlockHeight = async function () {
	// Create a new ElectrumNetworkProvider.
	const provider = new ElectrumNetworkProvider();

	// Request the current block height.
	const blockHeight = await provider.getBlockHeight();

	return blockHeight;
};

// Retrieve an address' coins using an ElectrumNetworkProvider.
const getCoins = async function (address) {
	// Create a new ElectrumNetworkProvider.
	const provider = new ElectrumNetworkProvider();

	// Request an address' coins.
	const coins = await provider.getUtxos(address);

	return coins;
};

// Retrieve a transaction hex string from a transaction ID.
const getTransaction = async function (transactionId) {
	// Create a new ElectrumNetworkProvider.
	const provider = new ElectrumNetworkProvider();

	// Request a raw transaction hex.
	const transactionHex = await provider.getRawTransaction(transactionId);

	return transactionHex;
};

// Sum a list of coins.
const sumCoins = async function (coins) {
	// Calculate the total balance of all coins.
	const balance = coins.reduce((totalSats, coin) => (totalSats + coin.satoshis), 0);

	return balance;
};

// Create a Libauth compatible output for an amount to an address.
const createOutput = function (address, amount) {
	// Generate the locking script for the passed address.
	const lockScriptResult = cashAddressToLockingBytecode(address);

	// If lockScriptResult is a string, it represents an error, so we throw it.
	if (typeof lockScriptResult === 'string') throw (new Error(lockScriptResult));

	// Extract the bytecode (locking script) from the lockScriptResult.
	const lockingBytecode = lockScriptResult.bytecode;

	// Convert the amount to a BCH script number.
	const satoshis = bigIntToBinUint64LE(BigInt(amount));

	// Assemble the output.
	const output = {
		lockingBytecode,
		satoshis
	};

	return output;
};

// Convert a coin (returned by the ElectrumNetworkProvider) to a Libauth input format.
const coinToInput = function (coin) {
	// Convert the coin's properties to Libauth input properties.
	const input = {
		outpointIndex: coin.vout,
		outpointTransactionHash: hexToBin(coin.txid),
		sequenceNumber: 0,
		unlockingBytecode: new Uint8Array(),
		satoshis: coin.satoshis,
	};

	return input;
};

// Sign a single transaction input using a private key.
const signTransactionInput = async function (transaction, satoshis, inputIndex, coveredBytecodeBin, hashtype, privateKeyBin) {
	// Generate the signing serialization for this transaction input.
	const signingSerialization = await createSigningSerialization(transaction, satoshis, inputIndex, coveredBytecodeBin, hashtype);

	// Generate the "sighash" by taking the double SHA256 of the signing serialization.
	const sha256 = await instantiateSha256();
	const sighash = sha256.hash(sha256.hash(signingSerialization));

	// Instantiate the Secp256k1 interface.
	const secp256k1 = await instantiateSecp256k1();

	// Generate a signature over the "sighash" using the passed private key.
	const signatureBin = secp256k1.signMessageHashSchnorr(privateKeyBin, sighash);

	// Append the hashtype to the signature to turn it into a valid transaction signature.
	const transactionSignature = Uint8Array.from([...signatureBin, hashtype]);

	return transactionSignature;
};

// Create the signing serialization for a certain transaction input.
// Note: This is advanced functionality
const createSigningSerialization = async function (transaction, satoshis, inputIndex, coveredBytecodeBin, hashtype) {
	// Create a "transaction state", used to extract a lot of the relevant information with Libauth.
	const state = createTransactionContextCommon({
		inputIndex,
		sourceOutput: {
			satoshis: bigIntToBinUint64LE(BigInt(satoshis))
		},
		spendingTransaction: transaction,
	});

	// Generate the signing serialization using mostly information from the generated "transaction state".
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

// Run the example code.
example();