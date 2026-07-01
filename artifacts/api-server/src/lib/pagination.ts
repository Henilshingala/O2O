import type { Response } from "express";

export interface OffsetPagination {
  page: number;
  limit: number;
  offset: number;
  total: number;
  totalPages: number;
}

export interface CursorPaginationMeta {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export function parseOffsetPagination(
  query: Record<string, unknown>,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {},
) {
  const page = Math.max(1, parseInt(String(query.page ?? defaults.page ?? 1), 10) || 1);
  const maxLimit = defaults.maxLimit ?? 100;
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(String(query.limit ?? defaults.limit ?? 25), 10) || (defaults.limit ?? 25)),
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function parseCursorPagination(
  query: Record<string, unknown>,
  defaults: { limit?: number; maxLimit?: number } = {},
) {
  const maxLimit = defaults.maxLimit ?? 100;
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(String(query.limit ?? defaults.limit ?? 50), 10) || (defaults.limit ?? 50)),
  );
  const cursor = typeof query.cursor === "string" && query.cursor.length > 0 ? query.cursor : undefined;
  return { limit, cursor };
}

export function buildOffsetMeta(page: number, limit: number, total: number): OffsetPagination {
  return {
    page,
    limit,
    offset: (page - 1) * limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** Backward-compatible: returns bare array unless `paginated=true` query param is set. */
export function sendListResponse<T>(
  res: Response,
  req: { query: Record<string, unknown> },
  data: T[],
  pagination: OffsetPagination | CursorPaginationMeta,
) {
  if (req.query.paginated === "true") {
    return res.json({ data, pagination });
  }
  return res.json(data);
}
