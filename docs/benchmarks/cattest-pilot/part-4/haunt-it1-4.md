The report says 0 issues, but I wouldn't read that as a clean bill of health for this run.

- **Quick View buttons:** The second tester said they look dead and no dialog opens.
- **Cuisine dropdown:** It ignores Escape. Its `aria-expanded` also reads as collapsed while the menu is open.
- **Card hover:** The hovered card enlarges over its neighbours, which looks overlapped.
- **Back to top:** The tester couldn't confirm it works.
- **Not in the report:** None of these came through as issues. The engine's end-of-session output was too large for the testers to read, so they couldn't tell which findings were confirmed on replay.
- **Coverage:** The report counts 15 of 91 controls exercised and 6 test cases (4 passed, 1 failed, 1 not run).
- **Planner's session:** Both testers said the planner's session wasn't found. They played cases of their own, not the planned ones.
- **Untested:** Medium and Hard difficulty, 2+ hours, Sort, filter plus search, and most of the second group's cases.

The first tester found no defects in the cases it ran. Those covered search, filters, deselect, Clear All and the no-results state.

Report: `.haunt-reports/2026-10-06-localhost-4104.md`

The testers' full end-of-session outputs are saved under the session's `tool-results/` directory. They may list the signals and replay results that never reached the report.
