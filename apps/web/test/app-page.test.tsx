import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { AppPage, AppPageContent } from "@/features/layout/app-page";

describe("AppPage", () => {
  test("provides the shared application frame and page rhythm", () => {
    render(<AppPage>Contenido</AppPage>);

    const page = screen.getByText("Contenido");
    expect(page).toHaveAttribute("data-slot", "app-page");
    expect(page).toHaveClass(
      "flex-1",
      "mx-auto",
      "w-full",
      "max-w-384",
      "min-w-0",
      "px-4",
      "sm:px-7",
      "lg:px-9",
      "py-6",
      "lg:py-8",
    );
  });

  test("provides the shared spacing between a page heading and its sections", () => {
    render(
      <AppPageContent>
        <section>Primera sección</section>
        <section>Segunda sección</section>
      </AppPageContent>,
    );

    const content = screen.getByText("Primera sección").parentElement;
    expect(content).toHaveAttribute("data-slot", "app-page-content");
    expect(content).toHaveClass("grid", "min-w-0", "gap-5", "py-5");
  });
});
