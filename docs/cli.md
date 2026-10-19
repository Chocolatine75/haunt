# CLI Reference

## `/haunt:haunt-test`

Test a running web app the way a QA engineer would.

```
/haunt:haunt-test <url> [options]
```

### Arguments

| Argument | Description |
|---|---|
| `url` | Target URL — must be a running server (e.g. `http://localhost:3000`) |

### Options

| Option | Default | Description |
|---|---|---|
| `--spec <file>` | — | A file describing what the app is meant to do. The planner and the testers hold the app to it |
| `--hostile` | — | Also plan attack payloads (script injection, forged parameters). Only against an app you own |
| `--headed` | headless | Show the browser window in real time |
| `--steps <N>` | `40` | The budget of actions of each tester |
| `--no-sweep` | — | Do not press, once the testers are done, the buttons none of them pressed. By default the engine presses each once, outside forms, and reports those that do nothing or throw |
| `--routes <list>` | — | Comma-separated paths to test directly (e.g. `/signup,/pricing`), skipping DOM-based route discovery |
| `--compare <path>` | — | Diff this run against a previous report's `.md` path — annotates issues as new/still-present, lists resolved ones |
| `--email <email>` | — | Log in before testing (use with `--password`) |
| `--password <pass>` | — | Password to use for login |
| `--debug-auth` | — | Print each auth step verbosely — use when login fails silently |
| `--yes` | — | Skip the cost estimate confirmation prompt |
| `--verbose` | — | Print intermediate reasoning between steps |

> ⚠️ `--hostile` sends real XSS/SQLi payloads. Only target apps you own or have
> explicit permission to test — never a third party's production site.

### Examples

```bash
# Default — plan and test every area found, headless
/haunt:haunt-test http://localhost:3000

# Watch the browser in real time
/haunt:haunt-test http://localhost:3000 --headed

# Hold the app to a written description of what it should do
/haunt:haunt-test http://localhost:3000 --spec docs/requirements.md

# Test authenticated areas
/haunt:haunt-test http://localhost:3000 --email you@example.com --password secret

# Debug a login that silently fails
/haunt:haunt-test http://localhost:3000 --email you@example.com --password secret --debug-auth

# A shorter, cheaper run — 15 actions per tester instead of 40
/haunt:haunt-test http://localhost:3000 --steps 15

# Skip confirmation prompt (for scripted use)
/haunt:haunt-test http://localhost:3000 --yes

# Target specific routes instead of auto-discovering them
/haunt:haunt-test http://localhost:3000 --routes /signup,/pricing,/checkout

# Re-run after fixes and see what's resolved vs. still broken
/haunt:haunt-test http://localhost:3000 --compare .haunt-reports/2026-01-01-localhost-3000.md
```

### Output

Reports are saved to `.haunt-reports/YYYY-MM-DD-<target>.md` — structured markdown with a YAML frontmatter summary, ranked issues with their evidence, what was tested and what was not, and a "For Claude" section you can paste directly into a follow-up prompt.
