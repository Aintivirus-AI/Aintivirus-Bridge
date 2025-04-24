import { useState, useCallback, useEffect } from "react";
import bs58 from "bs58";
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
  signerIdentity,
} from "@metaplex-foundation/umi";
import { createSignerFromWalletAdapter, WalletAdapter } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { EndpointId } from "@layerzerolabs/lz-definitions";
import { Options, addressToBytes32 } from "@layerzerolabs/lz-v2-utilities";
import { oft } from "@layerzerolabs/oft-v2-solana-sdk";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import pMemoize from "p-memoize";
import { type Commitment, Connection, type ConnectionConfig, PublicKey as Web3PublicKey } from "@solana/web3.js";
import type { EndpointBasedFactory } from "@layerzerolabs/devtools";
import { PhantomProvider } from "../utils/getPhantomProvider";
import { usePhantomWallet } from "./usePhantomWallet";
import BridgeConfig from "../bridge-config";
import { parseUnits } from "viem";

const { solana, ethereum, solanaOFT } = BridgeConfig;

type ConnectionFactory = EndpointBasedFactory<Connection>;

type RpcUrlFactory = EndpointBasedFactory<string>;

const RPC_URL_SOLANA = import.meta.env.VITE_SOLANA_MAINNET_URL;
const RPC_URL_SOLANA_TESTNET = "https://api.devnet.solana.com";

interface Props {
  sendToEthereum: (to: string, amount: bigint) => Promise<void>;
  isPending: boolean;
  isSuccess: boolean;
  hash: string;
  address: string | undefined;
  tokenBalance: bigint;
}

const getTokenBalance = async (walletAddress: string, tokenMintAddress: string): Promise<bigint> => {
  if (!walletAddress) return 0n;

  try {
    const connection = new Connection(RPC_URL_SOLANA, "confirmed");
    const walletTokenAccounts = await connection.getParsedTokenAccountsByOwner(new Web3PublicKey(walletAddress), {
      mint: new Web3PublicKey(tokenMintAddress),
    });
    if (walletTokenAccounts && walletTokenAccounts.value && walletTokenAccounts.value.length > 0) {
      const walletTokenAccount = walletTokenAccounts.value[0];
      const amount = walletTokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
      return parseUnits(amount.toString(), 6);
    }
  } catch (e) {
    console.error(e);
  }
  return 0n;
};

export const useSolana = (): Props => {
  const { publicKey, provider: phantomProvider } = usePhantomWallet();
  const [isPending, setSolanaPending] = useState("false");
  const [isSuccess, setSolanaSuccess] = useState("false");
  const [hash, setHash] = useState("");
  const [tokenBalance, setTokenBalance] = useState("0");

  const walletAddress = publicKey == null ? undefined : publicKey.toBase58();
  const delay = 60 * 1000; // 1min

  useEffect(() => {
    getTokenBalance(walletAddress!, BridgeConfig.solanaOFT.mintStr).then((balance) => {
      setTokenBalance(balance.toString());
    });
  }, [walletAddress]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      getTokenBalance(walletAddress!, BridgeConfig.solanaOFT.mintStr).then((balance) => {
        setTokenBalance(balance.toString());
      });
    }, delay);

    // Clear the interval on unmount
    return () => clearInterval(intervalId);
  }, [getTokenBalance, delay, walletAddress]);

  const sendToEthereum = useCallback(async (to: string, amount: bigint) => {
    try {
      setSolanaPending("true");
      const txHash = await send(phantomProvider!, { amount, to });
      setSolanaSuccess("true");
      setHash(txHash);
    } catch {
      setSolanaSuccess("false");
      setHash("");
    }
    setSolanaPending("false");
  }, []);

  return {
    sendToEthereum,
    isPending: isPending == "true",
    isSuccess: isSuccess == "true",
    hash,
    address: walletAddress,
    tokenBalance: BigInt(tokenBalance),
  };
};

const send = async (signer: PhantomProvider, { amount, to }: { amount: bigint; to: string }) => {
  const fromEid: EndpointId = solana.eid;
  const toEid: EndpointId = ethereum.eid;

  const { umi, umiWalletSigner } = await deriveConnection(fromEid, signer);

  const { tokenProgramStr, oftProgramIdStr, escrowStr, mintStr } = solanaOFT;

  const oftProgramId = publicKey(oftProgramIdStr);
  const mint = publicKey(mintStr);
  const umiEscrowPublicKey = publicKey(escrowStr);
  const tokenProgramId = publicKey(tokenProgramStr);

  const tokenAccount = findAssociatedTokenPda(umi, {
    mint,
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
      amountLd: amount,
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
    throw new Error(`No lookup table found for ${fromEid}`);
  }

  const addressLookupTableInput: AddressLookupTableInput = await fetchAddressLookupTable(umi, lookupTableAddress);

  const { signature } = await new TransactionBuilder([ix])
    .add(setComputeUnitLimit(umi, { units: 500_000 }))
    .setAddressLookupTables([addressLookupTableInput])
    .sendAndConfirm(umi);

  const transactionSignatureBase58 = bs58.encode(signature);

  return transactionSignatureBase58;
};

const deriveConnection = async (eid: EndpointId, phantomProvider: PhantomProvider) => {
  const connectionFactory = createSolanaConnectionFactory();
  const connection = await connectionFactory(eid);
  const umi = createUmi(connection.rpcEndpoint).use(mplToolbox());
  const signer = createSignerFromWalletAdapter(phantomProvider as WalletAdapter);
  umi.use(signerIdentity(signer));
  return {
    umi,
    umiWalletSigner: signer,
  };
};

const createSolanaConnectionFactory = () =>
  createConnectionFactory(
    createRpcUrlFactory({
      [EndpointId.SOLANA_V2_MAINNET]: RPC_URL_SOLANA,
      [EndpointId.SOLANA_V2_TESTNET]: RPC_URL_SOLANA_TESTNET,
    })
  );

const defaultRpcUrlFactory: RpcUrlFactory = (eid: EndpointId) => {
  switch (eid) {
    case EndpointId.SOLANA_V2_MAINNET:
    case EndpointId.SOLANA_MAINNET:
      return RPC_URL_SOLANA;

    case EndpointId.SOLANA_V2_TESTNET:
    case EndpointId.SOLANA_TESTNET:
      return RPC_URL_SOLANA_TESTNET;
  }

  throw new Error(`Could not find a default Solana RPC URL for eid ${eid}`);
};

const createRpcUrlFactory =
  (overrides: Partial<Record<EndpointId, string | null>> = {}): RpcUrlFactory =>
  (eid) =>
    overrides[eid] ?? defaultRpcUrlFactory(eid);

const createConnectionFactory = (
  urlFactory = defaultRpcUrlFactory,
  commitmentOrConfig?: Commitment | ConnectionConfig
): ConnectionFactory => pMemoize(async (eid) => new Connection(await urlFactory(eid), commitmentOrConfig));

const LOOKUP_TABLE_ADDRESS: Partial<Record<EndpointId, PublicKey>> = {
  [EndpointId.SOLANA_V2_MAINNET]: publicKey("AokBxha6VMLLgf97B5VYHEtqztamWmYERBmmFvjuTzJB"),
  [EndpointId.SOLANA_V2_TESTNET]: publicKey("9thqPdbR27A1yLWw2spwJLySemiGMXxPnEvfmXVk4KuK"),
};
