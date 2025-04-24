import BridgeConfig from "../bridge-config";

const { isTestnet } = BridgeConfig;

export const getLayerZeroScanLink = (hash: string) =>
  isTestnet ? `https://testnet.layerzeroscan.com/tx/${hash}` : `https://layerzeroscan.com/tx/${hash}`;

export const getSolanaExplorerTxLink = (hash: string) =>
  `https://explorer.solana.com/tx/${hash}?cluster=${isTestnet ? "devnet" : "mainnet-beta"}`;

export const getEthereumExplorerTxLink = (hash: string) =>
  isTestnet ? `https://sepolia.etherscan.io/tx/${hash}` : `https://etherscan.io/tx/${hash}`;
