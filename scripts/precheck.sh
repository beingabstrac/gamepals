#!/bin/bash
# The checks that can run without node_modules, for the mistakes CI keeps catching:
# duplicate rules exports, duplicate art functions or tile keys, imports nothing uses, names
# the client imports from the rules barrel that it never exports,
# games missing from a test list, and the rules tests. Run before pushing.
# Usage: scripts/precheck.sh [rules test paths ...]
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
fail=0

echo "== two modules putting the same name into the rules barrel"
REPO="$REPO" python3 - <<'DUPEEOF' || fail=1
import os, re, sys
repo = os.environ['REPO']
rules = os.path.join(repo, 'packages/rules/src')

def resolve(base, rel):
    path = os.path.normpath(os.path.join(os.path.dirname(base), rel))
    for candidate in (path + '.ts', os.path.join(path, 'index.ts')):
        if os.path.isfile(candidate): return candidate
    return None

def names_in(path, seen=None):
    """Every name this module puts into a star import of it, re-exports included."""
    seen = seen if seen is not None else set()
    if not path or path in seen: return set()
    seen.add(path)
    text = open(path).read()
    out = set()
    for star in re.finditer(r"export \* from '([^']+)';", text):
        out |= names_in(resolve(path, star.group(1)), seen)
    for listed in re.finditer(r"export (?:type )?\{([^}]*)\}", text):
        for part in listed.group(1).split(','):
            part = part.strip().replace('type ', '')
            if ' as ' in part: part = part.split(' as ')[-1].strip()
            if part: out.add(part)
    for named in re.finditer(r"^export (?:declare )?(?:const|function|class|type|interface|enum) ([A-Za-z0-9_]+)", text, re.M):
        out.add(named.group(1))
    return out

index = os.path.join(rules, 'index.ts')
# A name is only a clash when two different entries of the barrel both provide it: a module
# re-exporting its own neighbour is how a game folder is meant to be put together.
owners = {}
for star in re.finditer(r"export \* from '([^']+)';", open(index).read()):
    entry = star.group(1)
    for name in names_in(resolve(index, entry)):
        owners.setdefault(name, []).append(entry)

clashes = {name: where for name, where in owners.items() if len(set(where)) > 1}
if clashes:
    print('  CLASH: a star export of the barrel would drop these')
    for name, where in sorted(clashes.items()): print('   ', name, 'from', ', '.join(sorted(set(where))))
    sys.exit(1)
print('  ok:', len(owners), 'names, no two entries claiming one')
DUPEEOF

echo "== duplicate art functions and tile map keys"
REPO="$REPO" node -e '
const fs = require("fs");
const s = fs.readFileSync(process.env.REPO + "/apps/client/src/components/Art.tsx", "utf8");
const names = [...s.matchAll(/^function ([A-Za-z]+Art)/gm)].map((m) => m[1]);
const keys = [...s.matchAll(/^  .?([a-z0-9-]+).?: ([A-Za-z]+)Art,$/gm)].map((m) => m[1]);
const dn = names.filter((n, i) => names.indexOf(n) !== i);
const dk = keys.filter((k, i) => keys.indexOf(k) !== i);
if (dn.length || dk.length) { console.log("  DUPLICATE functions:", dn, "keys:", dk); process.exit(1); }
console.log("  ok:", names.length, "art functions,", keys.length, "tiles");
' || fail=1

echo "== imports that nothing uses (CI fails on these)"
REPO="$REPO" python3 - <<'PYEOF' || fail=1
import os, re, sys
repo = os.environ['REPO']
bad = []
for base in ('packages/rules/src', 'apps/client/src'):
    for root, _, files in os.walk(os.path.join(repo, base)):
        for name in files:
            if not name.endswith(('.ts', '.tsx')): continue
            path = os.path.join(root, name)
            text = open(path).read()
            for block in re.finditer(r"import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'[^']+';", text):
                rest = text[:block.start()] + text[block.end():]
                for part in block.group(1).split(','):
                    part = part.strip().removeprefix('type ').strip()
                    if not part: continue
                    used = part.split(' as ')[-1].strip()
                    if not re.search(r'\b%s\b' % re.escape(used), rest):
                        bad.append('%s: %s' % (os.path.relpath(path, repo), used))
if bad:
    print('  UNUSED: ' + ', '.join(bad))
    sys.exit(1)
print('  ok')
PYEOF

echo "== names the client imports from @gamepals/rules but the barrel never exports"
REPO="$REPO" python3 - <<'BARRELEOF' || fail=1
import os, re, sys
repo = os.environ['REPO']
rules = os.path.join(repo, 'packages/rules/src')

def resolve(base, rel):
    path = os.path.normpath(os.path.join(os.path.dirname(base), rel))
    for candidate in (path + '.ts', os.path.join(path, 'index.ts')):
        if os.path.isfile(candidate): return candidate
    return None

seen, names = set(), set()

def walk(path):
    if not path or path in seen: return
    seen.add(path)
    text = open(path).read()
    for star in re.finditer(r"export \* from '([^']+)';", text):
        walk(resolve(path, star.group(1)))
    for listed in re.finditer(r"export (?:type )?\{([^}]*)\}", text):
        for part in listed.group(1).split(','):
            part = part.strip().replace('type ', '')
            if ' as ' in part: part = part.split(' as ')[-1].strip()
            if part: names.add(part)
    for named in re.finditer(r"^export (?:declare )?(?:const|function|class|type|interface|enum) ([A-Za-z0-9_]+)", text, re.M):
        names.add(named.group(1))

walk(os.path.join(rules, 'index.ts'))

missing = []
for root, _, files in os.walk(os.path.join(repo, 'apps/client/src')):
    for name in files:
        if not name.endswith(('.ts', '.tsx')): continue
        path = os.path.join(root, name)
        for imp in re.finditer(r"import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'@gamepals/rules';", open(path).read()):
            for part in imp.group(1).split(','):
                part = part.strip().replace('type ', '')
                if ' as ' in part: part = part.split(' as ')[0].strip()
                if part and part not in names:
                    missing.append(os.path.relpath(path, repo) + ': ' + part)
if missing:
    print('  MISSING from the rules barrel:')
    for line in missing: print('   ', line)
    sys.exit(1)
print('  ok:', len(names), 'names exported')
BARRELEOF

echo "== every game present in all six test lists"
REPO="$REPO" node -e '
const fs = require("fs"), path = require("path");
const dir = process.env.REPO + "/packages/rules/src/games";
const names = [];
for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const file = path.join(dir, entry.name, "index.ts");
  if (!fs.existsSync(file)) continue;
  const m = fs.readFileSync(file, "utf8").match(/^  name: .([^\x27]+).,$/m);
  if (m) names.push(m[1]);
}
const files = ["e2e/smoke.spec.ts", "e2e/layout.spec.ts", "e2e/full.spec.ts", "e2e/gallery.spec.ts", "e2e-native/android.mjs", "src/selftest.ts"];
let bad = 0;
for (const f of files) {
  const text = fs.readFileSync(process.env.REPO + "/apps/client/" + f, "utf8");
  const missing = names.filter((n) => !text.includes("\x27" + n + "\x27"));
  if (missing.length) { console.log("  MISSING in " + f + ":", missing.join(", ")); bad = 1; }
}
if (!bad) console.log("  ok: " + names.length + " games in every list");
process.exit(bad);
' || fail=1

echo "== rules tests"
out=$("$HERE/run-rules-tests.sh" "$@" 2>&1)
echo "$out" | grep -E "^✗|^== |passed [0-9]+, failed [0-9]+" | sed 's/^/  /'
echo "$out" | grep -qE "failed [1-9]" && fail=1

[ $fail -eq 0 ] && echo "ALL LOCAL CHECKS PASSED" || echo "LOCAL CHECKS FAILED"
exit $fail
