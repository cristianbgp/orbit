import { useState, type ReactNode } from "react";
import { Link, type To } from "react-router-dom";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AliasAvatar } from "./alias-avatar";
import type { MemberIdentityData } from "./member-identity-types";

export function MemberIdentity({
  member,
  to,
  secondary,
  compact = false,
  focusable = true,
}: {
  member: MemberIdentityData;
  to?: To;
  secondary?: ReactNode;
  compact?: boolean;
  focusable?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const tooltipOpen = hovered || focused;
  const primaryText = member.alias || member.fullName;
  const identity = (
    <>
      <AliasAvatar
        userId={member.userId}
        alias={primaryText}
        fullName={member.fullName}
        avatarColor={member.avatarColor}
        size={compact ? "xs" : "md"}
      />
      <span className="min-w-0">
        <span className="text-foreground block truncate text-xs font-semibold">
          {primaryText}
        </span>
        {secondary ? (
          <span className="text-muted-foreground block truncate text-[10px]">
            {secondary}
          </span>
        ) : null}
      </span>
    </>
  );
  const className = cn(
    "inline-flex min-w-0 items-center rounded-control text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    compact ? "gap-1.5" : "gap-2",
  );

  return (
    <TooltipProvider>
      <Tooltip open={tooltipOpen}>
        <TooltipTrigger asChild>
          {to ? (
            <Link
              className={className}
              to={to}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            >
              {identity}
            </Link>
          ) : (
            <span
              className={className}
              tabIndex={focusable ? 0 : undefined}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            >
              {identity}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent
          onEscapeKeyDown={() => {
            setHovered(false);
            setFocused(false);
          }}
        >
          {member.fullName}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
