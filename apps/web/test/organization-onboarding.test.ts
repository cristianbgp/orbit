import { describe, expect, test, vi } from "vitest";

import {
  createAndActivateOrganization,
  createOrganizationSlug,
  OrganizationOnboardingError,
  validateOrganizationName,
} from "@/features/organization/organization-onboarding";

describe("organization onboarding", () => {
  test.each(["", " ", "a", "x".repeat(121)])(
    "rejects the invalid name %j",
    (name) => {
      expect(validateOrganizationName(name)).toBe(
        "El nombre debe tener entre 2 y 120 caracteres.",
      );
    },
  );

  test("accepts and trims a valid name", () => {
    expect(validateOrganizationName("  Estudio Orbit  ")).toBeNull();
  });

  test("creates an ASCII-safe hidden slug", () => {
    expect(
      createOrganizationSlug("  Estudio Núñez & Asociados  ", "k7m4p2"),
    ).toBe("estudio-nunez-asociados-k7m4p2");
  });

  test("uses a stable fallback when the name has no ASCII letters", () => {
    expect(createOrganizationSlug("法律", "k7m4p2")).toBe(
      "organization-k7m4p2",
    );
  });

  test("retries one slug collision and activates without recreating", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: "ORGANIZATION_ALREADY_EXISTS" },
      })
      .mockResolvedValueOnce({ data: { id: "org-1" }, error: null });
    const setActive = vi.fn().mockResolvedValue({ error: null });
    const refresh = vi.fn().mockResolvedValue(undefined);

    await createAndActivateOrganization(
      {
        name: "Estudio Orbit",
        nextSuffix: vi
          .fn()
          .mockReturnValueOnce("aaaaaa")
          .mockReturnValueOnce("bbbbbb"),
      },
      { create, setActive, refresh },
    );

    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenNthCalledWith(1, {
      name: "Estudio Orbit",
      slug: "estudio-orbit-aaaaaa",
    });
    expect(create).toHaveBeenNthCalledWith(2, {
      name: "Estudio Orbit",
      slug: "estudio-orbit-bbbbbb",
    });
    expect(setActive).toHaveBeenCalledWith("org-1");
    expect(refresh).toHaveBeenCalledOnce();
  });

  test("recovers activation without creating a second organization", async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ data: { id: "org-1" }, error: null });
    const setActive = vi
      .fn()
      .mockResolvedValueOnce({ error: { code: "NETWORK_ERROR" } })
      .mockResolvedValueOnce({ error: null });
    const refresh = vi.fn().mockResolvedValue(undefined);

    await createAndActivateOrganization(
      { name: "Estudio Orbit", nextSuffix: () => "aaaaaa" },
      { create, setActive, refresh },
    );

    expect(create).toHaveBeenCalledOnce();
    expect(setActive).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  test("rejects invalid input before creating", async () => {
    const create = vi.fn();

    await expect(
      createAndActivateOrganization(
        { name: " ", nextSuffix: () => "aaaaaa" },
        {
          create,
          setActive: vi.fn(),
          refresh: vi.fn(),
        },
      ),
    ).rejects.toBeInstanceOf(OrganizationOnboardingError);
    expect(create).not.toHaveBeenCalled();
  });

  test("stops after the second slug collision", async () => {
    const create = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "ORGANIZATION_SLUG_ALREADY_TAKEN" },
    });

    await expect(
      createAndActivateOrganization(
        { name: "Estudio Orbit", nextSuffix: () => "aaaaaa" },
        { create, setActive: vi.fn(), refresh: vi.fn() },
      ),
    ).rejects.toMatchObject({
      message: "No pudimos crear el estudio. Inténtalo nuevamente.",
    });
    expect(create).toHaveBeenCalledTimes(2);
  });
});
