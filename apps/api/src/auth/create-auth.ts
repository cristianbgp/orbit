import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  createInvitationAcceptancePolicy,
  createOrganizationCreationPolicy,
  normalizeOrganizationName,
} from "./organization-policy";
import type { AuthService } from "./types";
import type { createDatabase } from "../db/client";
import * as authSchema from "../db/auth-schema";
import { generateUserAlias, isValidUserAlias } from "../identity/user-alias";
import { avatarColorForUserId } from "../identity/avatar-color";
import { DEFAULT_ORGANIZATION_TIME_ZONE } from "../organizations/organization-time-zone";
import {
  isStudioMemberPosition,
  STUDIO_MEMBER_POSITIONS,
} from "../identity/studio-member-position";
import { createPasswordResetLinkCoordinator } from "./password-reset-link-coordinator";
import type { PasswordResetLinkIssuer } from "./types";

type CreateOrbitAuthOptions = {
  db: ReturnType<typeof createDatabase>["db"];
  baseURL: string;
  secret: string;
  trustedOrigin: string;
  trustSignupEmail?: boolean;
  webOrigin?: string;
  onPasswordReset?(user: {
    id: string;
    name: string;
    email: string;
  }): Promise<void>;
};

export const INVITATION_EXPIRES_IN_SECONDS = 60 * 60 * 48;
export const DISABLED_INVITATION_LIST_PATH = "/organization/list-invitations";
export const DISABLED_ORGANIZATION_MEMBERSHIP_PATHS = [
  "/organization/remove-member",
  "/organization/leave",
] as const;
export const PASSWORD_RESET_REQUEST_HEADER = "x-orbit-password-reset-request";
const TRUSTED_CLIENT_IP_HEADER = "x-real-ip";

export function createOrbitAuth({
  db,
  baseURL,
  secret,
  trustedOrigin,
  trustSignupEmail = false,
  webOrigin = trustedOrigin,
  onPasswordReset,
}: CreateOrbitAuthOptions) {
  const passwordResetLinkCoordinator = createPasswordResetLinkCoordinator();
  const hasMembership = async (userId: string) => {
    const existing = await db
      .select({ id: authSchema.member.id })
      .from(authSchema.member)
      .where(eq(authSchema.member.userId, userId))
      .limit(1);

    return existing.length > 0;
  };

  const auth = betterAuth({
    appName: "Orbit",
    baseURL,
    secret,
    trustedOrigins: [trustedOrigin],
    advanced: {
      ipAddress: {
        ipAddressHeaders: [TRUSTED_CLIENT_IP_HEADER],
      },
    },
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: true,
      resetPasswordTokenExpiresIn: 60 * 30,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ token }, request) {
        const nonce = request?.headers.get(PASSWORD_RESET_REQUEST_HEADER);
        if (nonce) {
          const resetUrl = new URL("/reset-password", webOrigin);
          resetUrl.searchParams.set("token", token);
          passwordResetLinkCoordinator.capture(nonce, resetUrl.toString());
        }
      },
      async onPasswordReset({ user }) {
        try {
          await onPasswordReset?.({
            id: user.id,
            name: user.name,
            email: user.email,
          });
        } catch {
          console.error(
            "Account recovery completion audit could not be recorded",
          );
        }
      },
    },
    user: {
      additionalFields: {
        alias: {
          type: "string",
          required: false,
          input: false,
        },
        avatarColor: {
          type: "string",
          required: true,
          input: false,
          defaultValue: "#4657d9",
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          async before(candidate) {
            const alias = generateUserAlias(candidate.name);
            if (!isValidUserAlias(alias)) {
              throw new Error("Could not generate a valid user alias");
            }
            return {
              data: {
                ...candidate,
                alias,
                emailVerified: trustSignupEmail
                  ? true
                  : candidate.emailVerified,
                avatarColor: avatarColorForUserId(
                  candidate.id ?? candidate.email,
                ),
              },
            };
          },
        },
      },
    },
    disabledPaths: [
      DISABLED_INVITATION_LIST_PATH,
      ...DISABLED_ORGANIZATION_MEMBERSHIP_PATHS,
    ],
    plugins: [
      organization({
        allowUserToCreateOrganization:
          createOrganizationCreationPolicy(hasMembership),
        organizationLimit: 1,
        invitationExpiresIn: INVITATION_EXPIRES_IN_SECONDS,
        disableOrganizationDeletion: true,
        schema: {
          organization: {
            additionalFields: {
              timeZone: {
                type: "string",
                required: true,
                defaultValue: DEFAULT_ORGANIZATION_TIME_ZONE,
                input: false,
              },
            },
          },
          member: {
            additionalFields: {
              position: {
                type: "string",
                required: false,
                input: false,
                validator: {
                  output: z.enum(STUDIO_MEMBER_POSITIONS).nullable(),
                },
              },
            },
          },
          invitation: {
            additionalFields: {
              position: {
                type: "string",
                required: false,
                validator: {
                  input: z.enum(STUDIO_MEMBER_POSITIONS),
                  output: z.enum(STUDIO_MEMBER_POSITIONS),
                },
              },
            },
          },
        },
        organizationHooks: {
          async beforeCreateOrganization({ organization }) {
            return {
              data: {
                ...organization,
                name: await normalizeOrganizationName(organization.name ?? ""),
              },
            };
          },
          async beforeCreateInvitation({ invitation }) {
            if (!isStudioMemberPosition(invitation.position)) {
              throw new Error("Invitation position is required");
            }
            return { data: { ...invitation, position: invitation.position } };
          },
          beforeAcceptInvitation:
            createInvitationAcceptancePolicy(hasMembership),
          async afterAcceptInvitation({ invitation, member: acceptedMember }) {
            if (!isStudioMemberPosition(invitation.position)) {
              throw new Error("Invitation position is invalid");
            }
            const updated = await db
              .update(authSchema.member)
              .set({ position: invitation.position })
              .where(eq(authSchema.member.id, acceptedMember.id))
              .returning({ id: authSchema.member.id });
            if (!updated[0]) {
              throw new Error("Accepted membership position was not saved");
            }
          },
        },
      }),
    ],
  });

  const authService: AuthService = {
    handler: (request) => auth.handler(request),
    getSession: async (headers) => {
      const result = await auth.api.getSession({ headers });

      if (!result) {
        return null;
      }

      return {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
        session: {
          id: result.session.id,
          activeOrganizationId: result.session.activeOrganizationId ?? null,
        },
      };
    },
  };

  const passwordResetLinks: PasswordResetLinkIssuer = {
    issue({ email }) {
      return passwordResetLinkCoordinator.issue(
        async (nonce, input) => {
          const response = await auth.handler(
            new Request(
              new URL("/api/auth/request-password-reset", baseURL).toString(),
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Origin: trustedOrigin,
                  [TRUSTED_CLIENT_IP_HEADER]: "127.0.0.1",
                  [PASSWORD_RESET_REQUEST_HEADER]: nonce,
                },
                body: JSON.stringify({
                  email: input.email,
                  redirectTo: input.redirectTo,
                }),
              },
            ),
          );
          if (!response.ok) {
            throw new Error("Password reset request failed");
          }
        },
        {
          email,
          redirectTo: `${webOrigin}/reset-password`,
        },
      );
    },
  };

  return { auth, authService, passwordResetLinks };
}
