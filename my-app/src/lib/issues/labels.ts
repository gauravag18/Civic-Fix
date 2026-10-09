import { IssueStatus, Severity } from "@/generated/prisma/enums";

const STATUS_LABELS: Record<IssueStatus, string> = {
  REPORTED: "Reported",
  UNDER_REVIEW: "Under review",
  VERIFIED: "Verified",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REJECTED: "Rejected",
  REOPENED: "Reopened",
};

const SEVERITY_LABELS: Record<Severity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export function statusLabel(status: IssueStatus): string {
  return STATUS_LABELS[status];
}

export function severityLabel(severity: Severity): string {
  return SEVERITY_LABELS[severity];
}

export function formatWhen(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}
