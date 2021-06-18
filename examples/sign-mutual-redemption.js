// Load the AnyHedge library.
const { AnyHedgeManager } = require('../dist/main/lib/anyhedge.js');

/**
 * Mutually redeem a contract that is registered in the settlement services. If a settlement price
 * is included, a "mutual early maturation" will be signed, if it is omitted a "refund" will be signed.
 * Note that the private key WIF must be the mutual redemption key for one of the two contract parties.
 *
 * @param {string} token               authentication token to connect to the settlement service.
 * @param {string} contractAddress     contract address to mutually redeem.
 * @param {string} privateKeyWIF       private key of one of the contract parties.
 * @param {number} [settlementPrice]   price to use in settlement.
 */
const signMutualRedemption = async function(token, contractAddress, privateKeyWIF, settlementPrice)
{
	try
	{
		// Load contract manager.
		const manager = new AnyHedgeManager(token);

		// Retrieve contract data for the contract address.
		const contractData = await manager.getContractStatus(contractAddress, privateKeyWIF);

		// Take the first contract funding in the list.
		const [ contractFunding ] = contractData.funding || [];

		// Throw an error if no contract funding was found.
		if(!contractFunding)
		{
			throw(new Error(`No funding found for contract address ${contractAddress}`));
		}

		let proposal;

		if(settlementPrice)
		{
			// Perform a mutual early maturation if a settlement price was provided.
			proposal = await manager.signMutualEarlyMaturation(privateKeyWIF, contractFunding, settlementPrice, contractData.parameters);
		}
		else
		{
			// Perform a refund if no settlement price was provided.
			proposal = await manager.signMutualRefund(privateKeyWIF, contractFunding, contractData.parameters, contractData.metadata);
		}

		// Log the results to the console.
		console.log('Successfully signed proposal, please share this proposal with your counterparty');
		console.log();
		console.log(JSON.stringify(proposal, null, 2));
	}
	catch(error)
	{
		// Log the error to the console and exit.
		console.error(error.message);
		process.exit(1);
	}
};

// Provide the following variables to use this script.

// Authentication token to connect to the AnyHedge settlement service.
const AUTHENTICATION_TOKEN = '';

// Contract address for the contract you want to mutually redeem.
const CONTRACT_ADDRESS = '';

// Private key for one of the contract parties.
const PRIVATE_KEY_WIF = '';

// If this is set to a price, the contract will be mutually settled/matured at that price,
// if it is set to undefined, instead the original input satoshi values will be refunded.
const SETTLEMENT_PRICE = undefined;

signMutualRedemption(AUTHENTICATION_TOKEN, CONTRACT_ADDRESS, PRIVATE_KEY_WIF, SETTLEMENT_PRICE);
