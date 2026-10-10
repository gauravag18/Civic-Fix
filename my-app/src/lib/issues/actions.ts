"use server";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { getAuthorization } from "@/lib/auth/authorization";
import { issueReportLimiter } from "@/lib/auth/rate-limit";
import { clientAddress, trustedProxyHops } from "@/lib/auth/request-security";
import { removeIssueImages, saveIssueImages } from "@/lib/issues/image-files";
import { validateIssueImages, type ImageCandidate } from "@/lib/issues/image-rules";
import { FIELD_PHOTOS, ISSUE_CHECK_FIELDS, ISSUE_RATE_LIMITED, ISSUE_SAVE_FAILED, ISSUE_SIGN_IN } from "@/lib/issues/messages";
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

async function photoCandidates(formData: FormData): Promise<ImageCandidate[]> {
  const files: ImageCandidate[] = [];
  for (const value of formData.getAll("photos")) {
    if (!(value instanceof File) || value.size === 0) continue;
    files.push({
      bytes: new Uint8Array(await value.arrayBuffer()),
      declaredName: value.name,
    });
  }
  return files;
}

export async function submitIssue(
  _previous: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  let savedKeys: string[] = [];
  let keepFiles = false;
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
    const prepared = validateIssueImages(await photoCandidates(formData));
    if (!prepared.ok) {
      return { message: ISSUE_CHECK_FIELDS, fieldErrors: { photos: prepared.message || FIELD_PHOTOS } };
    }
    savedKeys = prepared.images.map((image) => image.storageKey);
    if (prepared.images.length > 0) {
      const saved = await saveIssueImages(prepared.images);
      if (!saved) return { message: ISSUE_SAVE_FAILED, fieldErrors: initialFields };
    }
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
      prepared.images.map(({ storageKey, originalFilename, mimeType, byteSize }) => ({
        storageKey,
        originalFilename,
        mimeType,
        byteSize,
      })),
    );
    keepFiles = result.ok && !result.duplicate;
    if (!keepFiles) await removeIssueImages(savedKeys);
    if (result.ok) {
      const flag = result.duplicate ? "existing" : "submitted";
      redirect(`/issues/${result.issueId}?${flag}=1`);
    }
    return { message: result.message, fieldErrors: result.fieldErrors };
  } catch (error) {
    unstable_rethrow(error);
    if (!keepFiles) await removeIssueImages(savedKeys);
    console.error("Issue creation failed.");
    return { message: ISSUE_SAVE_FAILED, fieldErrors: initialFields };
  }
}
