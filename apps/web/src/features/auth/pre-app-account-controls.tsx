import { useCallback, useRef, useState } from "react";

import { OrbitMark } from "@/components/orbit-mark";
import { Button } from "@/components/ui/button";

const SIGN_OUT_ERROR = "No pudimos cerrar la sesión. Inténtalo nuevamente.";

export type PreAppSignOutController = {
  signOut(): Promise<void>;
  isSigningOut: boolean;
  signOutError: string | null;
};

export type PreAppAccountControls = PreAppSignOutController & {
  email: string;
};

export function usePreAppSignOut(
  onSignOut: () => Promise<void> | void,
): PreAppSignOutController {
  const pendingRef = useRef(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    if (pendingRef.current) return;

    pendingRef.current = true;
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      await onSignOut();
    } catch {
      setSignOutError(SIGN_OUT_ERROR);
    } finally {
      pendingRef.current = false;
      setIsSigningOut(false);
    }
  }, [onSignOut]);

  return { signOut, isSigningOut, signOutError };
}

export function PreAppAccountBar({
  account,
}: {
  account?: PreAppAccountControls;
}) {
  return (
    <header
      data-testid="pre-app-header"
      className="border-border flex min-h-36 flex-col gap-4 border-b pb-5 sm:min-h-20 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3">
        <OrbitMark className="size-9" />
        <div>
          <p className="font-display text-lg font-semibold tracking-[-0.03em]">
            Orbit
          </p>
          <p className="text-muted-foreground text-xs">
            Gestión de proyectos legales
          </p>
        </div>
      </div>

      <div
        data-testid="pre-app-account-slot"
        className="flex min-h-[3.75rem] min-w-0 flex-col justify-center gap-2 sm:items-end"
      >
        {account ? (
          <>
            <p className="text-muted-foreground max-w-full text-sm font-medium break-all sm:text-right">
              {account.email}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={account.isSigningOut}
              onClick={() => void account.signOut()}
            >
              {account.isSigningOut ? "Cerrando sesión…" : "Cerrar sesión"}
            </Button>
            {account.signOutError ? (
              <p role="alert" className="text-danger text-sm">
                {account.signOutError}
              </p>
            ) : null}
          </>
        ) : (
          <div
            data-testid="pre-app-account-placeholder"
            aria-hidden="true"
            className="flex min-h-[3.75rem] w-full flex-col justify-center gap-2 sm:items-end"
          >
            <span className="bg-muted h-4 w-full max-w-52 rounded motion-safe:animate-pulse" />
            <span className="bg-muted h-8 w-24 rounded-md motion-safe:animate-pulse" />
          </div>
        )}
      </div>
    </header>
  );
}
