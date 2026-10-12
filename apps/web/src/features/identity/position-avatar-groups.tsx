import { Link } from "react-router-dom";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  groupStudioMembersByPosition,
  studioMemberPositionLabel,
  type StudioMemberPositionValue,
} from "@/features/team/studio-member-position";
import { cn } from "@/lib/utils";
import { AliasAvatar } from "./alias-avatar";

export type PositionAvatarPerson = {
  identityId: string;
  userId: string | null;
  alias: string;
  fullName: string;
  avatarColor: string | null;
  position: StudioMemberPositionValue | null;
  activeStudioMember: boolean;
  contextualRole?: string;
};

const MAX_VISIBLE_PER_POSITION = 3;

function identityLabel(person: PositionAvatarPerson) {
  return [
    person.alias,
    person.fullName,
    studioMemberPositionLabel(person.position),
    person.contextualRole,
  ]
    .filter(Boolean)
    .join(", ");
}

function IdentityTooltip({ person }: { person: PositionAvatarPerson }) {
  return (
    <TooltipContent>
      <span className="font-semibold">{person.alias}</span>
      {` · ${person.fullName} · ${studioMemberPositionLabel(person.position)}`}
      {person.contextualRole ? ` · ${person.contextualRole}` : null}
    </TooltipContent>
  );
}

function AvatarIdentity({
  person,
  size,
}: {
  person: PositionAvatarPerson;
  size: "sm" | "md";
}) {
  const avatar = (
    <AliasAvatar
      userId={person.userId ?? person.identityId}
      alias={person.alias}
      fullName={person.fullName}
      avatarColor={person.avatarColor}
      size={size}
    />
  );
  const triggerClassName = cn(
    "group focus-visible:z-10 relative inline-flex min-h-11 items-center justify-center rounded-full outline-none lg:min-h-9",
    size === "sm" ? "w-8" : "w-10",
  );
  const visual = (
    <span
      data-slot="position-avatar-visual"
      className={cn(
        "border-card group-focus-visible:ring-ring relative inline-flex shrink-0 items-center justify-center rounded-full border-2 group-focus-visible:ring-2",
        size === "sm" ? "size-8" : "size-10",
      )}
    >
      {avatar}
    </span>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {person.activeStudioMember && person.userId ? (
          <Link
            to={`/team/${person.userId}`}
            aria-label={identityLabel(person)}
            className={triggerClassName}
          >
            {visual}
          </Link>
        ) : (
          <span
            tabIndex={0}
            aria-label={identityLabel(person)}
            className={triggerClassName}
          >
            {visual}
          </span>
        )}
      </TooltipTrigger>
      <IdentityTooltip person={person} />
    </Tooltip>
  );
}

function pluralPosition(label: string, count: number) {
  if (label === "Sin posición")
    return `${count === 1 ? "integrante" : "integrantes"} sin posición`;
  if (count === 1) return label.toLocaleLowerCase("es-PE");
  if (label === "Senior" || label === "Junior")
    return `${label.toLocaleLowerCase("es-PE")}s`;
  return `${label.toLocaleLowerCase("es-PE")}s`;
}

export function PositionAvatarGroups({
  people,
  emptyLabel,
  ariaLabel,
  size = "sm",
  scrollable = true,
}: {
  people: readonly PositionAvatarPerson[];
  emptyLabel: string;
  ariaLabel: string;
  size?: "sm" | "md";
  scrollable?: boolean;
}) {
  if (people.length === 0) {
    return (
      <span className="text-muted-foreground text-xs font-medium">
        {emptyLabel}
      </span>
    );
  }

  const groups = groupStudioMembersByPosition(
    people,
    (person) => person.position,
  ).map((group) => ({
    ...group,
    members: [...group.members].sort(
      (left, right) =>
        left.fullName.localeCompare(right.fullName, "es") ||
        left.identityId.localeCompare(right.identityId),
    ),
  }));

  return (
    <TooltipProvider>
      <div
        role="group"
        aria-label={ariaLabel}
        className={cn(
          scrollable
            ? "w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain"
            : "min-w-fit",
        )}
      >
        <div
          className={cn("flex w-max items-stretch", scrollable && "min-w-full")}
        >
          {groups.map((group, groupIndex) => {
            const visible = group.members.slice(0, MAX_VISIBLE_PER_POSITION);
            const hidden = group.members.slice(MAX_VISIBLE_PER_POSITION);
            const overflowLabel = `${hidden.length} ${pluralPosition(group.label, hidden.length)} más`;
            return (
              <div
                key={group.label}
                className={cn(
                  "min-w-fit px-2 first:pl-0 last:pr-0",
                  groupIndex > 0 && "border-border border-l",
                )}
              >
                <span className="text-muted-foreground block text-[0.625rem] leading-4 font-semibold tracking-[0.08em] uppercase">
                  {group.label}
                </span>
                <div className="mt-0.5 flex items-center -space-x-2">
                  {visible.map((person) => (
                    <AvatarIdentity
                      key={person.identityId}
                      person={person}
                      size={size}
                    />
                  ))}
                  {hidden.length ? (
                    <Popover>
                      <Tooltip>
                        <PopoverTrigger asChild>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={overflowLabel}
                              className={cn(
                                "group relative inline-flex min-h-11 items-center justify-center rounded-full outline-none focus-visible:z-10 lg:min-h-9",
                                size === "sm" ? "w-8" : "w-10",
                              )}
                            >
                              <span
                                data-slot="position-avatar-overflow-visual"
                                className={cn(
                                  "border-card bg-muted text-muted-foreground group-focus-visible:ring-ring inline-flex shrink-0 items-center justify-center rounded-full border-2 text-[0.625rem] font-semibold group-focus-visible:ring-2",
                                  size === "sm" ? "size-8" : "size-10",
                                )}
                              >
                                +{hidden.length}
                              </span>
                            </button>
                          </TooltipTrigger>
                        </PopoverTrigger>
                        <TooltipContent>{overflowLabel}</TooltipContent>
                      </Tooltip>
                      <PopoverContent
                        role="dialog"
                        aria-label={`${group.label}: integrantes adicionales`}
                        align="end"
                        className="max-h-[min(20rem,70dvh)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain p-2"
                      >
                        <p className="text-muted-foreground px-2 py-1 text-xs font-semibold tracking-wide uppercase">
                          {group.label}
                        </p>
                        <div className="mt-1 space-y-1">
                          {hidden.map((person) => {
                            const content = (
                              <>
                                <AliasAvatar
                                  userId={person.userId ?? person.identityId}
                                  alias={person.alias}
                                  fullName={person.fullName}
                                  avatarColor={person.avatarColor}
                                  size="sm"
                                />
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold">
                                    {person.alias} · {person.fullName}
                                  </span>
                                  <span className="text-muted-foreground block truncate text-xs">
                                    {group.label}
                                    {person.contextualRole
                                      ? ` · ${person.contextualRole}`
                                      : null}
                                  </span>
                                </span>
                              </>
                            );
                            return person.activeStudioMember &&
                              person.userId ? (
                              <Link
                                key={person.identityId}
                                to={`/team/${person.userId}`}
                                className="hover:bg-muted focus-visible:ring-ring flex min-h-11 items-center gap-2 rounded-md px-2 outline-none focus-visible:ring-2"
                              >
                                {content}
                              </Link>
                            ) : (
                              <div
                                key={person.identityId}
                                className="flex min-h-11 items-center gap-2 rounded-md px-2"
                              >
                                {content}
                              </div>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
