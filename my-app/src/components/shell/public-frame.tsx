import type { ReactNode } from "react";
import { PublicNav } from "@/components/shell/public-nav";
import { SiteFooter } from "@/components/shell/site-footer";

export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PublicNav />
      <div id="content" className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
