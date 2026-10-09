import type { IssueStatus } from "@/generated/prisma/enums";

// Reviewed department workflow. The seed script inserts these pairs.
// It does not create users, departments, or issues.
// REJECTED and REOPENED stay out of this list; those statuses require a
// reason in the database, and the staff service enforces that if a pair is added later.
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
