import { Badge } from "@/components/ui/badge";
import { severityLabel, statusLabel, statusProgress } from "@/lib/issues/labels";
import type { IssueStatusValue, SeverityValue } from "@/lib/issues/types";

function statusVariant(
  status: IssueStatusValue,
): "success" | "warning" | "destructive" | "outline" {
  if (status === "RESOLVED") return "success";
  if (status === "REJECTED") return "destructive";
  if (status === "UNDER_REVIEW" || status === "IN_PROGRESS" || status === "REOPENED") {
    return "warning";
  }
  return "outline";
}

function severityVariant(
  severity: SeverityValue,
): "warning" | "destructive" | "outline" {
  if (severity === "URGENT") return "destructive";
  if (severity === "HIGH") return "warning";
  return "outline";
}

export function StatusMark({ status, compact = false }: { status: IssueStatusValue; compact?: boolean }) {
  const progress = statusProgress(status);
  const label = statusLabel(status);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge variant={statusVariant(status)}>{label}</Badge>
      {!compact && progress !== label ? <span className="text-small text-muted-foreground">{progress}</span> : null}
    </span>
  );
}

export function SeverityMark({ severity }: { severity: SeverityValue }) {
  return <Badge variant={severityVariant(severity)}>{severityLabel(severity)}</Badge>;
}
