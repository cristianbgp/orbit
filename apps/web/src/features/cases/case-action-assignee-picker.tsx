import { Check, ChevronsUpDown, UserRoundX } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MemberIdentity } from "@/features/identity/member-identity";
import {
  groupStudioMembersByPosition,
  type StudioMemberPositionValue,
} from "@/features/team/studio-member-position";
import { cn } from "@/lib/utils";

export type CaseActionAssigneeMember = {
  userId: string | null;
  userName: string;
  userAlias: string;
  userAvatarColor: string | null;
  position: StudioMemberPositionValue | null;
  activeStudioMember: boolean;
};

export function CaseActionAssigneePicker({
  members,
  value,
  onChange,
}: {
  members: CaseActionAssigneeMember[];
  value: string | null;
  onChange(value: string | null): void;
}) {
  const [open, setOpen] = useState(false);
  const availableMembers = members.filter(
    (member): member is CaseActionAssigneeMember & { userId: string } =>
      Boolean(member.userId),
  );
  const selected = availableMembers.find((member) => member.userId === value);
  const groups = groupStudioMembersByPosition(
    availableMembers,
    (member) => member.position,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label="Elegir encargado"
          aria-expanded={open}
          className="h-auto min-h-11 w-full justify-between px-3 py-2 font-normal"
        >
          {selected ? (
            <MemberIdentity
              compact
              focusable={false}
              member={{
                userId: selected.userId,
                fullName: selected.userName,
                alias: selected.userAlias,
                avatarColor: selected.userAvatarColor,
                activeStudioMember: selected.activeStudioMember,
              }}
              secondary={selected.userName}
            />
          ) : (
            <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
              <UserRoundX aria-hidden="true" className="size-4" />
              {value ? "Encargado no disponible" : "Sin encargado"}
            </span>
          )}
          <ChevronsUpDown aria-hidden="true" className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command>
          <CommandInput placeholder="Buscar encargado" />
          <CommandList className="max-h-64 overscroll-contain">
            <CommandEmpty>No encontramos integrantes.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="Sin encargado"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check
                  aria-hidden="true"
                  className={cn("size-4", value ? "opacity-0" : "opacity-100")}
                />
                <UserRoundX aria-hidden="true" className="size-4" />
                Sin encargado
              </CommandItem>
            </CommandGroup>
            {groups.map((group) => (
              <CommandGroup
                key={group.label}
                heading={group.label}
                aria-label={group.label}
              >
                {group.members.map((member) => (
                  <CommandItem
                    key={member.userId}
                    value={`${member.userAlias} ${member.userName}`}
                    onSelect={() => {
                      onChange(member.userId);
                      setOpen(false);
                    }}
                  >
                    <Check
                      aria-hidden="true"
                      className={cn(
                        "size-4",
                        value === member.userId ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <MemberIdentity
                      compact
                      focusable={false}
                      member={{
                        userId: member.userId,
                        fullName: member.userName,
                        alias: member.userAlias,
                        avatarColor: member.userAvatarColor,
                        activeStudioMember: member.activeStudioMember,
                      }}
                      secondary={member.userName}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
