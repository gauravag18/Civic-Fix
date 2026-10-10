import { Capability, hasCapability } from "@/lib/auth/capabilities";
import { getAuthorization } from "@/lib/auth/authorization";
import { readIssueImage } from "@/lib/issues/image-storage";
import { createIssueImageStore } from "@/lib/issues/supabase-images";
import { canReadIssueImage, downloadName, isAllowedImageMime } from "@/lib/issues/image-rules";
import { isUuid } from "@/lib/issues/validate";
import { getPrismaClient } from "@/lib/prisma";

const PRIVATE_CACHE = "private, no-store";

function unavailable(status: 401 | 404): Response {
  return new Response(null, {
    status,
    headers: { "Cache-Control": PRIVATE_CACHE },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ imageId: string }> },
): Promise<Response> {
  const { imageId } = await context.params;
  if (!isUuid(imageId)) return unavailable(404);
  const authorization = await getAuthorization();
  if (!authorization) return unavailable(401);

  try {
    const prisma = getPrismaClient();
    const image = await prisma.issueImage.findFirst({
      where: { id: imageId, deletedAt: null },
      select: {
        storageKey: true,
        mimeType: true,
        issue: {
          select: {
            reporterId: true,
            deletedAt: true,
            status: true,
            assignments: {
              where: { endedAt: null },
              take: 1,
              select: { departmentId: true },
            },
          },
        },
      },
    });
    if (!image || image.issue.deletedAt || !isAllowedImageMime(image.mimeType)) {
      return unavailable(404);
    }

    const assignment = image.issue.assignments[0] ?? null;
    let unassignedClaimable = false;
    if (!assignment) {
      const transition = await prisma.statusTransition.findUnique({
        where: {
          fromStatus_toStatus: { fromStatus: image.issue.status, toStatus: "ASSIGNED" },
        },
        select: { fromStatus: true },
      });
      unassignedClaimable = transition !== null;
    }

    const allowed = canReadIssueImage({
      userId: authorization.userId,
      reporterId: image.issue.reporterId,
      departmentId: authorization.departmentId,
      canWorkDepartment: hasCapability(authorization.capabilities, Capability.departmentWork),
      assignmentDepartmentId: assignment?.departmentId ?? null,
      unassignedClaimable,
    });
    if (!allowed) return unavailable(404);

    const bytes = await readIssueImage(image.storageKey, createIssueImageStore());
    if (!bytes) return unavailable(404);
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": image.mimeType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": PRIVATE_CACHE,
        "Content-Disposition": `inline; filename="${downloadName(image.mimeType)}"`,
      },
    });
  } catch {
    return unavailable(404);
  }
}
