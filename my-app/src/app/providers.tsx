"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

export function AuthProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      {children}
    </SessionProvider>
  );
}
