#!/usr/bin/env python3
"""fetch.py [id ...]: download CATTest applications and their annotations.

Into $HAUNT_BENCH/cattest (default ~/.cache/haunt-bench/cattest), which
outlives a session's scratch directory: the measures of 6 October lost their
applications, and a run nobody could read again, when theirs was emptied.
node_modules and builds are skipped; the ids default to apps.json.
"""
import json, os, sys, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BENCH = os.path.join(os.environ.get('HAUNT_BENCH', os.path.expanduser('~/.cache/haunt-bench')), 'cattest')
HF = 'https://huggingface.co'
REPO = 'datasets/Aisaka013/CATTest'

def get(url):
    return urllib.request.urlopen(url, timeout=120)

def tree(path):
    out = []
    listing = json.load(get(f'{HF}/api/{REPO}/tree/main/{urllib.parse.quote(path)}'))
    for entry in listing:
        name = entry['path'].split('/')[-1]
        if name in ('node_modules', 'dist', '.git'):
            continue
        out += tree(entry['path']) if entry['type'] == 'directory' else [entry['path']]
    return out

def main():
    ids = sys.argv[1:] or [str(i) for i in json.load(open(os.path.join(HERE, 'apps.json')))['apps']]
    os.makedirs(BENCH, exist_ok=True)
    with open(os.path.join(BENCH, 'with_bugs.jsonl'), 'wb') as f:
        f.write(get(f'{HF}/{REPO}/resolve/main/with_bugs.jsonl').read())
    for app in ids:
        files = tree(app)
        for path in files:
            target = os.path.join(BENCH, path)
            if os.path.exists(target):
                continue
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, 'wb') as f:
                f.write(get(f'{HF}/{REPO}/resolve/main/{urllib.parse.quote(path)}').read())
        static = not os.path.exists(os.path.join(BENCH, app, 'src', 'package.json'))
        print(f'{app}: {len(files)} files{"" if static else " (needs npm: not served by serve.sh)"}')

main()
