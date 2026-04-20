# Contract Spec

Fluxpay smart contract specification

## Contract: PaymentProcessor

Target: Conflux eSpace (EVM)

### Goals

- Accept USDT0 payments
- Emit clear events for indexing
- Prevent tampering via server-signed payment intents

### Payment intent

Payment intent is created offchain and signed by the API server (EIP-712). The contract verifies the signature before accepting payment.

Struct (implemented in `contracts/contracts/PaymentProcessor.sol`):

```solidity
struct PaymentIntent {
  bytes32 paymentId;
  address merchant;
  uint256 amount;
  uint256 expiresAt;
  bytes32 metadataHash;
}
```

### Core functions

```solidity
function pay(PaymentIntent calldata p, bytes calldata sig) external;
```

### Behavior

- `pay()` verifies signature, expiry, and that the payment is unused
- Transfers `amount` of USDT0 from payer directly to the merchant
- Marks payment as completed
- Emits `PaymentCompleted`

### Events

```solidity
event PaymentCompleted(
  bytes32 indexed paymentId,
  address indexed merchant,
  address indexed payer,
  address token,
  uint256 amount
);
```

### Storage

```solidity
mapping(bytes32 => bool) public paid;
```

### Notes

- Token address is immutable on the contract (`token`) and does not need to be passed in each intent.
