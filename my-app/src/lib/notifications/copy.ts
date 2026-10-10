import { IssueStatus, NotificationType } from "@/generated/prisma/enums";
import { statusLabel } from "@/lib/issues/labels";

export type NotificationDraft = {
  type: NotificationType;
  title: string;
  body: string;
};

export function statusNotification(toStatus: IssueStatus): NotificationDraft {
  if (toStatus === IssueStatus.VERIFIED) {
    return {
      type: NotificationType.ISSUE_VERIFIED,
      title: "Report verified",
      body: "A department verified your report.",
    };
  }
  if (toStatus === IssueStatus.RESOLVED) {
    return {
      type: NotificationType.ISSUE_RESOLVED,
      title: "Report resolved",
      body: "A department marked your report resolved.",
    };
  }
  return {
    type: NotificationType.STATUS_CHANGED,
    title: "Report status changed",
    body: `Your report is now ${statusLabel(toStatus)}.`,
  };
}

export function assignmentNotification(): NotificationDraft {
  return {
    type: NotificationType.ISSUE_ASSIGNED,
    title: "Report assigned to you",
    body: "A report was assigned to you.",
  };
}

export function commentNotification(): NotificationDraft {
  return {
    type: NotificationType.COMMENT_ADDED,
    title: "New comment on your report",
    body: "Department staff added a comment you can read on the report.",
  };
}
