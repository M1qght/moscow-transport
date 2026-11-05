import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException(result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
  return result.data;
}
export const id = z.string().min(1).max(100);
export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export function pagination(value: unknown) {
  const p = parse(pageSchema, value);
  return { ...p, skip: (p.page - 1) * p.limit, take: p.limit };
}
export const publicUser = { id: true, login: true, name: true, role: true, rating: true, createdAt: true } as const;
