
# Flashbot Claim Bundle Setup Guide

## 1. **Setup**

### Install Node.js
To get started, you need to install Node.js. Download and install it from the official [Node.js website](https://nodejs.org/en/download).

### Clone the Repository and Install Dependencies
Clone the repository and install the required dependencies by running the following commands:

```bash
git clone https://github.com/imenam/claim_airdrop_from_hacked_wallet.git
cd flashbot-claim-bundle
npm install
```

## 2. **Configure `.env` File**

Next, configure your `.env` file by adding your personal wallet keys and contract details. Here’s an example `.env` configuration:

```plaintext
PRIVATE_KEY_GAS=0xYOUR_GAS_PRIVATE_KEY
GAS_WALLET=0xYOUR_GAS_WALLET_ADDRESS

PRIVATE_KEY_COMPROMISE=0xYOUR_COMPROMISE_PRIVATE_KEY
COMPROMISE_WALLET=0xYOUR_COMPROMISE_WALLET_ADDRESS

MERKLE_CONTRACT=0x906C60f013CA4b97c68dEd189a737892F9d6243e
AIRDROP_TOKEN=0xE1F23869776c82f691d9Cb34597Ab1830Fb0De58

ETH_MAINNET_RPC=https://rpc.ankr.com/eth
MAX_FEE_PER_GAS=10000000000
MAX_PRIORITY_FEE_PER_GAS=500000000
```

- **stHYPER Users**: If you're a stHYPER user, no changes are needed for `MERKLE_CONTRACT` or `AIRDROP_TOKEN`.

## 3. **ABI & Merkle Proof**

### stHYPER Users
- ✅ No changes are required for `MERKLE_CONTRACT` and `AIRDROP_TOKEN`.

### Other Airdrop Users
If you're claiming from a different airdrop:
- **Update the ABI**: Update the `airdrop_abi.json` file with the new contract's ABI. You can find this on [Etherscan](https://etherscan.io) under the contract’s code section.
- **Replace Merkle Proof**: Replace the `merkle_proof.json` file with your Merkle proof array. (Make sure to check your airdrop details for the correct proof format.)

## 4. **Execute the Bundle**

After configuring everything, run the bundle by executing the following command:

```bash
node rescue.js
```

This will start the claim process using the values you configured in the `.env` file.

---

If you encounter any issues or need additional assistance, feel free to reach out!
