"use server";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { getAuthorization } from "@/lib/auth/authorization";
import { issueReportLimiter } from "@/lib/auth/rate-limit";
import { clientAddress, trustedProxyHops } from "@/lib/auth/request-security";
import { ISSUE_RATE_LIMITED, ISSUE_SAVE_FAILED, ISSUE_SIGN_IN } from "@/lib/issues/messages";
import { createPrismaIssueStore } from "@/lib/issues/prisma-store";
import { claimIssueSubmission, createCitizenIssue } from "@/lib/issues/service";
import type { IssueFieldErrors } from "@/lib/issues/validate";

export type IssueFormState = {
  message: string;
  fieldErrors: IssueFieldErrors;
};

const initialFields: IssueFieldErrors = {};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function submitIssue(
  _previous: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  try {
    const authorization = await getAuthorization();
    if (!authorization) return { message: ISSUE_SIGN_IN, fieldErrors: initialFields };
    if (!claimIssueSubmission(issueReportLimiter, authorization.userId, Date.now())) {
      return { message: ISSUE_RATE_LIMITED, fieldErrors: initialFields };
    }

    const headerStore = await headers();
    const address = clientAddress(
      headerStore,
      trustedProxyHops(process.env.TRUSTED_PROXY_HOPS),
    );
    const result = await createCitizenIssue(
      authorization,
      {
        title: text(formData, "title"),
        description: text(formData, "description"),
        categoryId: text(formData, "categoryId"),
        severity: text(formData, "severity"),
        locationDescription: text(formData, "locationDescription"),
        city: text(formData, "city"),
        locality: text(formData, "locality"),
        postalCode: text(formData, "postalCode"),
        latitude: text(formData, "latitude"),
        longitude: text(formData, "longitude"),
      },
      createPrismaIssueStore(),
      new Date(),
      address === "unknown" ? null : address,
    );
    if (result.ok) {
      const flag = result.duplicate ? "existing" : "submitted";
      redirect(`/issues/${result.issueId}?${flag}=1`);
    }
    return { message: result.message, fieldErrors: result.fieldErrors };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Issue creation failed.");
    return { message: ISSUE_SAVE_FAILED, fieldErrors: initialFields };
  }
}
