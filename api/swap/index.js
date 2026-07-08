import { createClient } from "@supabase/supabase-js";
import { createPublicClient, createWalletClient, http, fallback, encodeFunctionData, decodeFunctionData, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const supabase = createClient(
  "https://doiwypvywdlchsscxsyt.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ARC_TESTNET = {
  id: 5042002, name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://arc-testnet.drpc.org", "https://rpc.testnet.arc.network", "https://arc-testnet.gateway.tenderly.co"] } },
};
const RPC_URLS = ["https://arc-testnet.drpc.org", "https://rpc.testnet.arc.network", "https://arc-testnet.gateway.tenderly.co"];

const TOKENS = {
  USDC:   { address: "0x3600000000000000000000000000000000000000" },
  USDT:   { address: "0x175CdB1D338945f0D851A741ccF787D343E57952" },
  EURC:   { address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" },
  cirBTC: { address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF" },
};

const ERC20_ABI = [
  { name: "transfer", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
];

const publicClient = createPublicClient({
  chain: ARC_TESTNET,
  transport: fallback(RPC_URLS.map(url => http(url, { retryCount: 2, retryDelay: 500 }))),
});

async function getDecimals(symbol) {
  return await publicClient.readContract({ address: TOKENS[symbol].address, abi: ERC20_ABI, functionName: "decimals" });
}

async function getRates() {
  const [fx, btc] = await Promise.all([
    fetch("https://open.er-api.com/v6/latest/USD").then(r => r.json()),
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd").then(r => r.json()),
  ]);
  return { EURC: fx.rates.EUR, cirBTC: btc.bitcoin.usd, USDC: 1, USDT: 1 };
}
function toUSD(symbol, amount, rates) {
  if (symbol === "EURC") return amount / rates.EURC;
  if (symbol === "cirBTC") return amount * rates.cirBTC;
  return amount;
}
function fromUSD(symbol, usd, rates) {
  if (symbol === "EURC") return usd * rates.EURC;
  if (symbol === "cirBTC") return usd / rates.cirBTC;
  return usd;
}

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { wallet, depositTxHash, tokenIn, tokenOut, amountIn } = req.body || {};
  if (!wallet || !depositTxHash || !tokenIn || !tokenOut || !amountIn) return res.status(400).json({ error: "Missing fields" });
  if (!TOKENS[tokenIn] || !TOKENS[tokenOut] || tokenIn === tokenOut) return res.status(400).json({ error: "Invalid token pair" });

  const relayerAccount = privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY);
  let swapRow;

  try {
    const decimalsIn = await getDecimals(tokenIn);
    const tx = await publicClient.getTransaction({ hash: depositTxHash });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: depositTxHash, timeout: 20000 });
    if (receipt.status !== "success") throw new Error("Deposit transaction failed on-chain");
    if (tx.from.toLowerCase() !== wallet.toLowerCase()) throw new Error("Deposit sender mismatch");
    if (tx.to.toLowerCase() !== TOKENS[tokenIn].address.toLowerCase()) throw new Error("Deposit token mismatch");

    const decoded = decodeFunctionData({ abi: ERC20_ABI, data: tx.input });
    const [depositTo, depositAmount] = decoded.args;
    if (depositTo.toLowerCase() !== relayerAccount.address.toLowerCase()) throw new Error("Deposit recipient mismatch");
    const expected = parseUnits(String(amountIn), decimalsIn);
    if (depositAmount < expected) throw new Error("Deposit amount too low");

    const { data } = await supabase.from("swaps").insert({
      wallet: wallet.toLowerCase(), token_in: tokenIn, token_out: tokenOut,
      amount_in: parseFloat(amountIn), deposit_txhash: depositTxHash, status: "pending",
    }).select().single();
    swapRow = data;

    const rates = await getRates();
    const usdValue = toUSD(tokenIn, parseFloat(amountIn), rates);
    const amountOut = fromUSD(tokenOut, usdValue, rates);
    const decimalsOut = await getDecimals(tokenOut);

    const wc = createWalletClient({ account: relayerAccount, chain: ARC_TESTNET, transport: http(RPC_URLS[0]) });
    const payoutData = encodeFunctionData({
      abi: ERC20_ABI, functionName: "transfer",
      args: [wallet, parseUnits(amountOut.toFixed(decimalsOut), decimalsOut)],
    });
    const payoutHash = await wc.sendTransaction({ to: TOKENS[tokenOut].address, data: payoutData });

    await supabase.from("swaps").update({ amount_out: amountOut, payout_txhash: payoutHash, status: "done" }).eq("id", swapRow.id);

    return res.status(200).json({
      success: true, amountOut: amountOut.toFixed(6), payoutTxHash: payoutHash,
      explorerUrl: "https://testnet.arcscan.app/tx/" + payoutHash,
    });
  } catch (err) {
    console.error("Swap error:", err);
    if (swapRow) await supabase.from("swaps").update({ status: "failed", error: String(err.message || err) }).eq("id", swapRow.id);
    return res.status(500).json({ error: String(err.message || err) });
  }
}