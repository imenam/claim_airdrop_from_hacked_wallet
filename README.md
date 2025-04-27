
1. **Setup**  
install [node js](https://nodejs.org/en/download)

   Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/imenam/flashbot-claim-bundle.git
   cd flashbot-claim-bundle
   npm install
3. **Edit .env with your values**

PRIVATE_KEY_GAS=0xYOUR_GAS_PRIVATE_KEY
GAS_WALLET=0xYOUR_GAS_WALLET_ADDRESS

PRIVATE_KEY_COMPROMISE=0xYOUR_COMPROMISE_PRIVATE_KEY
COMPROMISE_WALLET=0xYOUR_COMPROMISE_WALLET_ADDRESS

MERKLE_CONTRACT=0x906C60f013CA4b97c68dEd189a737892F9d6243e
AIRDROP_TOKEN=0xE1F23869776c82f691d9Cb34597Ab1830Fb0De58

ETH_MAINNET_RPC=https://rpc.ankr.com/eth
MAX_FEE_PER_GAS=10000000000
MAX_PRIORITY_FEE_PER_GAS=500000000

*stHYPER users: ✅ No changes needed in MERKLE_CONTRACT,AIRDROP_TOKEN*

3.**ABI & merkle Proof**

stHYPER users: ✅ No changes needed

Other airdrops:
Update airdrop_abi.json with the new contract’s ABI (from Etherscan → Contract→code→ ABI).

Replace merkle_proof.json with your Merkle proof array. (check image)

4. ***Execute the bundle with**:

```bash
node rescue.js
