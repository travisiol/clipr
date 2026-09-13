"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useConnect, useConnection, useDisconnect, useSignMessage, useSwitchChain } from "wagmi";
import { robinhoodChain } from "@/lib/chain";
import { signInMessage } from "@/lib/signin";

/**
 * The signed-in identity, shared by every screen. The server's cookie is the
 * source of truth; this context mirrors it, and `signIn` walks the wallet
 * through connect → sign → verify with each step's failure shown, never
 * swallowed.
 */

export type SessionValue = {
  session: { address: `0x${string}`; ops: boolean; expiresAt: number } | null;
  opsOpen: boolean;
};

type Step = "idle" | "connecting" | "signing" | "verifying";

type Ctx = SessionValue & {
  step: Step;
  error: string | null;
  walletAvailable: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

/** Is there actually a wallet in this browser? wagmi's injected connector is
 *  always registered, so its presence says nothing. */
function useWalletAvailable(): boolean {
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    let found = typeof window !== "undefined" && "ethereum" in window;
    const onAnnounce = () => {
      found = true;
      setAvailable(true);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const timer = window.setTimeout(() => setAvailable(found), 400);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
    };
  }, []);
  return available;
}

export function SessionProvider({ initial, children }: { initial: SessionValue; children: ReactNode }) {
  const [value, setValue] = useState<SessionValue>(initial);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const walletAvailable = useWalletAvailable();

  const { address, isConnected, chainId } = useConnection();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();

  const refresh = useCallback(async () => {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (res.ok) setValue((await res.json()) as SessionValue);
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      let account = isConnected ? address : undefined;
      if (!account) {
        const connector = connectors[0];
        if (!connector || !walletAvailable) throw new Error("No browser wallet found — install one to sign in.");
        setStep("connecting");
        const result = await connectAsync({ connector });
        account = result.accounts[0];
      }
      if (!account) throw new Error("The wallet did not return an account.");
      if (chainId !== undefined && chainId !== robinhoodChain.id) {
        try {
          await switchChainAsync({ chainId: robinhoodChain.id });
        } catch {
          // Signing does not need the right chain; only transactions do.
        }
      }
      setStep("signing");
      const nonceRes = await fetch("/api/auth/nonce", { cache: "no-store" });
      if (!nonceRes.ok) throw new Error("Could not start a sign-in — the server refused a nonce.");
      const { nonce, issuedAt } = (await nonceRes.json()) as { nonce: string; issuedAt: string };
      const message = signInMessage(account, nonce, issuedAt);
      const signature = await signMessageAsync({ account, message });
      setStep("verifying");
      const verify = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: account, nonce, issuedAt, signature }),
      });
      const body = (await verify.json()) as { error?: string };
      if (!verify.ok) throw new Error(body.error ?? "Sign-in was refused.");
      await refresh();
    } catch (err) {
      const msg = (err as Error).message ?? "Sign-in failed.";
      setError(msg.split("\n")[0].slice(0, 160));
    } finally {
      setStep("idle");
    }
  }, [address, chainId, connectAsync, connectors, isConnected, refresh, signMessageAsync, switchChainAsync, walletAvailable]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    try {
      await disconnectAsync();
    } catch {
      /* already disconnected */
    }
    setValue((v) => ({ ...v, session: null }));
  }, [disconnectAsync]);

  // If the wallet switches to another account, the cookie is for the old
  // one: drop it rather than let two identities blur.
  const lastAddress = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!address) return;
    if (lastAddress.current && lastAddress.current !== address && value.session) {
      void signOut();
    }
    lastAddress.current = address;
  }, [address, signOut, value.session]);

  const ctx = useMemo<Ctx>(
    () => ({ ...value, step, error, walletAvailable, signIn, signOut, refresh }),
    [value, step, error, walletAvailable, signIn, signOut, refresh],
  );

  return <SessionContext.Provider value={ctx}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession outside SessionProvider");
  return ctx;
}
