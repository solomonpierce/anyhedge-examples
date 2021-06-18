const { AnyHedgeManager, isParsedMutualRedemptionData, isParsedPayoutData } = require('../dist/main/lib/index.js');

// See the lib/interface.ts file for the TypeScript typings of the parsed data.
// Note that "payout" (maturation/liquidation) transactions contain more data
// than "mutual redemption" transactions.

const parse = async function()
{
	// Initiate a new AnyHedgeManager
	const manager = new AnyHedgeManager();

	// This is an actual payout transaction from a contract I made on Detoken
	const payoutTransaction = '0200000001b9c1e7ef437f048c0adf3c828f51e8387327e1cee736c4526f3181e6a39750d500000000fd8c044089d2e5db28ed8f66a6630c7ba1fed35c09e556ff0563331b08f71823c8b795e744195df18da91b4c441ceb096704ad2cdf5e480a8897bc6ff1469e01d9faaa1332747e0000102d0a000000000000000000024848f437a1cc9ee47fdd69f95e1fb7d6144f60ec3af5880100547b000069c0e05f2103f62307da010c47ed6ce79bfd0c444a9b832a228e992df964d2993317fa90021341becbcd1395406a4eb7bb690502ec7cec8d094de203ea4620e9cfcfe01b9e147968147bc216258182345067ca333a017ca0dcd901e956421862853a71473c4b44412102bca289e12298914e45f1afdcb6e6fe822b9f9c7cd671fb195c476ac465725e6f1a1976a914916aab9455998748d4c1de4187fcb8be780d15a788ac1a1976a9143ecd7c6bb0c985b005978f94287ca795765de3b488ac4dfa0102000000a5750c3e0eb107c20b31a196596cd1dc35bfa5a9edb8865adc9bff3db0046efb18606b350cd8bf565266bc352f0caddcf01e8fa789dd8a15386327cf8cabe198b9c1e7ef437f048c0adf3c828f51e8387327e1cee736c4526f3181e6a39750d500000000fd5b0103102d0a03802c0a03da840502f7690002000004cd7b970604ef7dba0214b372833f3db55ed6102a9d357d808d5aac7ec8b714eb0f8ec3ffbd66f84e7bcdebf8f2e41609f280de5a79009c635b795d797ea9885c7a5b7aad5b7a5b7aad6d6d6d6d6d51675a7a519d5a79547f7701207f01207f7701247f820128947f7701207f757b7baa887b5c795e797e5f797ea98801117a0111795f7abb5d7a5e7a6e7c828c7f755e7aa87bbbad5c79547f777601247f77527f75815e7a547f75817b547f75817800a0697c5a79a35979a47804ff64cd1d9f6978b175785c7a5d798ba5697c5b7a9f637659798b5b79a591696778519d685479789657797c54807e81557a527997577a827754527982779478a3007880537a54807e817b7b94537a7c7f778196935479a3547a789402220258805857798277945779547a5279807e5279855a7a7e577a547a537a807e7b85577a7e537a7b7b7eaa886d6d51681685970600000000feffffffa67432b1c1fb4a32424bf51dc242274a6c386050dc72cd20e1057ed0fc5b6038102d0a0041000000514d5b0103102d0a03802c0a03da840502f7690002000004cd7b970604ef7dba0214b372833f3db55ed6102a9d357d808d5aac7ec8b714eb0f8ec3ffbd66f84e7bcdebf8f2e41609f280de5a79009c635b795d797ea9885c7a5b7aad5b7a5b7aad6d6d6d6d6d51675a7a519d5a79547f7701207f01207f7701247f820128947f7701207f757b7baa887b5c795e797e5f797ea98801117a0111795f7abb5d7a5e7a6e7c828c7f755e7aa87bbbad5c79547f777601247f77527f75815e7a547f75817b547f75817800a0697c5a79a35979a47804ff64cd1d9f6978b175785c7a5d798ba5697c5b7a9f637659798b5b79a591696778519d685479789657797c54807e81557a527997577a827754527982779478a3007880537a54807e817b7b94537a7c7f778196935479a3547a789402220258805857798277945779547a5279807e5279855a7a7e577a547a537a807e7b85577a7e537a7b7b7eaa886d6d5168feffffff02a7128605000000001976a9143ecd7c6bb0c985b005978f94287ca795765de3b488ac266b1101000000001976a914916aab9455998748d4c1de4187fcb8be780d15a788ac102d0a00';
	const parsedPayoutData = await manager.parseSettlementTransaction(payoutTransaction);

	// Checks that it is a "payout" (mature/liquidate) transaction
	console.log('Is this a payout transaction?', isParsedPayoutData(parsedPayoutData));

	// Log the data
	console.log(JSON.stringify(parsedPayoutData, null, 2));
	// {
	// 	address: 'bitcoincash:ppu7dkr7esdn64ctddz5nhuhumsl84al2uyec7k0f6',
	// 	funding: {
	// 		fundingTransaction: 'd55097a3e681316f52c436e7cee1277338e8518f823cdf0a8c047f43efe7c1b9',
	// 		fundingOutput: 0,
	// 	},
	// 	parameters: {
	// 		lowLiquidationPrice: 27127,
	// 		highLiquidationPrice: 361690,
	// 		earliestLiquidationHeight: 666752,
	// 		maturityHeight: 666896,
	// 		oraclePubk: '02bca289e12298914e45f1afdcb6e6fe822b9f9c7cd671fb195c476ac465725e6f',
	// 		hedgeLockScript: '1976a9143ecd7c6bb0c985b005978f94287ca795765de3b488ac',
	// 		longLockScript: '1976a914916aab9455998748d4c1de4187fcb8be780d15a788ac',
	// 		lowTruncatedZeroes: '',
	// 		highLowDeltaTruncatedZeroes: '0000',
	// 		hedgeUnitsXSatsPerBchHighTrunc: 45776367,
	// 		payoutSatsLowTrunc: 110590925,
	// 	},
	// 	settlement: {
	// 		spendingTransaction: 'e25c1c6ba0040f7e91158c92a9da8eae05f63d67c727aa620c8b5658366bdda2',
	// 		settlementType: 'maturation',
	// 		hedgeSatoshis: 92672679,
	// 		longSatoshis: 17918758,
	// 		oracleMessage: '747e0000102d0a000000000000000000024848f437a1cc9ee47fdd69f95e1fb7d6144f60ec3af5880100547b000069c0e05f',
	// 		oraclePublicKey: '02bca289e12298914e45f1afdcb6e6fe822b9f9c7cd671fb195c476ac465725e6f',
	// 		oracleSignature: '89d2e5db28ed8f66a6630c7ba1fed35c09e556ff0563331b08f71823c8b795e744195df18da91b4c441ceb096704ad2cdf5e480a8897bc6ff1469e01d9faaa13',
	// 		oraclePrice: 32372,
	// 	},
	// };

	// This is a mutual redemption transaction that we manually mutually redeemed.
	const mutualRedemptionTransaction = '020000000150eb40a845d9e90ff7a24e7f734467108d6c2646a8d7b8770e93ca104365883800000000fd260241ce9491eae6444cbac4ae5bd0ade1acbe3c08f18d646a197f6a2ee5a56eeee27619a1db58a0dd370106c45c2129caf82a9398b4b9ddb02e15735d6566c9108123414181f90ec0782187b515edf8ba0bd77850d5696d77c0c2fcbd1004d39775b94825bc1a1898539785db7f88246fb2a7192ce596b8a6024fee3af7f87ef8f08b46a841210237c0c7b0b9705318495db6cf97ec12396c80334419f2c2327357e3736cf981902102f032c444cd00bb791fd2ea518110cf556cdc7463b9f59f4ff432dafc4877a6e8004d5a0103952e0a03052e0a0346790402e55500010004b22dd00004b864d94514a36fc644f25ee1e5d0599055498390a4ae08c4b114a49e0711ae4a9f307b86348197db05e1d712acbe5a79009c635b795d797ea9885c7a5b7aad5b7a5b7aad6d6d6d6d6d51675a7a519d5a79547f7701207f01207f7701247f820128947f7701207f757b7baa887b5c795e797e5f797ea98801117a0111795f7abb5d7a5e7a6e7c828c7f755e7aa87bbbad5c79547f777601247f77527f75815e7a547f75817b547f75817800a0697c5a79a35979a47804ff64cd1d9f6978b175785c7a5d798ba5697c5b7a9f637659798b5b79a591696778519d685479789657797c54807e81557a527997577a827754527982779478a3007880537a54807e817b7b94537a7c7f778196935479a3547a789402220258805857798277945779547a5279807e5279855a7a7e577a547a537a807e7b85577a7e537a7b7b7eaa886d6d51680000000002d1219c00000000001976a9143f90c5406b72d1750883d0188110cea653986b4188ace10b3400000000001976a9144566db12c462d065c62faaf1f446ec2ef3766ac788ac00000000';
	const mutualRedemptionData = await manager.parseSettlementTransaction(mutualRedemptionTransaction);

	// Checks that it is a "mutual redemption" transaction
	console.log('Is this a mutual redemption transaction?', isParsedMutualRedemptionData(mutualRedemptionData));

	// Log the data
	console.log(JSON.stringify(mutualRedemptionData, null, 2));
	// {
	// 	address: 'bitcoincash:prwk0wf7xx3cxuspvqz7kxdcywwa32xxcscd65fqwr',
	// 	funding: {
	// 		fundingTransaction: '3888654310ca930e77b8d7a846266c8d106744737f4ea2f70fe9d945a840eb50',
	// 		fundingOutput: 0,
	// 	},
	// 	parameters: {
	// 		lowLiquidationPrice: 21989,
	// 		highLiquidationPrice: 293190,
	// 		earliestLiquidationHeight: 667141,
	// 		maturityHeight: 667285,
	// 		hedgeMutualRedeemPubk: '02f032c444cd00bb791fd2ea518110cf556cdc7463b9f59f4ff432dafc4877a6e8',
	// 		longMutualRedeemPubk: '0237c0c7b0b9705318495db6cf97ec12396c80334419f2c2327357e3736cf98190',
	// 		lowTruncatedZeroes: '',
	// 		highLowDeltaTruncatedZeroes: '00',
	// 		hedgeUnitsXSatsPerBchHighTrunc: 1171875000,
	// 		payoutSatsLowTrunc: 13643186,
	// 	},
	// 	settlement: {
	// 		spendingTransaction: 'f6aae8c87c0858be4f6e17762b0989497be9ccb79169747590216d5ca0e6a8e6',
	// 		settlementType: 'mutual',
	// 		hedgeSatoshis: 10232273,
	// 		longSatoshis: 3410913,
	// 	},
	// };
};

parse();
