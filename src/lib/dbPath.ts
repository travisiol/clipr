import { accessSync, constants, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Where the SQLite file lives. Three answers, in order:
 *
 *   1. `CLIPR_DB_PATH` — you said so (a mounted disk, a named volume).
 *   2. `./data/clipr.db` — a machine you own: the folder is created and
 *      the file persists across restarts.
 *   3. `<tmpdir>/clipr/clipr.db` — a read-only deployment (Vercel, Lambda:
 *      `/var/task` cannot be written to, only `/tmp` can). The site runs,
 *      but this filesystem is *ephemeral*: every cold start is a fresh,
 *      re-seeded database and separate instances do not share it. Fine to
 *      show the site; not a place to keep real submissions.
 *
 * The third case used to be a crash: `mkdirSync` on a read-only root
 * throws EROFS before the first page renders, and every route that touches
 * the database answers 500.
 */
export type DbPlacement = {
  path: string;
  /** True when the file will not survive a cold start. */
  ephemeral: boolean;
  /** Why the fallback was taken, for the log and the ops screen. */
  reason: string | null;
};

function writable(dir: string): boolean {
  try {
    mkdirSync(/* turbopackIgnore: true */ dir, { recursive: true });
    accessSync(/* turbopackIgnore: true */ dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function pickDbPath(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
  tmp: string = tmpdir(),
): DbPlacement {
  const explicit = env.CLIPR_DB_PATH?.trim();
  if (explicit) {
    return { path: resolve(/* turbopackIgnore: true */ explicit), ephemeral: false, reason: null };
  }
  const dataDir = join(cwd, "data");
  if (writable(dataDir)) {
    return { path: join(dataDir, "clipr.db"), ephemeral: false, reason: null };
  }
  const fallback = join(tmp, "clipr");
  mkdirSync(/* turbopackIgnore: true */ fallback, { recursive: true });
  return {
    path: join(fallback, "clipr.db"),
    ephemeral: true,
    reason: `${dataDir} is not writable (read-only deployment)`,
  };
}
