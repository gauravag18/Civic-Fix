import { Capability, hasCapability } from "@/lib/auth/capabilities";
import { getAuthorization } from "@/lib/auth/authorization";
import { readIssueImage } from "@/lib/issues/image-files";
import { canReadIssueImage, downloadName, isAllowedImageMime } from "@/lib/issues/image-rules";
import { isUuid } from "@/lib/issues/validate";
import { getPrismaClient } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ imageId: string }> },
): Promise<Response> {
  const { imageId } = await context.params;
  if (!isUuid(imageId)) return new Response(null, { status: 404 });
  const authorization = await getAuthorization();
  if (!authorization) return new Response(null, { status: 401 });

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
      return new Response(null, { status: 404 });
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
    if (!allowed) return new Response(null, { status: 404 });

    const bytes = await readIssueImage(image.storageKey);
    if (!bytes) return new Response(null, { status: 404 });
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": image.mimeType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${downloadName(image.mimeType)}"`,
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
