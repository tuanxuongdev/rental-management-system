import { z } from 'zod';

import { createCursorCollectionSchema } from './pagination';

export const operationStatusSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'PARTIALLY_SUCCEEDED',
  'FAILED',
  'CANCELLED',
]);

export const operationResourceSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  status: operationStatusSchema,
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});

export type OperationResource = z.infer<typeof operationResourceSchema>;

export const operationsCollectionSchema = createCursorCollectionSchema(operationResourceSchema);

export type OperationsCollection = z.infer<typeof operationsCollectionSchema>;
