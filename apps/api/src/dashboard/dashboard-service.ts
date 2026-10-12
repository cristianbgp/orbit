import type {
  DashboardActor,
  DashboardActivityCursor,
  DashboardActivityPage,
  DashboardActivityStorePage,
} from "./dashboard-types";

export class DashboardServiceError extends Error {
  readonly code: "FORBIDDEN" | "INVALID_CURSOR";

  constructor(code: "FORBIDDEN" | "INVALID_CURSOR", message: string) {
    super(message);
    this.name = "DashboardServiceError";
    this.code = code;
  }
}

export type DashboardStore = {
  findMemberContext(
    userId: string,
    organizationId: string,
  ): Promise<{ timeZone: string } | null>;
  listActivity(
    organizationId: string,
    input: { limit: number; cursor: DashboardActivityCursor | null },
  ): Promise<DashboardActivityStorePage>;
};

function encodeActivityCursor(cursor: DashboardActivityCursor) {
  return Buffer.from(
    JSON.stringify([cursor.createdAt.toISOString(), cursor.id]),
  ).toString("base64url");
}

function decodeActivityCursor(value: string): DashboardActivityCursor {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const decoded: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (
      !Array.isArray(decoded) ||
      decoded.length !== 2 ||
      typeof decoded[0] !== "string" ||
      typeof decoded[1] !== "string" ||
      !decoded[1]
    ) {
      throw new Error();
    }
    const createdAt = new Date(decoded[0]);
    if (
      Number.isNaN(createdAt.getTime()) ||
      createdAt.toISOString() !== decoded[0]
    ) {
      throw new Error();
    }
    return { createdAt, id: decoded[1] };
  } catch {
    throw new DashboardServiceError("INVALID_CURSOR", "Cursor inválido.");
  }
}

export function createDashboardService(store: DashboardStore) {
  return {
    async activity(
      actor: DashboardActor,
      input: { pageSize: number; cursor?: string },
    ): Promise<DashboardActivityPage> {
      const member = await store.findMemberContext(
        actor.userId,
        actor.organizationId,
      );
      if (!member) {
        throw new DashboardServiceError(
          "FORBIDDEN",
          "No tienes acceso a este estudio.",
        );
      }
      const result = await store.listActivity(actor.organizationId, {
        limit: input.pageSize,
        cursor: input.cursor ? decodeActivityCursor(input.cursor) : null,
      });
      const lastActivity = result.activities.at(-1);
      return {
        timeZone: member.timeZone,
        activities: result.activities,
        nextCursor:
          result.hasMore && lastActivity
            ? encodeActivityCursor({
                createdAt: lastActivity.createdAt,
                id: lastActivity.id,
              })
            : null,
      };
    },
  };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
