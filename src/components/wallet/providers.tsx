"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { useState, type ReactNode } from "react";
import { wagmiConfig } from "@/lib/wagmi";
import { SessionProvider, type SessionValue } from "@/components/wallet/session";

export function Providers({ children, initialSession }: { children: ReactNode; initialSession: SessionValue }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider initial={initialSession}>{children}</SessionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
