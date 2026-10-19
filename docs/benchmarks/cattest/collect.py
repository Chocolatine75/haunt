#!/usr/bin/env python3
"""collect.py <work> <out>: keep what a run of /haunt-test left, to compare.

From the run's directory (claude.json, .haunt-reports/) and Claude Code's
transcripts of it (~/.claude/projects/<the directory, encoded>/), writes in
<out>:

  result.json   cost, turns, time, model, haunt's commit, what it printed
  report.md     haunt's report, and report.json its sidecar
  metrics.json  per agent: calls per tool, characters each tool returned,
                context per turn in tokens; per haunt session: actions
                used, cases, times held back, actions refused
  trace.txt     every call and the start of every answer, in order

Evidence bundles and screenshots stay in the run's directory: they are
large, and the report names them.
"""
import argparse, glob, json, os, re, shutil, subprocess, time

p = argparse.ArgumentParser()
p.add_argument('work'); p.add_argument('out')
p.add_argument('--app', required=True); p.add_argument('--model', required=True)
p.add_argument('--seconds', type=int, default=0); p.add_argument('--haunt', default='')
a = p.parse_args()

def load(path):
    try:
        return json.load(open(path))
    except Exception:
        return {}

claude = load(os.path.join(a.work, 'claude.json'))
commit = ''
if a.haunt:
    commit = subprocess.run(['git', '-C', a.haunt, 'rev-parse', '--short', 'HEAD'],
                            capture_output=True, text=True).stdout.strip()
    branch = subprocess.run(['git', '-C', a.haunt, 'rev-parse', '--abbrev-ref', 'HEAD'],
                            capture_output=True, text=True).stdout.strip()
    commit = f'{branch}@{commit}'

result = {
    'app': int(a.app), 'model': a.model, 'haunt': commit,
    'date': time.strftime('%Y-%m-%d %H:%M'),
    'seconds': a.seconds,
    'cost_usd': claude.get('total_cost_usd'),
    'turns': claude.get('num_turns'),
    'is_error': claude.get('is_error'),
    'model_usage': claude.get('modelUsage'),
    'printed': claude.get('result'),
}

reports = sorted(glob.glob(os.path.join(a.work, '.haunt-reports', '*.md')), key=os.path.getmtime)
if reports:
    shutil.copy(reports[-1], os.path.join(a.out, 'report.md'))
    sidecar = reports[-1][:-3] + '.json'
    if os.path.exists(sidecar):
        shutil.copy(sidecar, os.path.join(a.out, 'report.json'))

# Claude Code names a project's directory after its path, every character
# that is not a letter or a digit turned into "-".
project = os.path.expanduser('~/.claude/projects/' + re.sub(r'[^A-Za-z0-9]', '-', os.path.realpath(a.work)))
sid = claude.get('session_id', '')
files = []
if sid and os.path.exists(os.path.join(project, sid + '.jsonl')):
    files.append(('orchestrator', os.path.join(project, sid + '.jsonl')))
    for path in sorted(glob.glob(os.path.join(project, sid, 'subagents', '*.jsonl')), key=os.path.getmtime):
        meta = load(path[:-6] + '.meta.json')
        files.append((meta.get('agentType', 'agent'), path))

def text_of(content):
    if isinstance(content, list):
        return ''.join(c.get('text', '') if isinstance(c, dict) else str(c) for c in content)
    return str(content or '')

agents, trace, sessions = [], [], {}
for role, path in files:
    names, seen = {}, set()
    agent = {'role': role, 'tools': {}, 'context_tokens': [], 'output_tokens': 0, 'images': 0}
    trace.append(f'== {role}')
    for line in open(path):
        try:
            m = json.loads(line)
        except Exception:
            continue
        msg = m.get('message') or {}
        usage = msg.get('usage')
        if m.get('type') == 'assistant' and usage and msg.get('id') not in seen:
            seen.add(msg.get('id'))
            agent['context_tokens'].append(usage.get('input_tokens', 0)
                                           + usage.get('cache_creation_input_tokens', 0)
                                           + usage.get('cache_read_input_tokens', 0))
            agent['output_tokens'] += usage.get('output_tokens', 0)
        content = msg.get('content')
        if not isinstance(content, list):
            continue
        for c in content:
            kind = c.get('type')
            if kind == 'tool_use':
                name = c['name'].split('__')[-1]
                names[c['id']] = name
                tool = agent['tools'].setdefault(name, {'calls': 0, 'chars': 0, 'max_chars': 0, 'errors': 0})
                tool['calls'] += 1
                trace.append(f'  > {name} {json.dumps(c["input"], ensure_ascii=False)[:400]}')
            elif kind == 'tool_result':
                name = names.get(c.get('tool_use_id'), '?')
                body = c.get('content')
                if isinstance(body, list):
                    agent['images'] += sum(1 for x in body if isinstance(x, dict) and x.get('type') == 'image')
                text = text_of(body)
                tool = agent['tools'].setdefault(name, {'calls': 0, 'chars': 0, 'max_chars': 0, 'errors': 0})
                tool['chars'] += len(text)
                tool['max_chars'] = max(tool['max_chars'], len(text))
                if c.get('is_error') or text.startswith('Error'):
                    tool['errors'] += 1
                trace.append(f'    < {text[:300]}'.replace('\n', ' '))
                # What the engine says of a session, read from its answers.
                found = re.search(r'"session_id":"([0-9a-f-]{36})","step_count":(\d+)', text)
                if found:
                    sessions.setdefault(found.group(1), {})['steps'] = int(found.group(2))
                held = re.match(r'\{"ended":false', text)
                if held:
                    sessions.setdefault('_held', {}).setdefault('times', 0)
                    sessions['_held']['times'] += 1
                if 'no test case is registered' in text:
                    sessions.setdefault('_refused', {}).setdefault('times', 0)
                    sessions['_refused']['times'] += 1
            elif kind == 'text' and m.get('type') == 'assistant':
                trace.append(f'  says {c["text"][:300]}'.replace('\n', ' '))
    tokens = agent['context_tokens']
    agent['turns'] = len(tokens)
    agent['max_context_tokens'] = max(tokens) if tokens else 0
    agent['input_tokens_total'] = sum(tokens)
    agent['tool_chars_total'] = sum(t['chars'] for t in agent['tools'].values())
    agents.append(agent)

report = load(os.path.join(a.out, 'report.json'))
metrics = {
    'agents': agents,
    'held_back': sessions.pop('_held', {}).get('times', 0),
    'act_refused_without_case': sessions.pop('_refused', {}).get('times', 0),
    'sessions': sessions,
    'coverage': report.get('coverage'),
    'transcripts_found': bool(files),
}
# A transcript can hold half of an emoji's surrogate pair, which UTF-8
# refuses: escaped in JSON, replaced in the trace.
json.dump(result, open(os.path.join(a.out, 'result.json'), 'w'), indent=2)
json.dump(metrics, open(os.path.join(a.out, 'metrics.json'), 'w'), indent=2)
open(os.path.join(a.out, 'trace.txt'), 'w', errors='replace').write('\n'.join(trace) + '\n')
