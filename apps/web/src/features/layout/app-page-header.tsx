import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type AppPageHeaderProps = ComponentProps<"header"> & {
  icon: LucideIcon;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

export function AppPageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  className,
  ...props
}: AppPageHeaderProps) {
  return (
    <header
      data-slot="app-page-header"
      className={cn(
        "border-border flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        <span
          data-slot="app-page-header-icon"
          className="bg-primary-soft text-primary-strong flex size-11 shrink-0 items-center justify-center rounded-xl"
        >
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 space-y-1.5">
          {eyebrow ? (
            <p className="text-primary text-sm font-semibold">{eyebrow}</p>
          ) : null}
          <h1 className="font-display text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground max-w-2xl text-sm leading-6">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="w-full shrink-0 sm:w-auto">{actions}</div>
      ) : null}
    </header>
  );
}
