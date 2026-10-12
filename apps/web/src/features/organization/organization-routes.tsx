import { useCallback, useLayoutEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { StudioActivityPage } from "@/features/activity/studio-activity-page";
import { ClientsPage } from "@/features/clients/clients-page";
import { CasesPage } from "@/features/cases/cases-page";
import { CaseCreatePage } from "@/features/cases/case-create-page";
import { CaseDetailPage } from "@/features/cases/case-detail-page";
import { CaseSettingsPage } from "@/features/cases/case-settings-page";
import { CasePresentationPage } from "@/features/cases/case-presentation-page";
import { ProjectDetailPage } from "@/features/projects/project-detail-page";
import { ProjectCreatePage } from "@/features/projects/project-create-page";
import { ProjectSettingsPage } from "@/features/projects/project-settings-page";
import { ProjectsPage } from "@/features/projects/projects-page";
import { TeamPage } from "@/features/team/team-page";
import {
  InvitationOnboardingGuard,
  type InvitationOnboardingGuardState,
} from "@/features/invitations/invitation-onboarding-guard";
import { InvitationOnboardingPage } from "@/features/invitations/invitation-onboarding-page";
import {
  getActiveUserInvitations,
  type UserInvitation,
} from "@/features/invitations/user-invitation-policy";
import { AppShell } from "@/features/layout/app-shell";
import { MemberProfilePage } from "@/features/identity/member-profile-page";
import { ProfilePage } from "@/features/identity/profile-page";
import { MyWorkPage } from "@/features/my-work/my-work-page";
import { OrbitHelpRoute } from "@/features/help-assistant/orbit-help-route";
import type { PreAppAccountControls } from "@/features/auth/pre-app-account-controls";
import {
  OrganizationGuard,
  type OrganizationGuardState,
} from "./organization-guard";
import {
  createAndActivateOrganization,
  type OrganizationOnboardingActions,
} from "./organization-onboarding";
import { OrganizationOnboardingPage } from "./organization-onboarding-page";
import { authClient } from "@/lib/auth-client";

type OrganizationRoutesProps = {
  user: { id: string; name: string; email: string };
  activeOrganizationId: string | null;
  refreshSession(): Promise<void>;
  onSignOut(): Promise<void> | void;
  account: PreAppAccountControls;
  onStartupPhaseChange?(phase: OrganizationStartupPhase): void;
};

export type OrganizationStartupPhase = "organization" | "invitations" | "ready";

function toActionError(error: { code?: string; message?: string } | null) {
  return error ? { code: error.code, message: error.message } : null;
}

export function OrganizationRoutes({
  user,
  activeOrganizationId,
  refreshSession,
  onSignOut,
  account,
  onStartupPhaseChange,
}: OrganizationRoutesProps) {
  const navigate = useNavigate();
  const organizationsQuery = authClient.useListOrganizations();
  const shouldCheckInvitations =
    !organizationsQuery.isPending &&
    !organizationsQuery.error &&
    (organizationsQuery.data?.length ?? 0) === 0;
  const invitationsQuery = useQuery({
    queryKey: ["user-invitations"],
    enabled: shouldCheckInvitations,
    queryFn: async () => {
      const result = await authClient.organization.listUserInvitations();
      if (result.error || !result.data) {
        throw new Error("Invitation lookup failed");
      }
      return result.data;
    },
  });
  const activeInvitations = getActiveUserInvitations(
    (invitationsQuery.data ?? []) as UserInvitation[],
  );
  const refresh = useCallback(async () => {
    await Promise.all([organizationsQuery.refetch(), refreshSession()]);
  }, [organizationsQuery, refreshSession]);
  const activate = useCallback(
    async (organizationId: string) => {
      const result = await authClient.organization.setActive({
        organizationId,
      });

      if (result.error) {
        throw new Error("Organization activation failed");
      }

      await refresh();
    },
    [refresh],
  );
  const createOrganization = useCallback(
    async (name: string) => {
      const actions: OrganizationOnboardingActions = {
        async create(input) {
          const result = await authClient.organization.create(input);

          return {
            data: result.data ? { id: result.data.id } : null,
            error: toActionError(result.error),
          };
        },
        async setActive(organizationId) {
          const result = await authClient.organization.setActive({
            organizationId,
          });

          return {
            data: result.data,
            error: toActionError(result.error),
          };
        },
        refresh,
      };

      await createAndActivateOrganization({ name }, actions);
      navigate("/projects", { replace: true });
    },
    [navigate, refresh],
  );
  const guardState: OrganizationGuardState = organizationsQuery.isPending
    ? { status: "loading" }
    : organizationsQuery.error
      ? { status: "error" }
      : {
          status: "ready",
          organizations: (organizationsQuery.data ?? []).map(
            (organization) => ({
              id: organization.id,
              name: organization.name,
              timeZone: organization.timeZone,
            }),
          ),
          activeOrganizationId,
        };
  const invitationGuardState: InvitationOnboardingGuardState =
    !shouldCheckInvitations
      ? { status: "inactive" }
      : invitationsQuery.isPending
        ? { status: "loading" }
        : invitationsQuery.isError
          ? { status: "error" }
          : {
              status: "ready",
              activeInvitationCount: activeInvitations.length,
            };
  const startupPhase: OrganizationStartupPhase = organizationsQuery.isPending
    ? "organization"
    : shouldCheckInvitations && invitationsQuery.isPending
      ? "invitations"
      : "ready";

  useLayoutEffect(() => {
    onStartupPhaseChange?.(startupPhase);
  }, [onStartupPhaseChange, startupPhase]);

  async function rejectInvitation(invitationId: string) {
    const result = await authClient.organization.rejectInvitation({
      invitationId,
    });
    if (result.error) throw new Error("Invitation rejection failed");
    await invitationsQuery.refetch();
  }

  return (
    <Routes>
      <Route
        element={
          <InvitationOnboardingGuard
            state={invitationGuardState}
            account={account}
            renderLoadingScreen={!onStartupPhaseChange}
            retry={() => {
              void invitationsQuery.refetch();
            }}
          />
        }
      >
        <Route
          element={
            <OrganizationGuard
              state={guardState}
              account={account}
              renderLoadingScreen={!onStartupPhaseChange}
              activate={activate}
              retry={() => {
                void organizationsQuery.refetch();
              }}
            />
          }
        >
          <Route
            element={
              <AppShell
                user={user}
                organizationId={
                  activeOrganizationId ?? "no-active-organization"
                }
                onSignOut={onSignOut}
              />
            }
          >
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="/my-work" element={<MyWorkPage />} />
            <Route
              path="/activity"
              element={
                <StudioActivityPage
                  organizationId={
                    activeOrganizationId ?? "no-active-organization"
                  }
                />
              }
            />
            <Route
              path="/projects"
              element={<ProjectsPage currentUserId={user.id} />}
            />
            <Route path="/projects/new" element={<ProjectCreatePage />} />
            <Route
              path="/projects/:projectId"
              element={<ProjectDetailPage />}
            />
            <Route
              path="/projects/:projectId/settings"
              element={<ProjectSettingsPage />}
            />
            <Route path="/clients" element={<ClientsPage />} />
            <Route
              path="/cases"
              element={<CasesPage currentUserId={user.id} />}
            />
            <Route path="/cases/new" element={<CaseCreatePage />} />
            <Route
              path="/cases/presentation"
              element={<CasePresentationPage />}
            />
            <Route path="/cases/:caseId" element={<CaseDetailPage />} />
            <Route
              path="/cases/:caseId/settings"
              element={<CaseSettingsPage />}
            />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route
              path="/help/ask"
              element={
                <OrbitHelpRoute
                  userId={user.id}
                  organizationId={
                    activeOrganizationId ?? "no-active-organization"
                  }
                />
              }
            />
            <Route path="/team/:userId" element={<MemberProfilePage />} />
          </Route>
          <Route
            path="/onboarding/invitations"
            element={
              <InvitationOnboardingPage
                invitations={activeInvitations}
                account={account}
                onReject={rejectInvitation}
              />
            }
          />
          <Route
            path="/onboarding/organization"
            element={
              <OrganizationOnboardingPage
                userName={user.name}
                account={account}
                onCreate={createOrganization}
              />
            }
          />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
