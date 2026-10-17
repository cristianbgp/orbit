import { describe, expect, test } from "vitest";
import { access, readFile } from "node:fs/promises";

type PackageManifest = {
  scripts: Record<string, string>;
};

async function readPackage(url: URL) {
  return JSON.parse(await readFile(url, "utf8")) as PackageManifest;
}

describe("help corpus build contract", () => {
  test("keeps the isolated API build independent from repository blueprint files", async () => {
    const apiPackage = await readPackage(
      new URL("../package.json", import.meta.url),
    );

    expect(apiPackage.scripts.build).toBe(
      "bun build src/index.ts --outdir dist --target bun",
    );
    await expect(
      access(
        new URL(
          "../src/help-assistant/blueprint-documents.generated.ts",
          import.meta.url,
        ),
      ),
    ).resolves.toBeUndefined();
  });

  test("regenerates the corpus before API builds launched from the repository root", async () => {
    const rootPackage = await readPackage(
      new URL("../../../package.json", import.meta.url),
    );

    expect(rootPackage.scripts["help:generate"]).toBe(
      "bun run --cwd apps/api help:generate",
    );
    expect(rootPackage.scripts.build).toMatch(/^bun run help:generate && /);
    expect(rootPackage.scripts["build-api"]).toBe(
      "bun run help:generate && bun run --cwd apps/api build",
    );
  });
});
