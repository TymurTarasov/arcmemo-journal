import { verifyMessage } from "viem";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { wallet, message, signature } = req.body || {};
  if (!wallet || !message || !signature) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    // Reject stale signatures (older than 5 minutes) to limit replay risk
    const tsMatch = message.match(/Timestamp: (\d+)/);
    if (!tsMatch || Date.now() - Number(tsMatch[1]) > 5 * 60 * 1000) {
      return res.status(401).json({ error: "Signature expired, please try again" });
    }

    const valid = await verifyMessage({ address: wallet, message, signature });
    if (!valid) return res.status(401).json({ error: "Invalid signature" });

    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
      {
        sub: wallet.toLowerCase(),
        wallet: wallet.toLowerCase(),
        role: "authenticated",
        aud: "authenticated",
        iat: now,
        exp: now + 24 * 60 * 60, // 24h
      },
      process.env.SUPABASE_JWT_SECRET
    );

    return res.status(200).json({ token });
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}