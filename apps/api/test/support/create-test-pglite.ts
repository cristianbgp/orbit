import { PGlite } from "@electric-sql/pglite";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

export function createTestPGlite() {
  return new PGlite({ extensions: { unaccent } });
}
