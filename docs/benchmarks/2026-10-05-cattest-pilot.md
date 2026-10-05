# CATTest pilot, 5 October 2026

A first look at where haunt stands on a published benchmark, before
measuring anything properly. Three applications, one run per tool: enough to
see what each tool does, not enough to rank them.

## What was run

[CATTest](https://huggingface.co/datasets/Aisaka013/CATTest) is 102
AI-generated web applications with 190 bugs annotated by hand (paper:
[Framework and Benchmark for Code-Driven Agentic Testing in Web
Development](https://arxiv.org/abs/2609.00081)). Applications 2, 4 and 7 were
taken because they are single static pages: a photo gallery with a lightbox,
a recipe catalogue with filters, a recipe search.

Four tools, all through Claude Code headless with `--model sonnet`, each
given the URL and nothing else (no project documentation, which CATTest's
own agent does get):

| Tool | How |
|---|---|
| haunt v1 | `master` at `76f48ff`, `/haunt:haunt-test <url> --yes` |
| haunt v2 | `v2` at `d8b27fe`, same command |
| Claude + Playwright MCP | `@playwright/mcp`, headless, with [`qa-prompt.txt`](cattest-pilot/qa-prompt.txt) |
| Claude in Chrome | `claude --chrome`, same prompt |

[`cattest-pilot/run.sh`](cattest-pilot/run.sh) is the runner; the text each
run ended with, and haunt's reports, are in
[`cattest-pilot/outputs/`](cattest-pilot/outputs/).

## Results

Matched against the annotations by reading them, not by a judge model.

| Annotated bug | haunt v1 | haunt v2 | Playwright MCP | Chrome |
|---|---|---|---|---|
| 2: with the lightbox open, Tab reaches the page behind | no | no | no | no |
| 4: recipe cards jump on hover | no | no | no | no |
| 4: star ratings always show five | no | no | no | no |
| 7: "Titles only" also matches descriptions | no | no | yes | yes |
| **Found** | **0 / 4** | **0 / 4** | **1 / 4** | **1 / 4** |
| Problems reported in all | 6 | 1 | 8 | 7 |

| Per application | haunt v1 | haunt v2 | Playwright MCP | Chrome |
|---|---|---|---|---|
| Cost (2, 4, 7) | $0.24, $0.22, $0.22 | $0.24, $0.32, $0.30 | $0.23, $0.73, $0.31 | $0.33, $0.55, $0.30 |
| Time | 40 s, 41 s, 71 s | 44 s, 36 s, 36 s | 47 s, 184 s, 71 s | 51 s, 131 s, 148 s |
| Turns | 19, 18, 15 | 14, 15, 13 | 31, 59, 22 | 34, 55, 19 |

What the two Claude setups reported beyond the annotations counts as false
positives under CATTest's protocol. Some of it may be real and unannotated
(filters combining as "or", a "Quick view" button that does nothing); none
of it was checked.

## What it shows

- haunt stops after three steps where the plain setups take twenty to sixty
  turns.
- The `confused-beginner` persona types junk and a script tag; the plain
  setups type `chicken` and `garlic` and try each control. On application 7
  that is the whole difference.
- Claude read the exact list of result titles with a script and compared it
  with what the switch promised. Haunt's tester has no way to state that.
- haunt v2 saw the "or" filters on application 4 and wrote that it was "not
  a defect I could check": the rule that every issue needs a claim the
  engine can replay drops what it cannot express.
- haunt v1 reported the static server's 404 page and its own trouble finding
  a field; haunt v2 reported one contrast failure, which CATTest leaves out
  of scope.
- haunt v1 as shipped does not start on macOS: it looks for Chromium under
  `~/.cache`, and needed its browser installed by hand.

Part 4 ([`v3/part-4-tester.md`](../v3/part-4-tester.md)) is written from
this.
