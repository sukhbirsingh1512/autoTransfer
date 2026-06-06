export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

export const STAKING_ABI = [
  'function stake(uint256 amount, address _referrer) external',
  // Registered-user record. Field order matters and must match the on-chain struct.
  'function users(address) view returns (bool isExist, uint256 userId, address referrer, uint256 joiningTime, uint256 boosterLastClaim, uint256 swapWallet, uint256 selfInvestment, bool booster)',
];
