# Haunt — Design Spec
Date: 2026-04-10

## Vision

**haunt** is an open-source Claude Code plugin that simulates LLM-driven synthetic users to automatically test web applications during development. Each "phantom" is an AI agent with a distinct persona that navigates the real application through a headless browser and reports UX bugs, friction points, accessibility issues, and security flaws.

Target users: developers who want to test their localhost app while coding — not designers or PMs testing Figma mockups.

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Plugin format | Claude Code Plugin (Markdown + YAML) | Native format, zero build step for plugin layer |
| Browser engine | Playwright via Stagehand | Battle-tested LLM+browser, handles hybrid mode out of the box |
| Navigation LLM | claude-3-5-haiku (Anthropic SDK) | Cost-efficient, fast, sufficient for navigation tasks |
| API key | User's own ANTHROPIC_API_KEY | Already set for Claude Code users, zero extra config |
| MCP server language | TypeScript (Node.js) | Standard for MCP servers |
| MCP server distribution | Pre-compiled dist/server.js committed to git | Enables true /plugin install experience |
| Personas format | YAML | Human-readable, supports comments, version-controllable |
| Navigation mode | Hybrid: accessibility tree + screenshot fallback | Reliability on complex UIs without excessive token cost |
| License | MIT | Free and open source |

---

## Architecture

```
/plugin install github:<user>/haunt
        |
        v
Claude Code reads plugin.json + .mcp.json
        |
        |-- Launches mcp-server/dist/server.js (stdio)
        |       |
        |       |-- Manages Playwright sessions via Stagehand
        |       |-- Makes Haiku 3.5 API calls (same Node.js process)
        |       +-- Reads ANTHROPIC_API_KEY from environment
        |
        +-- Loads commands / agents / skills from plugin

User types: /haunt-test http://localhost:3000

        haunt-orchestrator agent (Claude Code)
                |
                |-- haunt_spawn      -> MCP server opens browser + inits Haiku session
                |-- haunt_navigate   -> Haiku decides action, Stagehand executes (loop)
                |-- haunt_capture_state -> screenshots, logs, DOM on issue detection
                +-- haunt_end_session -> structured JSON report
                        |
                        v
                haunt-reporter agent aggregates -> final Markdown report
```

**Internal session model:**
Each phantom session is a `Map<sessionId, { stagehand, haiku_messages }>` entry in the MCP server process. No database, no temp files. Sessions are concurrent by design (Phase 3 exposes parallel execution to users).

**Haiku navigation loop:**
```
1. Send to Haiku: current URL + title + accessibility tree
2. Haiku responds: { action, target, value, thought }
3. Stagehand executes the action
4. If Haiku signals confusion -> switch to screenshot mode (hybrid fallback)
5. Capture console errors + network errors at each step
6. Loop until: scenario complete | step timeout | global timeout | loop detected
```

---

## Plugin Structure

```
haunt/
|-- plugin.json                    # Claude Code plugin manifest
|-- .mcp.json                      # MCP config -> points to dist/server.js
|
|-- commands/
|   |-- haunt-test.md            # /haunt-test <url> [--personas] [--headed]
|   |-- haunt-create.md          # /haunt-create <name>
|   +-- haunt-report.md          # /haunt-report [--latest] [--diff]
|
|-- agents/
|   |-- haunt-orchestrator.md    # Coordinates sessions, calls MCP tools
|   +-- haunt-reporter.md        # Aggregates JSON reports -> Markdown
|
|-- personas/                      # Built-in personas (YAML, version-controllable)
|   |-- confused-beginner.yaml
|   |-- malicious-user.yaml
|   +-- screen-reader-user.yaml
|
|-- mcp-server/
|   |-- src/                       # TypeScript source
|   |-- dist/
|   |   +-- server.js              # Pre-compiled bundle (committed to git)
|   +-- package.json
|
+-- .haunt-reports/              # Generated reports (gitignored)
```

---

## MCP Tools

### `haunt_spawn`
Creates a browser session and initializes a Haiku conversation with the persona's system prompt.
```typescript
input:  { persona: string, target_url: string, headless?: boolean, timeout?: number }
output: { session_id: string, persona_summary: string }
```

### `haunt_navigate`
Sends current page state to Haiku, executes the returned action via Stagehand, captures errors.
```typescript
input:  { session_id: string, think_aloud?: boolean }
output: { success: boolean, page_url: string, thought?: string, console_errors: string[], network_errors: string[], screenshot_path?: string }
```

### `haunt_capture_state`
Captures a full snapshot of the current page (called when an issue is detected).
```typescript
input:  { session_id: string, include_screenshot?: boolean, include_dom?: boolean }
output: { url: string, title: string, dom_snapshot?: string, accessibility_tree?: string, screenshot_path?: string }
```

### `haunt_end_session`
Closes the browser session and returns the structured individual report.
```typescript
input:  { session_id: string }
output: { session_id: string, persona: string, duration_seconds: number, pages_visited: number, issues_found: Issue[], overall_impression: string }
```

---

## Terminal Output

Clean, no emojis — consistent with Claude Code plugin conventions:

```
haunt v0.1.0
──────────────────────────────────────────

Spawning phantom: confused-beginner
  Browser: headless chromium
  Target:  http://localhost:3000

[confused-beginner] Navigating to http://localhost:3000
[confused-beginner] "I see a homepage with a big hero section..."
[confused-beginner] Click: "Get Started"
[confused-beginner] "The page changed but I don't know what to do next..."
[confused-beginner] Console error: TypeError: Cannot read property 'map'
[confused-beginner] Issue detected: No error message shown after failed action
[confused-beginner] Screenshot saved
[confused-beginner] Click: "Sign Up"
[confused-beginner] Form submitted successfully

──────────────────────────────────────────
Session complete  1m 52s  12 steps
Issues: 1 critical  1 major  1 minor
Report: .haunt-reports/2026-04-10-confused-beginner.md
```

---

## MVP Scope — v0.1.0

### In

- Working `/plugin install github:<user>/haunt`
- MCP server with Stagehand + Haiku 3.5
- 3 built-in personas: confused-beginner, malicious-user, screen-reader-user
- MCP tools: `haunt_spawn`, `haunt_navigate`, `haunt_capture_state`, `haunt_end_session`
- `/haunt-test <url> [--personas] [--headed]` command
- Basic Markdown report in `.haunt-reports/`
- Clean terminal output with step-by-step progress
- README: installation in under 2 minutes

### Out (v0.2.0+)

- `haunt_audit_accessibility` (axe-core)
- Scoring and multi-persona aggregation
- `/haunt-create` guided persona creation
- `/haunt-report --diff` comparison
- Parallel multi-phantom execution
- CI/CD integration

### MVP success criteria

A developer installs the plugin, runs `/haunt-test localhost:3000 --personas confused-beginner`, watches the phantom navigate their app step by step in the terminal, and receives a report with real actionable issues. That's it.

---

## Error Handling

### Startup errors
```
Error: Playwright not found
Run: npx playwright install chromium
Then retry: /haunt-test http://localhost:3000

Error: ANTHROPIC_API_KEY not set
Set it in your environment and restart Claude Code

Error: http://localhost:3000 is not reachable
Make sure your dev server is running
```

### Navigation errors
```
# Step timeout (10s) -> phantom skips and continues
[confused-beginner] Step timeout on "checkout modal" -- skipping

# Navigation loop (same URL 3x) -> session ends cleanly
[confused-beginner] Navigation loop detected -- ending session early

# Global timeout (5min) -> partial report generated
[confused-beginner] Session timeout -- generating partial report
```

### API errors
```
# Rate limit -> retry with backoff
[confused-beginner] API rate limit -- retrying in 5s

# Malformed Haiku response -> screenshot fallback
[confused-beginner] Unexpected response -- switching to screenshot mode
```

**Principle:** always produce something useful. A partial report is better than a crash.

---

## Roadmap

### v0.1.0 — MVP
Working end-to-end: install -> run -> report.

### v0.2.0 — Core Features
All 8 personas, accessibility audits (axe-core), report comparison, `/haunt-create`, scoring.

### v0.3.0 — Advanced
Parallel execution, PostToolUse hook (auto-trigger on frontend file changes), CI/CD GitHub Action, community persona registry, `/haunt-report --fix`.
