import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function AppPage({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="app-page"
      className={cn(
        "mx-auto w-full max-w-384 min-w-0 flex-1 px-4 py-6 sm:px-7 lg:px-9 lg:py-8",
        className,
      )}
      {...props}
    />
  );
}

export function AppPageContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="app-page-content"
      className={cn("grid min-w-0 gap-5 py-5", className)}
      {...props}
    />
  );
}
