import { EndpointId } from "@layerzerolabs/lz-definitions";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { mainnet } from "wagmi/chains";
// import { sepolia } from "wagmi/chains";

// const TESTNET = {
//   isTestnet: true,
//   ethereum: {
//     name: "Ethereum (sepolia)",
//     eid: EndpointId.SEPOLIA_V2_TESTNET, // 40161
//     wagmiChain: sepolia,
//   },
//   solana: {
//     name: "Solana (devnet)",
//     eid: EndpointId.SOLANA_V2_TESTNET, // 40168
//   },
//   solanaOFT: {
//     oftProgramIdStr: "8cnHHjBEwraSwzYvJZApU4AoKRsMSQqbCtpyDLr4Z72w",
//     tokenProgramStr: TOKEN_PROGRAM_ID.toBase58(),
//     mintStr: "8pfHJ12DNZP4fHpbUDPoSNUSBTk2Cmxr94YaSo96dWLS",
//     escrowStr: "8UbVZKH1Wxhmq9wEMfoPKTgKvp94TmgY44oYhPUCKQnR",
//   },
//   ethereumOFT: {
//     oft: "0x63CabFA80F1EceF792F4b6E198Fc31f2e94C33C0",
//   },
// };

const MAINNET = {
  isTestnet: false,
  ethereum: {
    name: "Ethereum",
    eid: EndpointId.ETHEREUM_V2_MAINNET, // 30101
    wagmiChain: mainnet,
  },
  solana: {
    name: "Solana",
    eid: EndpointId.SOLANA_V2_MAINNET, // 30168
  },
  solanaOFT: {
    oftProgramIdStr: "4xAHdP5JjQ4X5HqP6RvcyBevqTikXkCo8VQ65if2rbQe",
    tokenProgramStr: TOKEN_PROGRAM_ID.toBase58(),
    mintStr: "BAezfVmia8UYLt4rst6PCU4dvL2i2qHzqn4wGhytpNJW",
    escrowStr: "EEuNW4FkDtMSLjmH9zoUHCydKu5AJZYAzqAxtMMFXkBr",
  },
  ethereumOFT: {
    oft: "0x686c5961370Db7F14F57f5a430e05DeaE64df504",
  },
};

// const BridgeConfig = TESTNET;
const BridgeConfig = MAINNET;

export default BridgeConfig;
