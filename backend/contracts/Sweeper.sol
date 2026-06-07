// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transferFrom(address, address, uint256) external returns (bool);
}

/// @title Pull-style BEP20 token sweeper
/// @notice Each compromised wallet pre-approves this contract once
///         (approve(this, MAX_UINT256)). Afterwards, only the contract owner
///         (the operator's relay wallet) can call `drain()` to pull all balance
///         from `from` to `to` in a single transaction. The compromised wallet
///         never needs BNB for subsequent sweeps — gas is paid by the relay
///         wallet that calls this contract.
///
///         The hacker, sharing the compromised wallet's private key, cannot
///         drain through this contract because every drain() entry point is
///         gated on `msg.sender == owner`. To bypass it the hacker would have
///         to either (a) revoke our approval and set up their own sweeper —
///         which requires BNB in the compromised wallet, i.e. the same
///         multi-tx race they already lose, or (b) do a normal `transfer()`
///         from the compromised wallet — same multi-tx race.
contract Sweeper {
    address public owner;
    address public pendingOwner;

    event Drained(address indexed token, address indexed from, address indexed to, uint256 amount);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error NotPendingOwner();
    error ZeroAddress();
    error TransferFailed();

    constructor(address _owner) {
        owner = _owner == address(0) ? msg.sender : _owner;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Move the full available balance of `token` from `from` to `to`.
    /// @dev Requires `from` to have approved this contract for the token first.
    /// @return amount The amount actually moved (0 if nothing to sweep).
    function drain(IERC20 token, address from, address to)
        external
        onlyOwner
        returns (uint256 amount)
    {
        if (to == address(0)) revert ZeroAddress();
        amount = token.balanceOf(from);
        if (amount == 0) return 0;
        bool ok = token.transferFrom(from, to, amount);
        if (!ok) revert TransferFailed();
        emit Drained(address(token), from, to, amount);
    }

    /// @notice Move exactly `amount` of `token` from `from` to `to`.
    ///         Useful for unit tests; production sweeps should prefer drain().
    function drainAmount(IERC20 token, address from, address to, uint256 amount)
        external
        onlyOwner
    {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) return;
        bool ok = token.transferFrom(from, to, amount);
        if (!ok) revert TransferFailed();
        emit Drained(address(token), from, to, amount);
    }

    /// @notice Two-step ownership transfer.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }
}
