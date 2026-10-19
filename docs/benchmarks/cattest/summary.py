#!/usr/bin/env python3
"""summary.py <label>: one table of a run of the bench, from runs/<label>/.

Writes runs/<label>/summary.md: per application the cost, the time, the
actions the testers used, cases, times held back, coverage, what the tools
returned in characters, and the largest context a tester reached. The bugs
found are not counted here: matching a report to CATTest's annotations is
read by hand, into runs/<label>/score.md.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
label = sys.argv[1]
root = os.path.join(HERE, 'runs', label)

def load(path):
    try:
        return json.load(open(path))
    except Exception:
        return {}

rows, total = [], {'cost': 0.0}
for app in sorted(os.listdir(root), key=lambda x: int(x) if x.isdigit() else 1e9):
    if not app.isdigit():
        continue
    r = load(os.path.join(root, app, 'result.json'))
    m = load(os.path.join(root, app, 'metrics.json'))
    testers = [x for x in m.get('agents', []) if 'tester' in x['role']]
    steps = sum(s.get('steps', 0) for s in m.get('sessions', {}).values())
    cov = (m.get('coverage') or {})
    controls = cov.get('controls') or {}
    cases = cov.get('cases') or {}
    def tool(name):
        return sum(t['tools'].get(name, {}).get('chars', 0) for t in m.get('agents', []))
    cost = r.get('cost_usd') or 0
    total['cost'] += cost
    rows.append([
        app, f'{cost:.2f}', str(r.get('seconds', '')),
        str(steps), f'{cases.get("planned", 0)}/{cases.get("run", 0)}',
        str(m.get('held_back', 0)),
        f'{controls.get("exercised", 0)}/{controls.get("listed", 0)}',
        str(sum(t['tool_chars_total'] for t in testers)),
        str(tool('haunt_plan')), str(tool('haunt_capture_state')), str(tool('haunt_act')),
        str(sum(t['images'] for t in testers)),
        str(max((t['max_context_tokens'] for t in testers), default=0)),
        str(sum(t['input_tokens_total'] for t in testers)),
        'error' if r.get('is_error') else '',
    ])

head = ['App', 'Cost $', 'Seconds', 'Actions', 'Cases planned/run', 'Held back',
        'Controls exercised/listed', 'Tool chars (testers)', 'plan chars',
        'capture chars', 'act chars', 'Images', 'Max context (tokens)',
        'Input tokens (testers)', '']
lines = ['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)]
lines += ['| ' + ' | '.join(row) + ' |' for row in rows]
lines.append(f'\nTotal cost: ${total["cost"]:.2f}')
first = load(os.path.join(root, rows[0][0], 'result.json')) if rows else {}
text = f'# Run "{label}"\n\nhaunt {first.get("haunt", "?")}, model {first.get("model", "?")}, {first.get("date", "")}.\n\n' + '\n'.join(lines) + '\n'
open(os.path.join(root, 'summary.md'), 'w').write(text)
print(text)
