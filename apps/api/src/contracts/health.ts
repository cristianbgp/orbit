import { createRoute, z } from "@hono/zod-openapi";

export const HealthSchema = z
  .object({
    status: z.literal("ok"),
    service: z.literal("orbit-api"),
  })
  .openapi("Health");

export const healthRoute = createRoute({
  method: "get",
  path: "/health",
  operationId: "getHealth",
  tags: ["System"],
  responses: {
    200: {
      description: "The Orbit API is available.",
      content: {
        "application/json": {
          schema: HealthSchema,
        },
      },
    },
  },
});
