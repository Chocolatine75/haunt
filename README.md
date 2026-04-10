# Haunt

Synthetic phantom users that test your localhost app while you code.

## What it does

Haunt spawns AI-driven phantom agents that navigate your web app as real users would:
a confused beginner, a malicious attacker, a screen reader user.
Each phantom explores your app, captures UX issues, errors, and accessibility problems,
and produces an actionable Markdown report.

## Install

```bash
/plugin install github:<your-username>/haunt
```

Install the Playwright browser (one-time setup):

```bash
npx playwright install chromium
```

## Requirements

- Claude Code with `ANTHROPIC_API_KEY` set
- Node.js 18+

## Usage

```bash
# Test with the default persona (confused-beginner)
/haunt-test http://localhost:3000

# Test with multiple personas
/haunt-test http://localhost:3000 --personas malicious-user,screen-reader-user

# Watch the phantom navigate in real time
/haunt-test http://localhost:3000 --headed
```

Reports are saved to `.haunt-reports/`.

## Built-in personas

| Persona | What it tests |
|---|---|
| `confused-beginner` | UX clarity, onboarding friction, confusing labels |
| `malicious-user` | XSS, SQL injection, auth bypasses, exposed data |
| `screen-reader-user` | Keyboard navigation, ARIA labels, focus management |

## Custom personas

Add a YAML file to your project and pass its path:

```bash
/haunt-test http://localhost:3000 --personas ./personas/my-persona.yaml
```

See `personas/confused-beginner.yaml` for the format.

## License

MIT
