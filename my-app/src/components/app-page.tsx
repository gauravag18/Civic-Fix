import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/shell/workspace-shell";

export function AppPage({
  title,
  lede,
  area = "citizen",
  children,
}: {
  title: string;
  lede?: string;
  area?: "citizen" | "department" | "admin";
  children: ReactNode;
}) {
  return (
    <WorkspaceShell area={area} title={title} lede={lede}>
      {children}
    </WorkspaceShell>
  );
}
