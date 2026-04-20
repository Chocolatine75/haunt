# CLI Reference

## `/haunt:haunt-test`

Run phantom user tests against a running web app.

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
| `--personas <list>` | `confused-beginner` | Comma-separated personas to run. Available: `confused-beginner`, `malicious-user`, `screen-reader-user` |
| `--headed` | headless | Show the browser window in real time |
| `--steps <N>` | `3` | Max navigation steps per area |
| `--email <email>` | — | Log in before testing (use with `--password`) |
| `--password <pass>` | — | Password to use for login |
| `--debug-auth` | — | Print each auth step verbosely — use when login fails silently |
| `--yes` | — | Skip the cost estimate confirmation prompt |
| `--verbose` | — | Print intermediate reasoning between steps |

### Examples

```bash
# Default — confused first-time user, headless
/haunt:haunt-test http://localhost:3000

# Watch the browser in real time
/haunt:haunt-test http://localhost:3000 --headed

# Run all three built-in personas
/haunt:haunt-test http://localhost:3000 --personas confused-beginner,malicious-user,screen-reader-user

# Test authenticated areas
/haunt:haunt-test http://localhost:3000 --email you@example.com --password secret

# Debug a login that silently fails
/haunt:haunt-test http://localhost:3000 --email you@example.com --password secret --debug-auth

# More thorough test — 8 steps per area instead of 3
/haunt:haunt-test http://localhost:3000 --steps 8

# Skip confirmation prompt (for scripted use)
/haunt:haunt-test http://localhost:3000 --yes
```

### Output

Reports are saved to `.haunt-reports/YYYY-MM-DD-<persona>.md` — structured markdown with a YAML frontmatter summary, ranked issues, per-issue fix recommendations, and a "For Claude" section you can paste directly into a follow-up prompt.

---

## Custom personas

Create a `.yaml` file anywhere in your project:

```yaml
name: Impatient Power User
description: Moves fast, skips steps, expects things to just work
system_prompt: |
  You move fast and skip everything that looks optional.
  Double-click buttons. Refresh mid-flow. Skip required fields and submit anyway.
  If something needs more than 2 steps, try to skip one.
  Report anything that breaks when you don't follow the expected sequence.
browser:
  headless: true
  viewport: { width: 1440, height: 900 }
scenarios:
  - name: Speed run
    goal: Break the experience by going too fast
    max_steps: 10
```

Then pass the path:

```bash
/haunt:haunt-test http://localhost:3000 --personas ./personas/power-user.yaml
```
