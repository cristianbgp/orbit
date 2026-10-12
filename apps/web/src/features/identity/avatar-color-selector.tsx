import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  accessibleAvatarForeground,
  avatarColorOptions,
} from "./avatar-color-palette";

export function AvatarColorSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Color del avatar"
      className="flex flex-wrap gap-2"
    >
      {avatarColorOptions.map((option) => {
        const selected = value === option.value;
        return (
          <span key={option.value} className="relative inline-flex">
            <input
              id={`avatar-color-${option.value.slice(1)}`}
              type="radio"
              name="avatar-color"
              value={option.value}
              checked={selected}
              aria-label={option.label}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <label
              htmlFor={`avatar-color-${option.value.slice(1)}`}
              className={cn(
                "border-background ring-offset-background peer-focus-visible:ring-ring inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-2 shadow-sm ring-offset-2 transition-transform peer-focus-visible:ring-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 hover:scale-105",
                selected && "ring-primary ring-2",
              )}
              style={{
                backgroundColor: option.value,
                color: accessibleAvatarForeground(option.value),
              }}
            >
              {selected ? (
                <Check aria-hidden="true" className="size-5" />
              ) : null}
            </label>
          </span>
        );
      })}
    </div>
  );
}
