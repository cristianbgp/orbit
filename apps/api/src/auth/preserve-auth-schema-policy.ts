const generatedMemberIndex = 'index("member_userId_idx").on(table.userId)';
const orbitMemberIndex = 'uniqueIndex("member_userId_unique").on(table.userId)';
const avatarColorCheckName = "user_avatar_color_hex_check";

function addNamedImport(
  source: string,
  moduleName: string,
  importedName: string,
) {
  return source.replace(
    new RegExp(
      `import \\{([^}]*)\\} from "${moduleName.replace("/", "\\/")}";`,
    ),
    (statement, fields: string) => {
      if (fields.split(",").some((field) => field.trim() === importedName)) {
        return statement;
      }
      return `import {${fields.trimEnd()}, ${importedName} } from "${moduleName}";`;
    },
  );
}

export function preserveAuthSchemaPolicy(source: string) {
  let preserved = source.replace(
    /timestamp\(("[^"]+")\)/g,
    "timestamp($1, { withTimezone: true })",
  );

  if (!preserved.includes(orbitMemberIndex)) {
    if (!preserved.includes(generatedMemberIndex)) {
      throw new Error("Generated member index was not found");
    }
    const withImport = addNamedImport(
      preserved,
      "drizzle-orm/pg-core",
      "uniqueIndex",
    );
    if (withImport === preserved) {
      throw new Error("Generated Drizzle import was not found");
    }
    preserved = withImport.replace(generatedMemberIndex, orbitMemberIndex);
  }

  if (
    preserved.includes('avatarColor: text("avatar_color")') &&
    !preserved.includes(avatarColorCheckName)
  ) {
    const withSqlImport = addNamedImport(preserved, "drizzle-orm", "sql");
    const withCheckImport = addNamedImport(
      withSqlImport,
      "drizzle-orm/pg-core",
      "check",
    );
    if (withCheckImport === preserved) {
      throw new Error("Generated Drizzle imports were not found");
    }

    const withAvatarColorCheck = withCheckImport.replace(
      /(export const user = pgTable\("user", \{[\s\S]*?\n\})\);/,
      (_match, userTable: string) =>
        `${userTable}, (table) => [\n  check("${avatarColorCheckName}", sql\`\${table.avatarColor} ~ '^#[0-9a-f]{6}$'\`),\n]);`,
    );
    if (withAvatarColorCheck === withCheckImport) {
      throw new Error("Generated user table was not found");
    }
    preserved = withAvatarColorCheck;
  }

  return preserved;
}

if (import.meta.main) {
  const schemaPath = "src/db/auth-schema.ts";
  const source = await Bun.file(schemaPath).text();
  await Bun.write(schemaPath, preserveAuthSchemaPolicy(source));
  console.log("Preserved Orbit auth schema policies.");
}
