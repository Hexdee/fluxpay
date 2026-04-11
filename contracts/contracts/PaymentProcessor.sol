// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PaymentProcessor is EIP712 {
    using SafeERC20 for IERC20;

    struct PaymentIntent {
        bytes32 paymentId;
        address merchant;
        uint256 amount;
        uint256 expiresAt;
        bytes32 metadataHash;
    }

    bytes32 public constant PAYMENT_TYPEHASH =
        keccak256(
            "PaymentIntent(bytes32 paymentId,address merchant,uint256 amount,uint256 expiresAt,bytes32 metadataHash)"
        );

    address public immutable token;
    address public signer;

    mapping(bytes32 => bool) public paid;

    event PaymentCompleted(
        bytes32 indexed paymentId,
        address indexed merchant,
        address indexed payer,
        address token,
        uint256 amount
    );

    constructor(address token_, address signer_) EIP712("ConfluxCheckout", "1") {
        require(token_ != address(0), "TOKEN_ZERO");
        require(signer_ != address(0), "SIGNER_ZERO");
        token = token_;
        signer = signer_;
    }

    function pay(PaymentIntent calldata p, bytes calldata sig) external {
        require(p.merchant != address(0), "MERCHANT_ZERO");
        require(p.amount > 0, "AMOUNT_ZERO");
        require(p.expiresAt >= block.timestamp, "EXPIRED");
        require(!paid[p.paymentId], "ALREADY_PAID");

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    PAYMENT_TYPEHASH,
                    p.paymentId,
                    p.merchant,
                    p.amount,
                    p.expiresAt,
                    p.metadataHash
                )
            )
        );

        address recovered = ECDSA.recover(digest, sig);
        require(recovered == signer, "BAD_SIG");

        paid[p.paymentId] = true;
        IERC20(token).safeTransferFrom(msg.sender, p.merchant, p.amount);

        emit PaymentCompleted(p.paymentId, p.merchant, msg.sender, token, p.amount);
    }
}
