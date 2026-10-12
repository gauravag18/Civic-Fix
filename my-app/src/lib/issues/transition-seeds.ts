import type { IssueStatus } from "@/generated/prisma/enums";

// REJECTED and REOPENED stay out. Those statuses require a reason if added later.
export const TRANSITION_SEEDS: readonly {
  fromStatus: IssueStatus;
  toStatus: IssueStatus;
}[] = [
  { fromStatus: "REPORTED", toStatus: "UNDER_REVIEW" },
  { fromStatus: "REPORTED", toStatus: "ASSIGNED" },
  { fromStatus: "UNDER_REVIEW", toStatus: "VERIFIED" },
  { fromStatus: "UNDER_REVIEW", toStatus: "ASSIGNED" },
  { fromStatus: "VERIFIED", toStatus: "ASSIGNED" },
  { fromStatus: "ASSIGNED", toStatus: "IN_PROGRESS" },
  { fromStatus: "IN_PROGRESS", toStatus: "RESOLVED" },
  { fromStatus: "RESOLVED", toStatus: "CLOSED" },
];
