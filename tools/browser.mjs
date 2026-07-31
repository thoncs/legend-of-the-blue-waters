import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Reuse whatever Chromium the environment already has. */
export function resolveExecutable() {
  if (process.env.SMOKE_CHROME) return process.env.SMOKE_CHROME;
  const rootDir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (rootDir && existsSync(rootDir)) {
    const dir = readdirSync(rootDir).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
    if (dir) {
      const candidate = join(rootDir, dir, 'chrome-linux', 'chrome');
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

export const BASE = process.env.SMOKE_URL ?? 'http://localhost:8080/';
