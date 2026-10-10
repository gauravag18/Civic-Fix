import { IssueStatus } from "@/generated/prisma/enums";
import { isPersistableImage, type PersistImage } from "@/lib/issues/image-rules";
import { DUPLICATE_WINDOW_MS, type SeverityValue } from "@/lib/issues/types";

export type PersistReportInput = {
  reporterId: string;
  title: string;
  description: string;
  categoryId: string;
  severity: SeverityValue;
  locationDescription: string;
  city: string;
  locality: string | null;
  postalCode: string | null;
  latitude: string | null;
  longitude: string | null;
  now: Date;
  ipAddress: string | null;
  images?: PersistImage[];
};

export type PersistReportResult =
  | { ok: true; issueId: string; duplicate: boolean }
  | { ok: false; reason: "category" };

type CategoryRow = { id: string; name: string; code: string };

export type ReportTx = {
  issueCategory: {
    findFirst(args: {
      where: { id: string; isActive: true };
      select: { id: true; name: true; code: true };
    }): Promise<CategoryRow | null>;
  };
  issue: {
    findFirst(args: {
      where: {
        reporterId: string;
        categoryId: string;
        deletedAt: null;
        createdAt: { gte: Date };
        title: { equals: string; mode: "insensitive" };
        location: { description: { equals: string; mode: "insensitive" } };
      };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(args: {
      data: {
        title: string;
        description: string;
        categoryId: string;
        reporterId: string;
        locationId: string;
        severity: SeverityValue;
        status: typeof IssueStatus.REPORTED;
        createdAt: Date;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  location: {
    create(args: {
      data: {
        description: string;
        locality: string | null;
        city: string;
        postalCode: string | null;
        latitude: string | null;
        longitude: string | null;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  issueStatusHistory: {
    create(args: {
      data: {
        issueId: string;
        fromStatus: null;
        toStatus: typeof IssueStatus.REPORTED;
        changedById: string;
        reason: null;
        createdAt: Date;
      };
    }): Promise<unknown>;
  };
  auditLog: {
    create(args: {
      data: {
        actorId: string;
        action: "issue.reported";
        entityType: "Issue";
        entityId: string;
        metadata: { categoryCode: string; severity: SeverityValue };
        ipAddress: string | null;
        createdAt: Date;
      };
    }): Promise<unknown>;
  };
  issueImage: {
    create(args: {
      data: {
        issueId: string;
        uploadedById: string;
        storageKey: string;
        originalFilename: string;
        mimeType: PersistImage["mimeType"];
        byteSize: number;
        createdAt: Date;
      };
    }): Promise<unknown>;
  };
};

export type ReportDatabase = {
  $transaction<T>(work: (tx: ReportTx) => Promise<T>): Promise<T>;
};

export async function persistReport(
  db: ReportDatabase,
  input: PersistReportInput,
): Promise<PersistReportResult> {
  return db.$transaction(async (tx) => {
    const images = input.images ?? [];
    if (images.some((image) => !isPersistableImage(image))) {
      throw new Error("invalid image");
    }

    const category = await tx.issueCategory.findFirst({
      where: { id: input.categoryId, isActive: true },
      select: { id: true, name: true, code: true },
    });
    if (!category) return { ok: false, reason: "category" };

    const since = new Date(input.now.getTime() - DUPLICATE_WINDOW_MS);
    const existing = await tx.issue.findFirst({
      where: {
        reporterId: input.reporterId,
        categoryId: category.id,
        deletedAt: null,
        createdAt: { gte: since },
        title: { equals: input.title, mode: "insensitive" },
        location: {
          description: { equals: input.locationDescription, mode: "insensitive" },
        },
      },
      select: { id: true },
    });
    if (existing) return { ok: true, issueId: existing.id, duplicate: true };

    const location = await tx.location.create({
      data: {
        description: input.locationDescription,
        locality: input.locality,
        city: input.city,
        postalCode: input.postalCode,
        latitude: input.latitude,
        longitude: input.longitude,
      },
      select: { id: true },
    });
    const issue = await tx.issue.create({
      data: {
        title: input.title,
        description: input.description,
        categoryId: category.id,
        reporterId: input.reporterId,
        locationId: location.id,
        severity: input.severity,
        status: IssueStatus.REPORTED,
        createdAt: input.now,
      },
      select: { id: true },
    });
    await tx.issueStatusHistory.create({
      data: {
        issueId: issue.id,
        fromStatus: null,
        toStatus: IssueStatus.REPORTED,
        changedById: input.reporterId,
        reason: null,
        createdAt: input.now,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.reporterId,
        action: "issue.reported",
        entityType: "Issue",
        entityId: issue.id,
        metadata: { categoryCode: category.code, severity: input.severity },
        ipAddress: input.ipAddress,
        createdAt: input.now,
      },
    });
    for (const image of images) {
      await tx.issueImage.create({
        data: {
          issueId: issue.id,
          uploadedById: input.reporterId,
          storageKey: image.storageKey,
          originalFilename: image.originalFilename,
          mimeType: image.mimeType,
          byteSize: image.byteSize,
          createdAt: input.now,
        },
      });
    }
    return { ok: true, issueId: issue.id, duplicate: false };
  });
}
