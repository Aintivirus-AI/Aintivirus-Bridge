import b58 from "bs58";
import bip39 from "bip39";
import solanaWeb3 from "@solana/web3.js";

export function deriveSolAddressFromKey(key: string): string {
  return solanaWeb3.Keypair.fromSecretKey(b58.decode(key.toString().trim())).publicKey.toBase58();
}

export function deriveSolAddressFromMemonic(phrase: string): string {
  const seed = bip39.mnemonicToSeedSync(phrase, "");
  const keypair = solanaWeb3.Keypair.fromSeed(seed.slice(0, 32));
  return keypair.publicKey.toBase58();
}

const getKeyPair = (mnemomic: string) => {
  const seed = bip39.mnemonicToSeedSync(mnemomic).slice(0, 32);
  const Keypair = solanaWeb3.Keypair.fromSeed(seed);
  return Keypair.secretKey.toString();
};
