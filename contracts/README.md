# JARVIS Contracts

Foundry project with `SimpleVault` — deployable via JARVIS voice ("prepare a SimpleVault deploy").

```bash
cd contracts
forge install foundry-rs/forge-std --no-commit
forge build
forge script script/DeploySimpleVault.s.sol --rpc-url $RPC --broadcast
```
