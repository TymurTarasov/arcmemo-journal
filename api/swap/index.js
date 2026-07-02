import { createClient } from "@supabase/supabase-js";
import { createPublicClient, createWalletClient, http, fallback, encodeFunctionData, decodeFunctionData, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";

export const config = { maxDuration: 60 };

const supabase = createClient(
  "https://doiwypvywdlchsscxsyt.supabase.co",
  "sb_publishable_3uY_y0K1kr2F468sqmMmhg_MowMC6Y7"
);

const ARC_TESTNET = {
  id: 5042002, name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://arc-testnet.drpc.org", "https://rpc.testnet.arc.network", "https://arc-testnet.gateway.tenderly.co"] } },
};
const RPC_URLS = ["https://arc-testnet.drpc.org", "https://rpc.testnet.arc.network", "https://arc-testnet.gateway.tenderly.co"];

const TOKENS = {
  USDC: { address: "0x3600000000000000000000000000000000000000", decimals: 6 },
  EURC: { address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals: 6 },
};

const ERC20_ABI = [
  { name: "transfer", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
];

const publicClient = createPublicClient({
  chain: ARC_TESTNET,
  transport: fallback(RPC_URLS.map(url => http(url, { retryCount: 2, retryDelay: 500 }))),
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { wallet, depositTxHash, tokenIn, tokenOut, amountIn } = req.body || {};
  if (!wallet || !depositTxHash || !tokenIn || !tokenOut || !amountIn) {
    return res.status(400).json({ error: "Missing fields" });
  }
  if (!TOKENS[tokenIn] || !TOKENS[tokenOut] || tokenIn === tokenOut) {
    return res.status(400).json({ error: "Invalid token pair" });
  }

  const relayerAccount = privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY);
  let swapRow;

  try {
    const tx = await publicClient.getTransaction({ hash: depositTxHash });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: depositTxHash, timeout: 20000 });
    if (receipt.status !== "success") throw new Error("Deposit transaction failed on-chain");
    if (tx.from.toLowerCase() !== wallet.toLowerCase()) throw new Error("Deposit sender mismatch");
    if (tx.to.toLowerCase() !== TOKENS[tokenIn].address.toLowerCase()) throw new Error("Deposit token mismatch");

    const decoded = decodeFunctionData({ abi: ERC20_ABI, data: tx.input });
    const [depositTo, depositAmount] = decoded.args;
    if (depositTo.toLowerCase() !== relayerAccount.address.toLowerCase()) throw new Error("Deposit recipient mismatch — not sent to relayer");
    const expected = parseUnits(String(amountIn), TOKENS[tokenIn].decimals);
    if (depositAmount < expected) throw new Error("Deposit amount too low");

    const { data } = await supabase.from("swaps").insert({
      wallet: wallet.toLowerCase(), token_in: tokenIn, token_out: tokenOut,
      amount_in: parseFloat(amountIn), deposit_txhash: depositTxHash, status: "pending",
    }).select().single();
    swapRow = data;

    const kit = new AppKit();
    const adapter = createViemAdapterFromPrivateKey({ privateKey: process.env.RELAYER_PRIVATE_KEY });
    const result = await kit.swap({
      from: { adapter, chain: "Arc_Testnet" },
      tokenIn, tokenOut, amountIn: String(amountIn),
      config: { kitKey: process.env.KIT_KEY },
    });

    const wc = createWalletClient({ account: relayerAccount, chain: ARC_TESTNET, transport: http(RPC_URLS[0]) });
    const payoutData = encodeFunctionData({
      abi: ERC20_ABI, functionName: "transfer",
      args: [wallet, parseUnits(String(result.amountOut), TOKENS[tokenOut].decimals)],
    });
    const payoutHash = await wc.sendTransaction({ to: TOKENS[tokenOut].address, data: payoutData });

    await supabase.from("swaps").update({
      amount_out: parseFloat(result.amountOut), payout_txhash: payoutHash, status: "done",
    }).eq("id", swapRow.id);

    return res.status(200).json({
      success: true, amountOut: result.amountOut, payoutTxHash: payoutHash,
      explorerUrl: "https://testnet.arcscan.app/tx/" + payoutHash,
    });
  } catch (err) {
    console.error("Swap error:", err);
    if (swapRow) await supabase.from("swaps").update({ status: "failed", error: String(err.message || err) }).eq("id", swapRow.id);
    return res.status(500).json({ error: String(err.message || err) });
  }
}