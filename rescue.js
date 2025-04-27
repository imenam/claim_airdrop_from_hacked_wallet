require('dotenv').config();
const { ethers } = require('ethers');
const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle');
const fs = require('fs');

// --- Load ABIs and proof ---
const AIRDROP_ABI = JSON.parse(fs.readFileSync('./airdrop_abi.json', 'utf8'));
const MERKLE_PROOF = JSON.parse(fs.readFileSync('./merkle_proof.json', 'utf8'));
const ERC20_ABI = [
  // Only the needed fragment of ERC20 ABI
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

// --- Env vars ---
const {
  PRIVATE_KEY_GAS,
  GAS_WALLET,
  PRIVATE_KEY_COMPROMISE,
  COMPROMISE_WALLET,
  MERKLE_CONTRACT,
  ETH_MAINNET_RPC,
  TOKEN_CONTRACT
} = process.env;

function throwIfUndefined(obj, keys) {
  for (const k of keys) {
    if (obj[k] === undefined) {
      throw new Error(`Missing required value for '${k}' in merkle_proof.json or environment variables!`);
    }
  }
}

async function main() {
  throwIfUndefined(process.env, [
    'PRIVATE_KEY_GAS', 'GAS_WALLET', 'PRIVATE_KEY_COMPROMISE', 'COMPROMISE_WALLET',
    'MERKLE_CONTRACT', 'ETH_MAINNET_RPC', 'TOKEN_CONTRACT'
  ]);
  throwIfUndefined(MERKLE_PROOF, ['index', 'account', 'amount', 'merkleProof']);

  const provider = new ethers.JsonRpcProvider(ETH_MAINNET_RPC);
  const gasWallet = new ethers.Wallet(PRIVATE_KEY_GAS, provider);
  const compromiseWallet = new ethers.Wallet(PRIVATE_KEY_COMPROMISE, provider);
  const authSigner = ethers.Wallet.createRandom();
  const flashbots = await FlashbotsBundleProvider.create(provider, authSigner);
  const airdrop = new ethers.Contract(MERKLE_CONTRACT, AIRDROP_ABI, compromiseWallet);
  const token = new ethers.Contract(TOKEN_CONTRACT, ERC20_ABI, compromiseWallet);

  let { index, account, amount, merkleProof } = MERKLE_PROOF;
  if (typeof index !== 'bigint') index = BigInt(index);
  if (typeof amount !== 'string') amount = amount.toString();
  if (!Array.isArray(merkleProof)) throw new Error("merkleProof must be an array!");
  merkleProof = merkleProof.map((p) => p.startsWith('0x') ? p : '0x' + p);

  // --- Fixed Gas Limits ---
  const tx1GasLimit = 21000n;
  const tx2GasLimit = 240000n; // claim
  const tx3GasLimit = 50000n;  // transfer tokens

  // --- Dynamic Gas Prices (increase on each failed attempt) ---
  let maxFeePerGas = 1_100_000_000n; // 1.1 gwei
  let maxPriorityFeePerGas = 1_100_000_000n;
  const gasIncreasePercent = 0;

  // --- Calculate amounts for 90% send ---
  const chainId = (await provider.getNetwork()).chainId;
  let gasWalletNonce = await provider.getTransactionCount(gasWallet.address);
  let compromiseNonce = await provider.getTransactionCount(compromiseWallet.address);

  async function printFeeBreakdown(amountToSend) {
    const gasBalance = await provider.getBalance(gasWallet.address);
    const txFee1 = maxFeePerGas * tx1GasLimit;
    const txFee2 = maxFeePerGas * tx2GasLimit;
    const txFee3 = maxFeePerGas * tx3GasLimit;
    const totalGasFee = txFee1 + txFee2 + txFee3;
    const totalRequired = amountToSend + totalGasFee;

    console.log(`\n--- Fee Breakdown ---`);
    console.log(`1 tx (send ETH)            : Gas fee = ${ethers.formatEther(txFee1)} ETH`);
    console.log(`2 tx (claim airdrop)       : Gas fee = ${ethers.formatEther(txFee2)} ETH`);
    console.log(`3 tx (transfer token)      : Gas fee = ${ethers.formatEther(txFee3)} ETH`);
    console.log(`Total gas fees             : ${ethers.formatEther(totalGasFee)} ETH`);
    console.log(`Amount to send (90%)       : ${ethers.formatEther(amountToSend)} ETH`);
    console.log(`Total required (gas+send)  : ${ethers.formatEther(totalRequired)} ETH`);
    console.log(`Current wallet balance     : ${ethers.formatEther(gasBalance)} ETH\n`);

    if (gasBalance < totalRequired) {
      const shortage = totalRequired - gasBalance;
      console.error(`Not enough balance in GAS_WALLET!`);
      console.error(`You are short by: ${ethers.formatEther(shortage)} ETH`);
      process.exit(1);
    }
    console.log("Sufficient balance, continuing...");
  }

  // ---- Main Loop ----
  let included = false;
  let attempt = 1;
  while (!included) {
    // Calculate dynamic balance/amount each time
    const gasBalance = await provider.getBalance(gasWallet.address);
    const txFee1 = maxFeePerGas * tx1GasLimit;
    const txFee2 = maxFeePerGas * tx2GasLimit;
    const txFee3 = maxFeePerGas * tx3GasLimit;
    const spendable = gasBalance - txFee1 - txFee2 - txFee3;
    const amountToSend = (spendable > 0n) ? spendable * 9n / 10n : 0n;

    await printFeeBreakdown(amountToSend);

    // 1. Send 90% ETH to compromised wallet
    const tx1Send = {
      chainId,
      to: compromiseWallet.address,
      value: amountToSend,
      gasLimit: tx1GasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
      nonce: gasWalletNonce,
      type: 2
    };
    const signedTx1 = await gasWallet.signTransaction(tx1Send);

    // 2. Claim airdrop
    const tx2data = await airdrop.getFunction('claim').populateTransaction(
      index,
      account,
      amount,
      merkleProof
    );
    const tx2 = {
      chainId,
      to: MERKLE_CONTRACT,
      data: tx2data.data,
      value: 0,
      gasLimit: tx2GasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
      nonce: compromiseNonce,
      type: 2
    };
    const signedTx2 = await compromiseWallet.signTransaction(tx2);

    // 3. Transfer airdropped token to gas wallet
    // Get the token balance dynamically after claim (simulate max possible; if you know amount, use it)
    const tokenBalance = await token.balanceOf(compromiseWallet.address);
    const tx3data = await token.getFunction('transfer').populateTransaction(
      gasWallet.address,
      tokenBalance
    );
    const tx3 = {
      chainId,
      to: TOKEN_CONTRACT,
      data: tx3data.data,
      value: 0,
      gasLimit: tx3GasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
      nonce: compromiseNonce + 1,
      type: 2
    };
    const signedTx3 = await compromiseWallet.signTransaction(tx3);

    console.log(`\n1 tx: Send ${ethers.formatEther(amountToSend)} ETH (90%) from gas wallet to compromised wallet`);
    console.log(`2 tx: claim() called on airdrop contract`);
    console.log(`3 tx: transfer() airdrop token from compromised wallet to gas wallet`);

    const blockNumber = await provider.getBlockNumber();
    const targetBlock = blockNumber + 1;
    const bundle = [
      { signedTransaction: signedTx1 },
      { signedTransaction: signedTx2 },
      { signedTransaction: signedTx3 }
    ];

    console.log("\nWaiting for inclusion in block...");
    const response = await flashbots.sendRawBundle(
      bundle.map(tx => tx.signedTransaction),
      targetBlock
    );
    if ('error' in response) {
      console.error('Flashbots Error:', response.error.message);
      break;
    }
    const wait = await response.wait();
    if (wait === 0) {
      console.log("Bundle included in target block!");
      included = true;
    } else {
      console.log(`Not included, increasing gas by ${gasIncreasePercent}% and trying next block... (attempt ${attempt})`);
      // Increase gas dynamically for next attempt
      maxFeePerGas = maxFeePerGas * BigInt(100 + gasIncreasePercent) / 100n;
      maxPriorityFeePerGas = maxPriorityFeePerGas * BigInt(100 + gasIncreasePercent) / 100n;
      attempt += 1;
      await new Promise(r => setTimeout(r, 12000));
    }

    // Update nonces for next try
    gasWalletNonce = await provider.getTransactionCount(gasWallet.address);
    compromiseNonce = await provider.getTransactionCount(compromiseWallet.address);
  }
}

main().catch(e => {
  console.error('\n--- Script Error ---');
  console.error(e);
});
