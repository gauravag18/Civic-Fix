import { Badge } from "@/components/ui/badge";
import { severityLabel, statusLabel } from "@/lib/issues/labels";
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

export function StatusMark({ status }: { status: IssueStatusValue }) {
  return <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>;
}

export function SeverityMark({ severity }: { severity: SeverityValue }) {
  return <Badge variant={severityVariant(severity)}>{severityLabel(severity)}</Badge>;
}
