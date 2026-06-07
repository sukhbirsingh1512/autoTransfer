# Sweeper — gasless single-tx sweeps for compromised wallets

When a monitoring wallet's private key is in the hands of an attacker, every "fund
the wallet with BNB, then transfer tokens" sweep is a race the attacker can win
in the gap between the two transactions. The Sweeper contract collapses that race
into a single transaction that the attacker can't sign:

1. **One-time setup, per (wallet, token)**:
   the monitoring wallet signs `token.approve(sweeper, MAX)`. After that, the
   sweeper contract is allowed to pull `token` from the wallet on demand.
2. **Every sweep after that**:
   the *relay wallet* (Sweeper owner) signs
   `sweeper.drain(token, monitoringWallet, secureWallet)`. The contract
   internally executes `token.transferFrom(monitoringWallet, secureWallet,
   balance)`. The compromised wallet does not sign anything and does not pay
   gas — the relay does.

The hacker, holding the wallet's private key, **cannot** call `drain()` because
it's gated on `msg.sender == owner`. To bypass it they have to either revoke our
approval (needs BNB in the wallet → same 2-tx race they already lose) or run a
regular `transfer()` (same race).

## Deploy on testnet

```bash
cd backend
npm install                       # installs solc as a devDependency
npm run sweeper:build              # compiles Sweeper.sol → contracts/Sweeper.json
npm run sweeper:deploy             # deploys using the highest-priority active Master Gas Wallet
```

Take the printed address and put it in `backend/.env`:

```ini
SWEEPER_CONTRACT_ADDRESS=0x...
```

Restart workers (`npm run workers` or `pm2 restart fundsTransfer-workers`).

To deploy with a specific gas wallet instead of the highest-priority one, pass
its address:

```bash
node scripts/deploySweeper.js 0x3b572bB1...
```

## Set up approvals

From the admin panel: **Sweeper Contract → Set up approval**. Pick a monitoring
wallet + token. The backend:

1. Estimates the gas cost of one `approve(sweeper, MAX)` call (~70k gas at the
   live gas price + 25% buffer).
2. Tops up the wallet with **exactly** that amount of BNB from a Master Gas
   Wallet (this is the only time we ever fund the compromised wallet for the
   sweeper path).
3. Signs `approve(sweeper, MAX)` from the wallet, waits for the receipt.
4. Saves a `SweeperApproval` record marked `CONFIRMED`.

From then on, the sweep worker sees the approval and skips top-up entirely on
incoming tokens — single tx, ~one block end-to-end.

## Audit

The contract is short. Suggested checks before mainnet:

- Solc 0.8.26, optimizer enabled (200 runs), no external libs.
- Only `drain` and `drainAmount` move tokens; both `onlyOwner`.
- No `selfdestruct`, no delegatecall, no upgradeability.
- Ownership transfer is two-step (`transferOwnership` + `acceptOwnership`) so a
  typo in the new owner address can't brick the contract.

Bytecode hash printed by `compileSweeper.js` should match what BscScan shows for
the deployed contract.
