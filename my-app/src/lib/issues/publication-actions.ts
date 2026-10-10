"use server";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { getAuthorization } from "@/lib/auth/authorization";
import { publicationLimiter } from "@/lib/auth/rate-limit";
import { clientAddress, trustedProxyHops } from "@/lib/auth/request-security";
import { publishOwnedIssue } from "@/lib/issues/discovery";
import { PUBLICATION_UNAVAILABLE } from "@/lib/issues/messages";
import { createPrismaIssueStore } from "@/lib/issues/prisma-store";

export type PublicationFormState = { message: string };

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function setIssuePublication(
  _previous: PublicationFormState,
  formData: FormData,
): Promise<PublicationFormState> {
  const issueId = text(formData, "issueId");
  try {
    const authorization = await getAuthorization();
    const headerStore = await headers();
    const address = clientAddress(headerStore, trustedProxyHops(process.env.TRUSTED_PROXY_HOPS));
    const result = await publishOwnedIssue(
      authorization,
      {
        issueId,
        intent: text(formData, "intent"),
        confirm: text(formData, "confirm"),
      },
      createPrismaIssueStore(),
      new Date(),
      address === "unknown" ? null : address,
      publicationLimiter,
      Date.now(),
    );
    if (!result.ok) return { message: result.message };
    redirect(`/issues/${issueId}?${result.publishedAt ? "published" : "unpublished"}=1`);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Issue publication failed.");
    return { message: PUBLICATION_UNAVAILABLE };
  }
}
