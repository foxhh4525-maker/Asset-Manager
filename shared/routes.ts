import { z } from 'zod';
import { insertClipSchema, insertUserSchema, insertVoteSchema, clips, users } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout' as const,
      responses: {
        200: z.void(),
      },
    },
  },
  clips: {
    list: {
      method: 'GET' as const,
      path: '/api/clips' as const,
      input: z.object({
        status: z.enum(['pending', 'approved', 'rejected', 'watched']).optional(),
        sort: z.enum(['new', 'top']).optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof clips.$inferSelect & { submitter: { username: string } }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/clips' as const,
      input: insertClipSchema.extend({
        // نقبل رابط /clip/ الأصلي — السيرفر يحوّله تلقائياً قبل الحفظ
        url: z.string().regex(
          /^(https?:\/\/)?(www\.)?(youtube\.com\/(clip\/|watch\?)|youtu\.be\/).+$/,
          "Must be a valid YouTube Clip or Watch URL"
        ),
      }),
      responses: {
        201: z.custom<typeof clips.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/clips/:id/status' as const,
      input: z.object({
        status: z.enum(['pending', 'approved', 'rejected', 'watched']),
      }),
      responses: {
        200: z.custom<typeof clips.$inferSelect>(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/clips/:id' as const,
      responses: {
        200: z.object({ success: z.boolean() }),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
        403: errorSchemas.unauthorized,
      },
    },
    vote: {
      method: 'POST' as const,
      path: '/api/clips/:id/vote' as const,
      input: z.object({
        value: z.number().min(-1).max(1), // 1 or -1, 0 to remove?
      }),
      responses: {
        200: z.object({ upvotes: z.number(), downvotes: z.number() }), // Return new counts
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
    fetchMetadata: {
      method: 'POST' as const,
      path: '/api/metadata/fetch' as const,
      input: z.object({
        url: z.string().url(),
      }),
      responses: {
        200: z.object({
          title:        z.string(),
          thumbnailUrl: z.string(),
          channelName:  z.string(),
          duration:     z.string(),
          convertedUrl: z.string(),
          videoId:      z.string(),
          startTime:    z.number(),
          endTime:      z.number(),
        }),
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
