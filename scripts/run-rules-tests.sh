#!/bin/bash
# Runs packages/rules tests on a machine with no node_modules (the owner's Mac): copies the
# sources to a temp folder, rewrites relative imports for Node's TypeScript loader, and swaps
# vitest for the small stand-in next door.
# Usage: scripts/run-rules-tests.sh [paths relative to packages/rules/src ...]   (default: all)
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
D=$(mktemp -d)
cp -R "$REPO/packages/rules/src/"* "$D/"
cp "$HERE/vitest-stub.ts" "$D/vitest.ts"
cd "$D"
python3 - <<'PY'
import os, re
for root, _, files in os.walk('.'):
    for f in files:
        if not f.endswith('.ts'): continue
        p = os.path.join(root, f)
        s = open(p).read()
        def fix(m):
            spec = m.group(1)
            if spec.endswith('.ts'): return f"from '{spec}'"
            target = os.path.normpath(os.path.join(root, spec))
            return f"from '{spec}/index.ts'" if os.path.isdir(target) else f"from '{spec}.ts'"
        s = re.sub(r"from '(\.[^']*)'", fix, s)
        s = s.replace("from 'vitest'", "from '%s/vitest.ts'" % os.path.relpath('.', root))
        open(p, 'w').write(s)
PY
TESTS=("$@")
if [ ${#TESTS[@]} -eq 0 ]; then IFS=$'\n' read -r -d '' -a TESTS < <(find . -name '*.test.ts' | sort && printf '\0'); fi
for t in "${TESTS[@]}"; do echo "== $t"; node --experimental-transform-types --no-warnings "$t" || true; done
