import bs58 from "bs58";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  fetchAddressLookupTable,
  findAssociatedTokenPda,
  setComputeUnitLimit,
  mplToolbox,
} from "@metaplex-foundation/mpl-toolbox";
import {
  AddressLookupTableInput,
  PublicKey,
  TransactionBuilder,
  publicKey,
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { EndpointId } from "@layerzerolabs/lz-definitions";
import { Options, addressToBytes32 } from "@layerzerolabs/lz-v2-utilities";
import { oft } from "@layerzerolabs/oft-v2-solana-sdk";
import { formatEid } from "@layerzerolabs/devtools";
import { createConnectionFactory, createRpcUrlFactory } from "@layerzerolabs/devtools-solana";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";

const LOOKUP_TABLE_ADDRESS: Partial<Record<EndpointId, PublicKey>> = {
  [EndpointId.SOLANA_V2_MAINNET]: publicKey("AokBxha6VMLLgf97B5VYHEtqztamWmYERBmmFvjuTzJB"),
  [EndpointId.SOLANA_V2_TESTNET]: publicKey("9thqPdbR27A1yLWw2spwJLySemiGMXxPnEvfmXVk4KuK"),
};

// SENDER: F14F1hXYsGCz19xQMy8yFZEV3joWbiGHEajA6ghf1oTa
const RPC_URL_SOLANA = "";
const RPC_URL_SOLANA_TESTNET = "https://api.devnet.solana.com";
const SOLANA_PRIVATE_KEY = "MqV3gGbiUpQbSLDJiQ84DYJ8ZogKLByX3zCHX81nBvjHfHnifchQf5Fk4m4PfcNWaJx78awg9dagpgGcpyX6XXr"; // bs58
const tokenProgramStr = TOKEN_PROGRAM_ID.toBase58();
const programIdStr = "8cnHHjBEwraSwzYvJZApU4AoKRsMSQqbCtpyDLr4Z72w";
const mintStr = "8pfHJ12DNZP4fHpbUDPoSNUSBTk2Cmxr94YaSo96dWLS";
const escrowStr = "8UbVZKH1Wxhmq9wEMfoPKTgKvp94TmgY44oYhPUCKQnR";
const fromEid: EndpointId = EndpointId.SOLANA_V2_TESTNET;
const toEid: number = EndpointId.SEPOLIA_V2_TESTNET;
const to = "0xAeA544425b62bC0AE3aaDD85500ECFffB35c4400"; // eth receiver
const amount: number = 1000000;

const main = async () => {
  const { umi, umiWalletSigner } = await deriveConnection(fromEid);

  const oftProgramId = publicKey(programIdStr);
  const mint = publicKey(mintStr);
  const umiEscrowPublicKey = publicKey(escrowStr);
  const tokenProgramId = tokenProgramStr ? publicKey(tokenProgramStr) : fromWeb3JsPublicKey(TOKEN_PROGRAM_ID);

  const tokenAccount = findAssociatedTokenPda(umi, {
    mint: publicKey(mintStr),
    owner: umiWalletSigner.publicKey,
    tokenProgramId,
  });

  if (!tokenAccount) {
    throw new Error(
      `No token account found for mint ${mintStr} and owner ${umiWalletSigner.publicKey} in program ${tokenProgramId}`
    );
  }

  const recipientAddressBytes32 = addressToBytes32(to);

  const { nativeFee } = await oft.quote(
    umi.rpc,
    {
      payer: umiWalletSigner.publicKey,
      tokenMint: mint,
      tokenEscrow: umiEscrowPublicKey,
    },
    {
      payInLzToken: false,
      to: Buffer.from(recipientAddressBytes32),
      dstEid: toEid,
      amountLd: BigInt(amount),
      minAmountLd: 1n,
      options: Options.newOptions().addExecutorLzReceiveOption(100000, 0).toBytes(),
      composeMsg: undefined,
    },
    {
      oft: oftProgramId,
    }
  );

  const ix = await oft.send(
    umi.rpc,
    {
      payer: umiWalletSigner,
      tokenMint: mint,
      tokenEscrow: umiEscrowPublicKey,
      tokenSource: tokenAccount[0],
    },
    {
      to: Buffer.from(recipientAddressBytes32),
      dstEid: toEid,
      amountLd: BigInt(amount),
      minAmountLd: (BigInt(amount) * BigInt(9)) / BigInt(10),
      options: Options.newOptions().addExecutorLzReceiveOption(100000, 0).toBytes(),
      composeMsg: undefined,
      nativeFee,
    },
    {
      oft: oftProgramId,
      token: tokenProgramId,
    }
  );
  const lookupTableAddress = LOOKUP_TABLE_ADDRESS[fromEid];

  if (!lookupTableAddress) {
    throw new Error(`No lookup table found for ${formatEid(fromEid)}`);
  }

  const addressLookupTableInput: AddressLookupTableInput = await fetchAddressLookupTable(umi, lookupTableAddress);

  const { signature } = await new TransactionBuilder([ix])
    .add(setComputeUnitLimit(umi, { units: 500_000 }))
    .setAddressLookupTables([addressLookupTableInput])
    .sendAndConfirm(umi);
  const transactionSignatureBase58 = bs58.encode(signature);
  console.log(`✅ Sent ${amount} token(s) to destination EID: ${toEid}!`);
  const isTestnet = fromEid == EndpointId.SOLANA_V2_TESTNET;
  console.log(
    `View Solana transaction here: ${getSolanaExplorerTxLink(transactionSignatureBase58.toString(), isTestnet)}`
  );
  console.log(`Track cross-chain transfer here: ${getLayerZeroScanLink(transactionSignatureBase58, isTestnet)}`);
};

const deriveConnection = async (eid: EndpointId) => {
  const privateKey = SOLANA_PRIVATE_KEY;
  const connectionFactory = createSolanaConnectionFactory();
  const connection = await connectionFactory(eid);
  const umi = createUmi(connection.rpcEndpoint).use(mplToolbox());
  const umiWalletKeyPair = umi.eddsa.createKeypairFromSecretKey(bs58.decode(privateKey));
  const umiWalletSigner = createSignerFromKeypair(umi, umiWalletKeyPair);
  umi.use(signerIdentity(umiWalletSigner));
  return {
    connection,
    umi,
    umiWalletKeyPair,
    umiWalletSigner,
  };
};

const createSolanaConnectionFactory = () =>
  createConnectionFactory(
    createRpcUrlFactory({
      [EndpointId.SOLANA_V2_MAINNET]: RPC_URL_SOLANA,
      [EndpointId.SOLANA_V2_TESTNET]: RPC_URL_SOLANA_TESTNET,
    })
  );

export const getLayerZeroScanLink = (hash: string, isTestnet = false) =>
  isTestnet ? `https://testnet.layerzeroscan.com/tx/${hash}` : `https://layerzeroscan.com/tx/${hash}`;

export const getSolanaExplorerTxLink = (hash: string, isTestnet = false) =>
  `https://explorer.solana.com/tx/${hash}?cluster=${isTestnet ? "devnet" : "mainnet-beta"}`;

main();
