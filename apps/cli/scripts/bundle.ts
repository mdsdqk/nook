#!/usr/bin/env bun
/**
 * Bundle CLI entrypoints for npm publish (package name: nook).
 * Output lands in dist/ and is not committed (see root .gitignore).
 */
import { mkdir, rm, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");
const defaultSpikyUrl = "https://spiky.nook.com";

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const define = {
  __NOOK_DEFAULT_SPIKY_URL__: JSON.stringify(defaultSpikyUrl),
};

const entries = [
  { src: "src/nook.ts", name: "nook.js" },
  { src: "src/index.ts", name: "statement.js" },
  { src: "src/wealth.ts", name: "wealth.js" },
] as const;

for (const entry of entries) {
  const result = await Bun.build({
    entrypoints: [join(root, entry.src)],
    outdir: dist,
    naming: entry.name,
    target: "node",
    format: "esm",
    sourcemap: "external",
    define,
  });

  if (!result.success) {
    console.error(`Bundle failed for ${entry.src}:`);
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  const outPath = join(dist, entry.name);
  const code = await Bun.file(outPath).text();
  const withShebang = code.startsWith("#!")
    ? code
    : `#!/usr/bin/env node\n${code}`;
  await writeFile(outPath, withShebang, "utf8");
  await chmod(outPath, 0o755);
  console.log(`Wrote dist/${entry.name}`);
}

const publishPkg = {
  name: "nook",
  version: "0.1.0",
  description:
    "Nook CLI - bank statement parsing, wealth import, and Convex auth",
  type: "module",
  bin: {
    nook: "./nook.js",
    statement: "./statement.js",
    wealth: "./wealth.js",
  },
  files: ["*.js", "*.js.map", "README.md"],
  engines: {
    node: ">=20",
  },
  license: "UNLICENSED",
  repository: {
    type: "git",
    url: "git+https://github.com/mdsdqk/nook.git",
  },
  keywords: ["nook", "bank-statement", "cli", "finance"],
};

await writeFile(
  join(dist, "package.json"),
  `${JSON.stringify(publishPkg, null, 2)}\n`,
  "utf8",
);

await writeFile(
  join(dist, "README.md"),
  `# nook

CLI for Nook bank-statement parsing and Convex auth.

\`\`\`sh
bunx nook statement detect ./statement.pdf
bunx nook statement auth login
npx nook statement auth login --spiky-url https://spiky.nook.com
\`\`\`

Default Spiky origin for login is \`https://spiky.nook.com\`. Override with \`NOOK_SPIKY_URL\` or \`--spiky-url\`.

See https://github.com/mdsdqk/nook/blob/main/docs/tech/deploy.md
`,
  "utf8",
);

console.log("Publish package ready in apps/cli/dist/");
