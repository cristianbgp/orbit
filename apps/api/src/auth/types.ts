export type AuthSession = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  session: {
    id: string;
    activeOrganizationId: string | null;
  };
};

export type AuthService = {
  handler(request: Request): Response | Promise<Response>;
  getSession(headers: Headers): Promise<AuthSession | null>;
};

export type PasswordResetLink = {
  url: string;
  expiresAt: Date;
};

export type PasswordResetLinkIssuer = {
  issue(input: { email: string }): Promise<PasswordResetLink>;
};
