export function getInvitationId(pathname: string): string | null {
  const match = /^\/invitations\/([^/]+)$/.exec(pathname);
  if (!match?.[1]) return null;

  try {
    const invitationId = decodeURIComponent(match[1]).trim();
    return invitationId || null;
  } catch {
    return null;
  }
}
