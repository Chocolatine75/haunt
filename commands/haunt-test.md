# /haunt-test

Run a phantom user test session against a running web application.

## Usage

/haunt-test <url> [--personas <list>] [--headed]

## Arguments

- `url` — Target URL (required). Must be a running server, e.g. http://localhost:3000
- `--personas` — Comma-separated persona names (default: confused-beginner)
  Available: confused-beginner, malicious-user, screen-reader-user
- `--headed` — Show the browser window in real time (default: headless)

## Examples

/haunt-test http://localhost:3000
/haunt-test http://localhost:3000 --personas malicious-user,screen-reader-user
/haunt-test http://localhost:3000 --headed

## Behavior

When this command is invoked:

1. Delegate immediately to the haunt-orchestrator agent to run the session.
   Pass the parsed url, personas list, and headless flag to the agent.
   The orchestrator prints its own header — do not print anything before delegating.

## First run note

On first run, the haunt MCP server installs Chromium (~150MB) in the background.
If tools are unavailable, print:
```
⏳ haunt is installing Chromium (first run, ~2 min).
   Restart Claude Code once ready and run the command again.
```
Do NOT investigate or debug. Just print that message and stop.
