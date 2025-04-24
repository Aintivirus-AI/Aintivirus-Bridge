import { useCallback } from "react";
import { fromBytes, Hex, erc20Abi } from "viem";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { useWriteContract, useAccount } from "wagmi";
import { readContract } from "@wagmi/core";
import { abi } from "../oft-abi";
import { config } from "../wagmi";
import { useReadContract } from "wagmi";
import BridgeConfig from "../bridge-config";

const { solana, ethereumOFT } = BridgeConfig;

interface Props {
  sendToSolana: (to: string, amount: bigint) => Promise<void>;
  isPending: boolean;
  isSuccess: boolean;
  hash: string;
  address: string | undefined;
  tokenBalance: bigint;
}

export const useEthereum = (): Props => {
  const { data: hash, isPending, isSuccess, writeContract } = useWriteContract();
  const account = useAccount();
  const accountAddress = account.address!;

  const { data: tokenBalance } = useReadContract({
    address: ethereumOFT.oft as Hex,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [accountAddress],
    query: { gcTime: 5 * 60 * 1000 }, // 5min cache time
  });

  // https://viem.sh/docs/contract/writeContract#writecontract
  const sendToSolana = useCallback(async (to: string, amount: bigint) => {
    const sendParam = {
      dstEid: solana.eid,
      to: to as Hex,
      amountLD: amount,
      minAmountLD: (amount * 90_00n) / 100_00n,
      extraOptions: fromBytes(Options.newOptions().addExecutorLzReceiveOption(200000, 2500000).toBytes(), "hex"),
      composeMsg: "0x" as Hex,
      oftCmd: "0x" as Hex,
    };

    const fees = await readContract(config, {
      abi,
      address: ethereumOFT.oft as Hex,
      functionName: "quoteSend",
      args: [sendParam, false],
    });

    writeContract({
      address: ethereumOFT.oft as Hex,
      abi,
      functionName: "send",
      args: [sendParam, fees, accountAddress],
      value: fees.nativeFee,
    });
  }, []);

  return {
    sendToSolana,
    isPending,
    isSuccess,
    hash: hash as string,
    address: accountAddress,
    tokenBalance: tokenBalance || 0n,
  };
};
