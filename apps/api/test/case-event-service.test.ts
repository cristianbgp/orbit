import { describe, expect, test, vi } from "vitest";

import {
  CaseEventServiceError,
  createCaseEventService,
  type CaseEventStore,
} from "../src/case-events/case-event-service";

const actor = { userId: "user-1", organizationId: "org-1" };
const record = {
  id: "event-1",
  organizationId: "org-1",
  caseId: "case-1",
  title: "Informe ante la Sala",
  type: "oral_argument" as const,
  date: "2020-01-10",
  description: null,
  createdByUserId: "user-1",
  createdAt: new Date("2026-09-03T10:00:00Z"),
  updatedAt: new Date("2026-09-03T10:00:00Z"),
};

function store(overrides: Partial<CaseEventStore> = {}): CaseEventStore {
  return {
    hasMembership: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockResolvedValue({ events: [], total: 0 }),
    calendar: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ status: "not_found" }),
    update: vi.fn().mockResolvedValue({ status: "not_found" }),
    remove: vi.fn().mockResolvedValue({ status: "not_found" }),
    ...overrides,
  };
}

describe("case event service", () => {
  test("returns a bounded calendar with normalized portfolio filters", async () => {
    const calendarRecord = {
      ...record,
      case: {
        id: "case-1",
        identification: "Proceso tributario",
        status: "in_progress" as const,
        type: "judicial" as const,
        stage: "judicial_first_instance" as const,
        docketNumber: "0001-2026",
        client: { id: "client-1", name: "Cliente" },
      },
    };
    const events = store({
      calendar: vi.fn().mockResolvedValue([calendarRecord]),
    });
    const service = createCaseEventService(events);

    await expect(
      service.calendar(actor, {
        from: "2026-08-31",
        to: "2026-10-11",
        caseStatus: "in_progress",
        search: "  informe  ",
        types: ["judicial", "judicial"],
        clientIds: ["client-1", "client-1"],
        memberUserIds: ["user-2", "user-2"],
      }),
    ).resolves.toEqual({ events: [calendarRecord], truncated: false });
    expect(events.calendar).toHaveBeenCalledWith("org-1", {
      from: "2026-08-31",
      to: "2026-10-11",
      caseStatus: "in_progress",
      search: "informe",
      types: ["judicial"],
      clientIds: ["client-1"],
      memberUserIds: ["user-2"],
      limit: 501,
    });
  });

  test("rejects calendar ranges longer than 42 days", async () => {
    const events = store();
    const service = createCaseEventService(events);

    await expect(
      service.calendar(actor, {
        from: "2026-08-31",
        to: "2026-10-12",
        caseStatus: "in_progress",
        types: [],
        clientIds: [],
        memberUserIds: [],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(events.calendar).not.toHaveBeenCalled();
  });

  test("returns paginated event lists with the default page size", async () => {
    const events = store({
      list: vi.fn().mockResolvedValue({ events: [record], total: 26 }),
    });
    const service = createCaseEventService(events);

    await expect(service.list(actor, "case-1", {})).resolves.toEqual({
      events: [record],
      pagination: { page: 1, pageSize: 25, total: 26, totalPages: 2 },
    });
    expect(events.list).toHaveBeenCalledWith("org-1", "case-1", {
      page: 1,
      pageSize: 25,
    });
  });

  test("preserves a supported event type without case date boundaries", async () => {
    const events = store({
      create: vi.fn().mockResolvedValue({
        status: "created",
        event: { ...record, title: "Entrevista", type: "interview" },
      }),
    });
    const service = createCaseEventService(events, () => "event-1");

    await expect(
      service.create(actor, "case-1", {
        title: "  Entrevista  ",
        type: "interview",
        date: "2020-01-10",
        description: "   ",
      }),
    ).resolves.toMatchObject({ title: "Entrevista", type: "interview" });
    expect(events.create).toHaveBeenCalledWith(actor, "case-1", "event-1", {
      title: "Entrevista",
      type: "interview",
      date: "2020-01-10",
      description: null,
    });
  });

  test("rejects impossible calendar dates before reaching persistence", async () => {
    const events = store();
    const service = createCaseEventService(events);

    await expect(
      service.create(actor, "case-1", {
        title: "Informe oral",
        type: "oral_argument",
        date: "2026-02-30",
      }),
    ).rejects.toEqual(
      new CaseEventServiceError(
        "VALIDATION_ERROR",
        "Selecciona una fecha válida para el evento.",
      ),
    );
    expect(events.create).not.toHaveBeenCalled();
  });

  test("normalizes only the fields supplied to an update", async () => {
    const updated = { ...record, description: "Nueva descripción" };
    const events = store({
      update: vi.fn().mockResolvedValue({ status: "updated", event: updated }),
    });
    const service = createCaseEventService(events);

    await expect(
      service.update(actor, "case-1", "event-1", {
        description: "  Nueva descripción  ",
        expectedUpdatedAt: "2026-09-03T10:00:00.000Z",
      }),
    ).resolves.toEqual(updated);
    expect(events.update).toHaveBeenCalledWith(
      actor,
      "case-1",
      "event-1",
      { description: "Nueva descripción" },
      "2026-09-03T10:00:00.000Z",
    );
  });

  test("maps stale event mutations to a conflict", async () => {
    const events = store({
      update: vi.fn().mockResolvedValue({ status: "conflict" }),
    });
    const service = createCaseEventService(events);

    await expect(
      service.update(actor, "case-1", "event-1", {
        title: "Informe reprogramado",
        expectedUpdatedAt: "2026-09-03T10:00:00.000Z",
      }),
    ).rejects.toEqual(
      new CaseEventServiceError(
        "CONFLICT",
        "El evento cambió mientras lo editabas. Actualiza e inténtalo nuevamente.",
      ),
    );
  });

  test("maps archived mutations to the case lifecycle conflict", async () => {
    const events = store({
      remove: vi.fn().mockResolvedValue({ status: "case_archived" }),
    });
    const service = createCaseEventService(events);

    await expect(
      service.remove(actor, "case-1", "event-1", "2026-09-03T10:00:00.000Z"),
    ).rejects.toEqual(
      new CaseEventServiceError(
        "CASE_ARCHIVED",
        "El caso está archivado. Restáuralo para realizar cambios.",
      ),
    );
  });

  test("rejects actors without an active studio membership", async () => {
    const events = store({
      hasMembership: vi.fn().mockResolvedValue(false),
    });
    const service = createCaseEventService(events);

    await expect(service.list(actor, "case-1", {})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(events.list).not.toHaveBeenCalled();
  });
});
