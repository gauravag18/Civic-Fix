import { randomUUID } from "node:crypto";

export const MAX_ISSUE_IMAGES = 4;
export const MAX_ISSUE_IMAGE_BYTES = 5 * 1024 * 1024;

const STORAGE_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export type IssueImageMime = "image/jpeg" | "image/png" | "image/webp";

export type PersistImage = {
  storageKey: string;
  originalFilename: string;
  mimeType: IssueImageMime;
  byteSize: number;
};

export type ImageCandidate = {
  bytes: Uint8Array;
  declaredName: string;
};

export type PreparedIssueImage = PersistImage & {
  bytes: Uint8Array;
};

export function isSafeStorageKey(key: string): boolean {
  return STORAGE_KEY.test(key);
}

export function isAllowedImageMime(value: string): value is IssueImageMime {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}

export function downloadName(mime: IssueImageMime): string {
  if (mime === "image/png") return "photo.png";
  if (mime === "image/webp") return "photo.webp";
  return "photo.jpg";
}

function extensionFor(mime: IssueImageMime): "jpg" | "png" | "webp" {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function keyMatchesMime(key: string, mime: IssueImageMime): boolean {
  return key.endsWith(`.${extensionFor(mime)}`);
}

export function isPersistableImage(image: PersistImage): boolean {
  return (
    isSafeStorageKey(image.storageKey) &&
    isAllowedImageMime(image.mimeType) &&
    keyMatchesMime(image.storageKey, image.mimeType) &&
    Number.isInteger(image.byteSize) &&
    image.byteSize > 0 &&
    image.byteSize <= MAX_ISSUE_IMAGE_BYTES &&
    image.originalFilename.length > 0 &&
    image.originalFilename.length <= 255 &&
    !/[\\/\u0000]/.test(image.originalFilename)
  );
}

function detectImage(bytes: Uint8Array): IssueImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((byte, index) => bytes[index] === byte)) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function displayFilename(name: string, mime: IssueImageMime): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(/[^\w.\- ()]/g, "").replace(/^\.+/, "").trim().slice(0, 200);
  if (!cleaned) return downloadName(mime);
  return cleaned;
}

export type ImageValidation =
  | { ok: true; images: PreparedIssueImage[] }
  | { ok: false; message: string };

export function validateIssueImages(files: ImageCandidate[]): ImageValidation {
  if (files.length > MAX_ISSUE_IMAGES) {
    return { ok: false, message: "Attach up to 4 photographs." };
  }
  const images: PreparedIssueImage[] = [];
  for (const file of files) {
    if (file.bytes.byteLength === 0) {
      return { ok: false, message: "Remove empty files and try again." };
    }
    if (file.bytes.byteLength > MAX_ISSUE_IMAGE_BYTES) {
      return { ok: false, message: "Each photograph must be 5 MB or smaller." };
    }
    const mimeType = detectImage(file.bytes);
    if (!mimeType) {
      return { ok: false, message: "Use JPEG, PNG, or WebP photographs." };
    }
    const storageKey = `${randomUUID()}.${extensionFor(mimeType)}`;
    const image: PreparedIssueImage = {
      storageKey,
      originalFilename: displayFilename(file.declaredName, mimeType),
      mimeType,
      byteSize: file.bytes.byteLength,
      bytes: file.bytes,
    };
    if (!isPersistableImage(image)) {
      return { ok: false, message: "Use JPEG, PNG, or WebP photographs." };
    }
    images.push(image);
  }
  return { ok: true, images };
}

export function canReadIssueImage(input: {
  userId: string;
  reporterId: string;
  departmentId: string | null;
  canWorkDepartment: boolean;
  assignmentDepartmentId: string | null;
  unassignedClaimable: boolean;
}): boolean {
  if (input.userId === input.reporterId) return true;
  if (!input.canWorkDepartment || !input.departmentId) return false;
  if (input.assignmentDepartmentId) {
    return input.assignmentDepartmentId === input.departmentId;
  }
  return input.unassignedClaimable;
}
