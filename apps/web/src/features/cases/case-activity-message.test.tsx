import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";

import type { ProjectActivity } from "@/lib/api/generated/models";
import { CaseActivityMessage } from "./case-activity-message";

function activity(overrides: Partial<ProjectActivity>): ProjectActivity {
  return {
    id: "activity-1",
    type: "case.created",
    actor: {
      userId: "actor-1",
      alias: "CG",
      avatarColor: "#465df5",
      nameSnapshot: "Cristian Granda",
      activeStudioMember: true,
      linkable: true,
    },
    subject: null,
    details: {},
    createdAt: "2026-09-02T15:00:00.000Z",
    ...overrides,
  };
}

describe("CaseActivityMessage", () => {
  test("links active actors and subjects in assignment activity", () => {
    render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case_assignment.added",
            subject: {
              userId: "subject-1",
              alias: "AT",
              avatarColor: "#0d9488",
              nameSnapshot: "Ana Torres",
              activeStudioMember: true,
              linkable: true,
            },
          })}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /CG/i })).toHaveAttribute(
      "href",
      "/team/actor-1",
    );
    expect(screen.getByRole("link", { name: /AT/i })).toHaveAttribute(
      "href",
      "/team/subject-1",
    );
    expect(screen.getByText(/añadió a/)).toBeInTheDocument();
  });

  test("distinguishes follow-up assignments from the working team", () => {
    render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case_assignment.added",
            details: { responsibility: "follower" },
            subject: {
              userId: "subject-1",
              alias: "AT",
              avatarColor: null,
              nameSnapshot: "Ana Torres",
              activeStudioMember: true,
              linkable: true,
            },
          })}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/al seguimiento del caso/)).toBeVisible();
  });

  test("shows status and result changes as semantic badges", () => {
    render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.updated",
            details: {
              previousStatus: "in_progress",
              newStatus: "concluded",
              previousResult: null,
              newResult: "founded",
            },
          })}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("En trámite")).toHaveAttribute(
      "data-case-status",
      "in_progress",
    );
    expect(screen.getByText("Concluido")).toHaveAttribute(
      "data-case-status",
      "concluded",
    );
    expect(screen.getByText("Fundada")).toHaveAttribute(
      "data-case-result",
      "founded",
    );
  });

  test("describes ordinary and nullable field changes with product labels", () => {
    const { rerender } = render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.updated",
            details: {
              previousIdentification: "Caso anterior",
              newIdentification: "Caso actualizado",
            },
          })}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/cambió la identificación/i).parentElement,
    ).toHaveTextContent("Caso anterior");
    expect(
      screen.getByText(/cambió la identificación/i).parentElement,
    ).toHaveTextContent("Caso actualizado");

    rerender(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.updated",
            details: {
              previousStage: null,
              newStage: "judicial_first_instance",
            },
          })}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/cambió la etapa/i).parentElement,
    ).toHaveTextContent(/Sin definir.*Primera Instancia/);
  });

  test("groups period and amount storage fields into readable changes", () => {
    render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.updated",
            details: {
              previousPeriodKind: "year",
              newPeriodKind: "month_range",
              previousPeriodStart: "2025-01-01",
              newPeriodStart: "2026-01-01",
              previousPeriodEnd: "2025-12-01",
              newPeriodEnd: "2026-03-01",
              previousAmount: "1000.00",
              newAmount: "2500.00",
              previousCurrency: "PEN",
              newCurrency: "USD",
            },
          })}
        />
      </MemoryRouter>,
    );

    const message = screen.getByRole("group", {
      name: "Actualización del caso: 2 cambios",
    });
    expect(message).toHaveTextContent(/período.*2025.*ene 2026.*mar 2026/i);
    expect(message).toHaveTextContent(
      /importe.*S\/.*1,000\.00.*USD.*2,500\.00/i,
    );
  });

  test("shows result-only updates with semantic badges", () => {
    render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.updated",
            details: {
              previousResult: "founded",
              newResult: "unfounded",
            },
          })}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Fundada")).toHaveAttribute(
      "data-case-result",
      "founded",
    );
    expect(screen.getByText("Infundada")).toHaveAttribute(
      "data-case-result",
      "unfounded",
    );
  });

  test("translates every catalog and text field in a multi-field update", () => {
    render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.updated",
            details: {
              previousClientId: "client-1",
              newClientId: "client-2",
              previousClientName: "Cliente anterior",
              newClientName: "Cliente nuevo",
              previousType: "administrative",
              newType: "judicial",
              previousSubtype: "audit",
              newSubtype: "dca",
              previousEntity: "sunat",
              newEntity: "judiciary",
              previousDocketNumber: null,
              newDocketNumber: "EXP-002",
              previousTax: "IGV",
              newTax: "IR",
              previousClaimantType: "client",
              newClaimantType: "sunat",
              previousDisputedMatter: null,
              newDisputedMatter: "Nueva materia",
              previousChallengedResolution: "RES-001",
              newChallengedResolution: null,
            },
          })}
        />
      </MemoryRouter>,
    );

    const update = screen.getByRole("group", {
      name: "Actualización del caso: 9 cambios",
    });
    expect(update).toHaveTextContent("actualizó 9 campos del caso");
    expect(update).toHaveTextContent(/Cliente anterior.*Cliente nuevo/i);
    expect(update).toHaveTextContent(/Administrativo.*Judicial/i);
    expect(update).toHaveTextContent(/Fiscalización.*DCA/i);
    expect(
      within(update).queryByText("Poder Judicial"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(update).getByRole("button", { name: "Ver 6 cambios más" }),
    );

    expect(update).toHaveTextContent(/SUNAT.*Poder Judicial/i);
    expect(update).toHaveTextContent(/Sin definir.*EXP-002/i);
    expect(update).toHaveTextContent(/IGV.*Impuesto a la Renta/i);
    expect(update).toHaveTextContent(/Cliente: Cliente anterior.*SUNAT/i);
    expect(update).toHaveTextContent(/Sin definir.*Nueva materia/i);
    expect(update).toHaveTextContent(/RES-001.*Sin definir/i);
    expect(
      within(update).getByRole("button", { name: "Ocultar cambios" }),
    ).toBeVisible();
  });

  test("keeps legacy free-text claimant activities readable", () => {
    render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.updated",
            details: {
              previousClaimant: "Cliente anterior",
              newClaimant: "SUNAT",
            },
          })}
        />
      </MemoryRouter>,
    );

    expect(document.body).toHaveTextContent(
      /cambió el demandante.*Cliente anterior.*SUNAT/i,
    );
  });

  test("describes the complete lifecycle of a manual case development", () => {
    const { rerender } = render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.update_created",
            details: {
              updateId: "update-1",
              date: "2026-08-11",
              description: "Recurso de apelación del cliente",
            },
          })}
        />
      </MemoryRouter>,
    );

    expect(document.body).toHaveTextContent(
      /registró la novedad.*11 ago.*2026.*Recurso de apelación del cliente/i,
    );

    rerender(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.update_changed",
            details: {
              updateId: "update-1",
              date: "2026-08-11",
              description: "Recurso de apelación",
              newDate: "2026-08-12",
              newDescription: "Recurso presentado",
            },
          })}
        />
      </MemoryRouter>,
    );

    const change = screen.getByRole("group", {
      name: "Actualización de la novedad: 2 cambios",
    });
    expect(change).toHaveTextContent(/11 ago.*2026.*12 ago.*2026/i);
    expect(change).toHaveTextContent(
      /Recurso de apelación.*Recurso presentado/i,
    );

    rerender(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.update_archived",
            details: { date: "2026-08-12", description: "Recurso presentado" },
          })}
        />
      </MemoryRouter>,
    );
    expect(document.body).toHaveTextContent(
      /archivó la novedad.*Recurso presentado/i,
    );

    rerender(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.update_restored",
            details: { date: "2026-08-12", description: "Recurso presentado" },
          })}
        />
      </MemoryRouter>,
    );
    expect(document.body).toHaveTextContent(
      /restauró la novedad.*Recurso presentado/i,
    );
  });

  test("describes an individual change from novelty to background", () => {
    render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.update_changed",
            details: {
              updateId: "update-1",
              date: "2026-08-11",
              description: "Recurso presentado",
              kind: "update",
              newDate: "2026-08-11",
              newDescription: "Recurso presentado",
              newKind: "background",
            },
          })}
        />
      </MemoryRouter>,
    );

    expect(document.body).toHaveTextContent(
      /convirtió la novedad en antecedente/i,
    );
    expect(document.body).not.toHaveTextContent(/actualizó un campo/i);
  });

  test("uses antecedente when archiving or restoring a background", () => {
    const { rerender } = render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.update_archived",
            details: {
              date: "2026-08-12",
              description: "Sentencia de primera instancia",
              kind: "background",
            },
          })}
        />
      </MemoryRouter>,
    );

    expect(document.body).toHaveTextContent(
      /archivó el antecedente.*Sentencia de primera instancia/i,
    );

    rerender(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.update_restored",
            details: {
              date: "2026-08-12",
              description: "Sentencia de primera instancia",
              kind: "background",
            },
          })}
        />
      </MemoryRouter>,
    );

    expect(document.body).toHaveTextContent(
      /restauró el antecedente.*Sentencia de primera instancia/i,
    );
  });

  test("summarizes an aggregate conversion to backgrounds", () => {
    render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.updates_moved_to_background",
            details: { count: "12" },
          })}
        />
      </MemoryRouter>,
    );

    expect(document.body).toHaveTextContent(
      /convirtió 12 novedades en antecedentes/i,
    );
  });

  test("uses singular wording for one aggregate conversion", () => {
    render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.updates_moved_to_background",
            details: { count: "1" },
          })}
        />
      </MemoryRouter>,
    );

    expect(document.body).toHaveTextContent(
      /convirtió 1 novedad en antecedente/i,
    );
  });

  test("describes case action lifecycle and assignment", () => {
    const { rerender } = render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.action_created",
            details: { actionId: "action-1", description: "Preparar alegatos" },
          })}
        />
      </MemoryRouter>,
    );
    expect(document.body).toHaveTextContent(
      /creó la acción.*Preparar alegatos/i,
    );
    rerender(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.action_assigned",
            details: {
              actionId: "action-1",
              description: "Preparar alegatos",
              newAssigneeName: "Luis Paz",
            },
            subject: {
              userId: "user-2",
              nameSnapshot: "Luis Paz",
              alias: "LP",
              avatarColor: null,
              activeStudioMember: true,
              linkable: true,
            },
          })}
        />
      </MemoryRouter>,
    );
    expect(document.body).toHaveTextContent(/asignó.*Preparar alegatos.*LP/i);
    rerender(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.action_completed",
            details: { actionId: "action-1", description: "Preparar alegatos" },
          })}
        />
      </MemoryRouter>,
    );
    expect(document.body).toHaveTextContent(
      /marcó como completada.*Preparar alegatos/i,
    );
  });

  test("mentions the assignee when an action is created assigned", () => {
    render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.action_created",
            details: {
              actionId: "action-1",
              description: "Preparar alegatos",
              assigneeUserId: "user-2",
              assigneeName: "Luis Paz",
            },
            subject: {
              userId: "user-2",
              nameSnapshot: "Luis Paz",
              alias: "LP",
              avatarColor: null,
              activeStudioMember: true,
              linkable: true,
            },
          })}
        />
      </MemoryRouter>,
    );

    expect(document.body).toHaveTextContent(
      /creó la acción.*Preparar alegatos.*y la asignó a.*LP/i,
    );
  });

  test("describes case event creation and deletion with their snapshot", () => {
    const { rerender } = render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.event_created",
            details: {
              eventId: "event-1",
              title: "Vista de la causa",
              type: "oral_argument",
              date: "2026-09-18",
              description: "Informe ante la Sala",
            },
          })}
        />
      </MemoryRouter>,
    );

    expect(document.body).toHaveTextContent(
      /registró el evento.*Vista de la causa.*Informe oral.*18 set.*2026/i,
    );

    rerender(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.event_deleted",
            details: {
              eventId: "event-1",
              title: "Vista de la causa",
              type: "oral_argument",
              date: "2026-09-18",
              description: "Informe ante la Sala",
            },
          })}
        />
      </MemoryRouter>,
    );

    expect(document.body).toHaveTextContent(
      /eliminó el evento.*Vista de la causa.*Informe oral.*18 set.*2026/i,
    );
  });

  test("uses the specific label for interview and other events", () => {
    const { rerender } = render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.event_created",
            details: {
              eventId: "event-2",
              title: "Entrevista con especialista",
              type: "interview",
              date: "2026-09-18",
              description: null,
            },
          })}
        />
      </MemoryRouter>,
    );
    expect(document.body).toHaveTextContent(
      /Entrevista con especialista.*Entrevista/i,
    );

    rerender(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.event_created",
            details: {
              eventId: "event-3",
              title: "Otra fecha relevante",
              type: "other",
              date: "2026-09-20",
              description: null,
            },
          })}
        />
      </MemoryRouter>,
    );
    expect(document.body).toHaveTextContent(/Otra fecha relevante.*Otro/i);
  });

  test("shows changed case event fields in a structured activity", () => {
    render(
      <MemoryRouter>
        <CaseActivityMessage
          activity={activity({
            type: "case.event_updated",
            details: {
              eventId: "event-1",
              title: "Vista de la causa",
              type: "oral_argument",
              date: "2026-09-18",
              description: null,
              newTitle: "Vista reprogramada",
              newType: "oral_argument",
              newDate: "2026-09-21",
              newDescription: "Sala especializada",
            },
          })}
        />
      </MemoryRouter>,
    );

    const message = screen.getByRole("group", {
      name: "Actualización del evento: 3 cambios",
    });
    expect(message).toHaveTextContent(
      /título.*Vista de la causa.*Vista reprogramada/i,
    );
    expect(message).toHaveTextContent(/fecha.*18 set.*2026.*21 set.*2026/i);
    expect(message).toHaveTextContent(
      /descripción.*Sin definir.*Sala especializada/i,
    );
  });
});
