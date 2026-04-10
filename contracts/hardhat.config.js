require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");
require("dotenv/config");

const { RPC_URL, PRIVATE_KEY } = process.env;

const networks = {};
networks.espaceTestnet = {
  url: RPC_URL || "https://evmtestnet.confluxrpc.com",
  accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
  chainId: 71,
};

networks.espaceMainnet = {
  url: RPC_URL || "https://evm.confluxrpc.com",
  accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
  chainId: 1030,
};

networks.localhost = {
  url: "http://127.0.0.1:8545",
  chainId: 31337,
};

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      evmVersion: "paris",
    },
  },
  networks,
  sourcify: {
    enabled: false,
  },
  etherscan: {
    apiKey: {
      espaceTestnet: "espace",
      espaceMainnet: "espace",
    },
    customChains: [
      {
        network: "espaceTestnet",
        chainId: 71,
        urls: {
          apiURL: "https://evmapi-testnet.confluxscan.org/api/",
          browserURL: "https://evmtestnet.confluxscan.org/",
        },
      },
      {
        network: "espaceMainnet",
        chainId: 1030,
        urls: {
          apiURL: "https://evmapi.confluxscan.org/api/",
          browserURL: "https://evm.confluxscan.org/",
        },
      },
    ],
  },
};
