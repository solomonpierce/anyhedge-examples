// Load the AnyHedge library.
const { AnyHedgeManager } = require('../dist/main/lib/anyhedge.js');

/**
 * Complete a mutual redemption by combining the generated proposals from both parties.
 *
 * @param {string} token             authentication token to connect to the settlement service.
 * @param {string} contractAddress   contract address to mutually redeem.
 * @param {string} privateKeyWIF     private key of one of the contract parties.
 * @param {object} proposal1         one of the generated proposals.
 * @param {object} proposal2         the other of the generated proposals.
 */
const completeMutualRedemption = async function(token, contractAddress, privateKeyWIF, proposal1, proposal2)
{
	try
	{
		// Load contract manager.
		const manager = new AnyHedgeManager(token);

		// Retrieve contract data for the contract address.
		const contractData = await manager.getContractStatus(contractAddress, privateKeyWIF);

		// Complete mutual redemption.
		const transactionId = await manager.completeMutualRedemption(proposal1, proposal2, contractData.parameters);

		// Log the results to the console.
		console.log('Successfully completed mutual redemption with this transaction:');
		console.log();
		console.log(transactionId);
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

// Paste the proposal you received from your counterparty here.
const COUNTERPARTY_PROPOSAL = {};

// Paste the proposal that you generated yourself here.
const OWN_PROPOSAL = {};

completeMutualRedemption(AUTHENTICATION_TOKEN, CONTRACT_ADDRESS, PRIVATE_KEY_WIF, COUNTERPARTY_PROPOSAL, OWN_PROPOSAL);
