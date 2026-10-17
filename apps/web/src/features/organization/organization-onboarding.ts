export const ORGANIZATION_NAME_ERROR =
  "El nombre debe tener entre 2 y 120 caracteres.";

const CREATE_ERROR = "No pudimos crear el estudio. Inténtalo nuevamente.";
const ACTIVATE_ERROR =
  "El estudio fue creado, pero no pudimos abrirlo. Inténtalo nuevamente.";

type OrganizationActionError = {
  code?: string;
  message?: string;
};

type OrganizationActionResult<T> = {
  data: T | null;
  error: OrganizationActionError | null;
};

export type OrganizationOnboardingActions = {
  create(input: {
    name: string;
    slug: string;
  }): Promise<OrganizationActionResult<{ id: string }>>;
  setActive(organizationId: string): Promise<OrganizationActionResult<unknown>>;
  refresh(): Promise<void>;
};

type CreateOrganizationInput = {
  name: string;
  nextSuffix?: () => string;
};

export class OrganizationOnboardingError extends Error {}

export function validateOrganizationName(name: string) {
  const length = name.trim().length;
  return length >= 2 && length <= 120 ? null : ORGANIZATION_NAME_ERROR;
}

export function createOrganizationSlug(name: string, suffix: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  const safeSuffix = suffix
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 6);

  return `${base || "organization"}-${safeSuffix}`;
}

export function createOrganizationSuffix() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 6).toLowerCase();
}

function isSlugCollision(error: OrganizationActionError | null) {
  return (
    error?.code === "ORGANIZATION_ALREADY_EXISTS" ||
    error?.code === "ORGANIZATION_SLUG_ALREADY_TAKEN"
  );
}

async function refreshSafely(refresh: () => Promise<void>) {
  try {
    await refresh();
  } catch {
    // Route guards can recover from stale client state without recreating data.
  }
}

export async function createAndActivateOrganization(
  { name, nextSuffix = createOrganizationSuffix }: CreateOrganizationInput,
  actions: OrganizationOnboardingActions,
) {
  const normalizedName = name.trim();
  const validationError = validateOrganizationName(normalizedName);

  if (validationError) {
    throw new OrganizationOnboardingError(validationError);
  }

  let created: { id: string } | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let result: OrganizationActionResult<{ id: string }>;

    try {
      result = await actions.create({
        name: normalizedName,
        slug: createOrganizationSlug(normalizedName, nextSuffix()),
      });
    } catch {
      throw new OrganizationOnboardingError(CREATE_ERROR);
    }

    if (result.data) {
      created = result.data;
      break;
    }

    if (!isSlugCollision(result.error) || attempt === 1) {
      throw new OrganizationOnboardingError(CREATE_ERROR);
    }
  }

  if (!created) {
    throw new OrganizationOnboardingError(CREATE_ERROR);
  }

  let activation = await actions.setActive(created.id).catch(() => ({
    data: null,
    error: { code: "ACTIVATION_FAILED" },
  }));

  if (activation.error) {
    await refreshSafely(actions.refresh);
    activation = await actions.setActive(created.id).catch(() => ({
      data: null,
      error: { code: "ACTIVATION_FAILED" },
    }));
  }

  if (activation.error) {
    throw new OrganizationOnboardingError(ACTIVATE_ERROR);
  }

  await refreshSafely(actions.refresh);
}
