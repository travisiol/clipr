import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getAddress, isAddress, verifyMessage } from "viem";
import { putNonce, takeNonce } from "@/lib/db";
import { signInMessage } from "@/lib/signin";
import { isLive } from "@/lib/contracts";

/**
 * Sign-in with a wallet, kept deliberately small: the server hands out a
 * nonce, the wallet signs a readable message containing it, the server
 * verifies the signature and sets an HMAC-signed session cookie. No
 * passwords, no accounts, no email — a wallet is the identity, the same one
 * the payouts go to.
 *
 * Smart-contract wallets (ERC-1271) are not supported by `verifyMessage`
 * here; that is a known gap, not an oversight.
 */

const SESSION_COOKIE = "clipr_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NONCE_TTL_MS = 10 * 60 * 1000;

let warned = false;
function secret(): Buffer {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) return Buffer.from(fromEnv, "utf8");
  // Per-process fallback: sessions survive only as long as the server does.
  if (!globalThis.__cliprSessionSecret) {
    globalThis.__cliprSessionSecret = randomBytes(32);
    if (!warned) {
      warned = true;
      console.warn("[clipr] SESSION_SECRET is unset — sessions will not survive a restart.");
    }
  }
  return globalThis.__cliprSessionSecret;
}

declare global {
  var __cliprSessionSecret: Buffer | undefined;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export type Session = {
  address: `0x${string}`;
  /** Platform operator: can verify views, settle and activate campaigns. */
  ops: boolean;
  expiresAt: number;
};

/**
 * Who counts as ops. `OPS_ADDRESSES` is a comma-separated list; in preview
 * mode with the list unset, every signed-in wallet is ops so the whole flow
 * can be tried end to end — the ops screen says so in its header.
 */
export function isOps(address: string): boolean {
  const list = (process.env.OPS_ADDRESSES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return !isLive;
  return list.includes(address.toLowerCase());
}

export const opsIsOpen = () => !isLive && !(process.env.OPS_ADDRESSES ?? "").trim();

// ─────────────────────────────── nonce ───────────────────────────────

export function issueNonce(): string {
  const nonce = randomBytes(16).toString("hex");
  putNonce(nonce, NONCE_TTL_MS);
  return nonce;
}

export async function verifySignIn(input: {
  address: string;
  nonce: string;
  issuedAt: string;
  signature: string;
}): Promise<{ ok: true; address: `0x${string}` } | { ok: false; reason: string }> {
  if (!isAddress(input.address)) return { ok: false, reason: "Not a valid address." };
  const issued = Date.parse(input.issuedAt);
  if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > NONCE_TTL_MS) {
    return { ok: false, reason: "Sign-in request expired — try again." };
  }
  if (!/^0x[0-9a-fA-F]{130}$/.test(input.signature)) return { ok: false, reason: "Malformed signature." };
  if (!takeNonce(input.nonce)) return { ok: false, reason: "Nonce unknown or already used — try again." };

  const address = getAddress(input.address);
  const valid = await verifyMessage({
    address,
    message: signInMessage(address, input.nonce, input.issuedAt),
    signature: input.signature as `0x${string}`,
  });
  if (!valid) return { ok: false, reason: "Signature does not match the address." };
  return { ok: true, address };
}

// ─────────────────────────────── session ─────────────────────────────

export async function setSession(address: `0x${string}`): Promise<Session> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ a: address, e: expiresAt }), "utf8").toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
  return { address, ops: isOps(address), expiresAt };
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  const expected = sign(payload);
  if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const { a, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { a: string; e: number };
    if (!isAddress(a) || typeof e !== "number" || e < Date.now()) return null;
    const address = getAddress(a);
    return { address, ops: isOps(address), expiresAt: e };
  } catch {
    return null;
  }
}

/** Route-handler helper: the session or a 401 response. */
export async function requireSession(): Promise<{ session: Session } | { response: Response }> {
  const session = await getSession();
  if (!session) {
    return { response: Response.json({ error: "Sign in with your wallet first." }, { status: 401 }) };
  }
  return { session };
}
