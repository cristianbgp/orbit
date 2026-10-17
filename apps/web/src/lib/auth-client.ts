import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    organizationClient({
      schema: {
        organization: {
          additionalFields: {
            timeZone: {
              type: "string",
              required: true,
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
            },
          },
        },
        invitation: {
          additionalFields: {
            position: {
              type: "string",
              required: false,
            },
          },
        },
      },
    }),
  ],
});
