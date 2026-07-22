import { z } from 'zod';

export const PAGINATION_DEFAULT_LIMIT = 25 as const;
export const PAGINATION_MAX_LIMIT = 100 as const;
export const PAGINATION_MIN_LIMIT = 1 as const;

export const cursorPageSchema = z.object({
  nextCursor: z.string().nullable(),
  previousCursor: z.string().nullable(),
  limit: z.number().int().min(PAGINATION_MIN_LIMIT).max(PAGINATION_MAX_LIMIT),
});

export type CursorPage = z.infer<typeof cursorPageSchema>;

export const cursorCollectionMetaSchema = z.object({
  asOf: z.string().datetime().optional(),
});

export type CursorCollectionMeta = z.infer<typeof cursorCollectionMetaSchema>;

export function createCursorCollectionSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
): z.ZodObject<{
  data: z.ZodArray<T>;
  page: typeof cursorPageSchema;
  meta: typeof cursorCollectionMetaSchema;
}> {
  return z.object({
    data: z.array(itemSchema),
    page: cursorPageSchema,
    meta: cursorCollectionMetaSchema,
  });
}

export const paginationQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(PAGINATION_MIN_LIMIT)
    .max(PAGINATION_MAX_LIMIT)
    .default(PAGINATION_DEFAULT_LIMIT),
  after: z.string().min(1).optional(),
  before: z.string().min(1).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function normalizePaginationLimit(limit?: number): number {
  if (limit === undefined) {
    return PAGINATION_DEFAULT_LIMIT;
  }
  return Math.min(PAGINATION_MAX_LIMIT, Math.max(PAGINATION_MIN_LIMIT, limit));
}
