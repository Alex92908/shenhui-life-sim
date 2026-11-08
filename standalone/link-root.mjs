// client/ and server/ live outside standalone/, so bare imports there
// ("react", "three", "drizzle-orm", "@hatch/space-sdk", …) resolve from the
// repo root. Point <repo>/node_modules at standalone/node_modules so both
// Vite and Node find them. Never touches a real (non-symlink) node_modules,
// e.g. one created by Muse's own `bun install`.
import { existsSync, lstatSync, readlinkSync, symlinkSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "node_modules");
const link = join(here, "..", "node_modules");

if (existsSync(link) || lstatSync(link, { throwIfNoEntry: false })) {
  const st = lstatSync(link);
  if (st.isSymbolicLink() && readlinkSync(link) === relative(dirname(link), target)) process.exit(0);
  console.warn(`[link-root] ${link} already exists and is not our symlink; leaving it alone.`);
  process.exit(0);
}
symlinkSync(relative(dirname(link), target), link, "dir");
console.log(`[link-root] linked ${link} -> standalone/node_modules`);
