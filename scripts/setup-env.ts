import { dirname, join } from "node:path";

const root = process.cwd();
const glob = new Bun.Glob("**/.env.example");

for await (const relativePath of glob.scan({
  cwd: root,
  dot: true,
  onlyFiles: true,
})) {
  // Avoid generated and dependency directories
  if (
    relativePath
      .split("/")
      .some((part) =>
        ["node_modules", ".git", ".turbo", "dist", "build"].includes(part),
      )
  ) {
    continue;
  }

  const source = join(root, relativePath);
  const target = join(dirname(source), ".env");

  if (await Bun.file(target).exists()) {
    console.log(`Skipped: ${target} already exists`);
    continue;
  }

  await Bun.write(target, Bun.file(source));
  console.log(`Created: ${target}`);
}
