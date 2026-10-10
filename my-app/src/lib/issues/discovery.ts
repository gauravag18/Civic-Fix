import { IssueStatus } from "@/generated/prisma/enums";
import { rateKey, type SlidingWindowLimiter } from "@/lib/auth/rate-limit";
import {
  PUBLICATION_CONFIRM,
  PUBLICATION_MISSING,
  PUBLICATION_RATE_LIMITED,
  PUBLICATION_SIGN_IN,
  PUBLICATION_UNAVAILABLE,
} from "@/lib/issues/messages";
import { pageNumber } from "@/lib/issues/service";
import type { IssueStore } from "@/lib/issues/store";
import {
  PUBLIC_PAGE_SIZE,
  type IssueStatusValue,
  type PublicIssueCard,
  type PublicListFilters,
} from "@/lib/issues/types";
import { isUuid } from "@/lib/issues/validate";

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const SEARCH_MAX = 80;
const STATUSES = new Set<string>(Object.values(IssueStatus));

export type PublicQueryInput = {
  q?: unknown;
  category?: unknown;
  status?: unknown;
  sort?: unknown;
  page?: unknown;
};

export type CitizenAccess = {
  userId: string;
  capabilities: ReadonlySet<string>;
} | null;

const PUBLIC_KEYS = [
  "id",
  "title",
  "categoryName",
  "locality",
  "city",
  "status",
  "createdAt",
] as const;

export function publicIssueCard(card: PublicIssueCard): PublicIssueCard {
  return {
    id: card.id,
    title: card.title,
    categoryName: card.categoryName,
    locality: card.locality,
    city: card.city,
    status: card.status,
    createdAt: card.createdAt,
  };
}

export function publicIssueKeys(): readonly string[] {
  return PUBLIC_KEYS;
}

export type PublicMapItem = {
  id: string;
  title: string;
  categoryName: string;
  locality: string | null;
  city: string;
  status: IssueStatusValue;
  createdAt: string;
};

const MAP_ITEM_KEYS = [
  "id",
  "title",
  "categoryName",
  "locality",
  "city",
  "status",
  "createdAt",
] as const;

export function publicMapItem(card: PublicIssueCard): PublicMapItem {
  return {
    id: card.id,
    title: card.title,
    categoryName: card.categoryName,
    locality: card.locality,
    city: card.city,
    status: card.status,
    createdAt: card.createdAt.toISOString(),
  };
}

export function publicMapItemKeys(): readonly string[] {
  return MAP_ITEM_KEYS;
}

export const EXACT_COORDINATES_ARE_PRIVATE = "exact-coordinates-are-private";

export function publicMapPlacement(cards: readonly PublicIssueCard[]): {
  placed: [];
  withheld: number;
  reason: typeof EXACT_COORDINATES_ARE_PRIVATE;
} {
  return {
    placed: [],
    withheld: cards.length,
    reason: EXACT_COORDINATES_ARE_PRIVATE,
  };
}

export function parsePublicQuery(
  input: PublicQueryInput,
): { ok: true; filters: PublicListFilters; page: number } | { ok: false; reason: "invalid" } {
  const qRaw = typeof input.q === "string" ? input.q : "";
  if (CONTROL.test(qRaw)) return { ok: false, reason: "invalid" };
  const q = qRaw.replace(/\s+/g, " ").trim();
  if (q.length > SEARCH_MAX) return { ok: false, reason: "invalid" };

  const categoryRaw = typeof input.category === "string" ? input.category.trim() : "";
  if (categoryRaw && !isUuid(categoryRaw)) return { ok: false, reason: "invalid" };

  const statusRaw = typeof input.status === "string" ? input.status.trim() : "";
  if (statusRaw && !STATUSES.has(statusRaw)) return { ok: false, reason: "invalid" };

  const sortRaw = typeof input.sort === "string" && input.sort.trim() ? input.sort.trim() : "newest";
  if (sortRaw !== "newest" && sortRaw !== "updated") return { ok: false, reason: "invalid" };

  return {
    ok: true,
    page: pageNumber(input.page),
    filters: {
      q,
      categoryId: categoryRaw || null,
      status: statusRaw ? (statusRaw as IssueStatusValue) : null,
      sort: sortRaw,
    },
  };
}

export function publicExploreHref(filters: PublicListFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.categoryId) params.set("category", filters.categoryId);
  if (filters.status) params.set("status", filters.status);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `/explore?${text}` : "/explore";
}

export function publicationCommand(input: {
  issueId: string;
  intent: string;
  confirm: string;
}): { ok: true; issueId: string; publish: boolean } | { ok: false; message: string } {
  if (!isUuid(input.issueId)) return { ok: false, message: PUBLICATION_MISSING };
  if (input.intent !== "publish" && input.intent !== "unpublish") {
    return { ok: false, message: PUBLICATION_UNAVAILABLE };
  }
  if (input.confirm !== "yes") return { ok: false, message: PUBLICATION_CONFIRM };
  return { ok: true, issueId: input.issueId, publish: input.intent === "publish" };
}

export async function listPublicIssues(
  input: PublicQueryInput,
  store: IssueStore,
): Promise<
  | {
      ok: true;
      page: number;
      pageSize: number;
      total: number;
      items: PublicIssueCard[];
      filters: PublicListFilters;
    }
  | { ok: false; reason: "invalid" | "unavailable" }
> {
  const parsed = parsePublicQuery(input);
  if (!parsed.ok) return { ok: false, reason: "invalid" };

  try {
    const pageSize = PUBLIC_PAGE_SIZE;
    const first = await store.listPublic(parsed.filters, parsed.page, pageSize);
    if (!first.ok) return first;
    const lastPage = Math.max(1, Math.ceil(first.total / pageSize));
    if (parsed.page > lastPage) {
      const last = await store.listPublic(parsed.filters, lastPage, pageSize);
      if (!last.ok) return last;
      return {
        ok: true,
        page: lastPage,
        pageSize,
        total: last.total,
        items: last.items.map(publicIssueCard),
        filters: parsed.filters,
      };
    }
    return {
      ok: true,
      page: parsed.page,
      pageSize,
      total: first.total,
      items: first.items.map(publicIssueCard),
      filters: parsed.filters,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function getPublicIssue(
  issueId: string,
  store: IssueStore,
): Promise<
  | { ok: true; issue: PublicIssueCard }
  | { ok: false; reason: "missing" | "unavailable" }
> {
  if (!isUuid(issueId)) return { ok: false, reason: "missing" };
  try {
    const result = await store.getPublic(issueId);
    if (!result.ok) return result;
    if (!result.issue) return { ok: false, reason: "missing" };
    return { ok: true, issue: publicIssueCard(result.issue) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function publishOwnedIssue(
  access: CitizenAccess,
  input: { issueId: string; intent: string; confirm: string },
  store: IssueStore,
  now: Date,
  ipAddress: string | null,
  limiter: SlidingWindowLimiter,
  nowMs: number,
): Promise<
  | { ok: true; publishedAt: Date | null }
  | { ok: false; message: string }
> {
  if (!access) return { ok: false, message: PUBLICATION_SIGN_IN };
  const command = publicationCommand(input);
  if (!command.ok) return command;
  if (!limiter.allow(rateKey(["issue.publish", access.userId]), nowMs)) {
    return { ok: false, message: PUBLICATION_RATE_LIMITED };
  }
  const written = await store.setOwnedPublication({
    reporterId: access.userId,
    issueId: command.issueId,
    publish: command.publish,
    now,
    ipAddress,
  });
  if (!written.ok && written.reason === "missing") {
    return { ok: false, message: PUBLICATION_MISSING };
  }
  if (!written.ok) return { ok: false, message: PUBLICATION_UNAVAILABLE };
  return { ok: true, publishedAt: written.publishedAt };
}
