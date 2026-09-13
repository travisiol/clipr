"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { useSession } from "@/components/wallet/session";
import { Button } from "@/components/ui";
import { shortAddress } from "@/lib/model";

/**
 * One control for the whole sign-in story. Signed out: "Sign in with wallet"
 * (or an honest "No wallet found"). Signed in: the address with a live dot,
 * click to sign out. Errors are printed under it, never swallowed.
 */
export function WalletButton({ className, full }: { className?: string; full?: boolean }) {
  const { session, step, error, walletAvailable, signIn, signOut } = useSession();
  const [confirm, setConfirm] = useState(false);

  if (session) {
    return (
      <span className={clsx("inline-flex flex-col items-end gap-1", full && "w-full items-stretch")}>
        <Button
          variant="glass"
          className={clsx("num gap-2 text-[13px]", className)}
          title="Sign out"
          onClick={() => {
            if (confirm) void signOut();
            else {
              setConfirm(true);
              window.setTimeout(() => setConfirm(false), 2500);
            }
          }}
        >
          <span className="dot-live" aria-hidden />
          {confirm ? "Sign out?" : shortAddress(session.address)}
          {session.ops && <span className="pill pill-brand h-5 px-1.5 text-[10px]">ops</span>}
        </Button>
      </span>
    );
  }

  const label =
    step === "connecting"
      ? "Connecting…"
      : step === "signing"
        ? "Sign the message…"
        : step === "verifying"
          ? "Verifying…"
          : walletAvailable
            ? "Sign in with wallet"
            : "No wallet found";

  return (
    <span className={clsx("inline-flex flex-col items-end gap-1", full && "w-full items-stretch")}>
      <Button
        variant="primary"
        className={className}
        busy={step !== "idle"}
        disabled={!walletAvailable}
        title={walletAvailable ? undefined : "No browser wallet detected on this device"}
        onClick={() => void signIn()}
      >
        {label}
      </Button>
      {error && <span className="max-w-[260px] text-right text-[12px] text-bad">{error}</span>}
      {!walletAvailable && !error && (
        <span className="max-w-[260px] text-right text-[12px] text-low">Install a browser wallet to sign in.</span>
      )}
    </span>
  );
}
