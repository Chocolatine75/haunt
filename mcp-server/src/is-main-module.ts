import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// True when the module at moduleUrl is the one Node was invoked with directly
// (`node file.js`), false when it was imported (e.g. by a test). Resolves
// symlinks on both sides before comparing — a raw
// `moduleUrl === file://${process.argv[1]}` string comparison breaks under any
// symlink in the invocation path (e.g. macOS's /tmp -> /private/tmp):
// import.meta.url resolves through it, argv[1] doesn't, so they silently never
// match and the caller's entrypoint never runs — exit 0, no output, no error,
// the worst failure mode for a CI tool. Found and fixed for cli/headless.ts in
// commit 0929899; shared here so benchmark/run.ts doesn't reintroduce it.
export function isMainModule(moduleUrl: string): boolean {
  try {
    return (
      realpathSync(fileURLToPath(moduleUrl)) === realpathSync(process.argv[1])
    );
  } catch {
    return false;
  }
}
