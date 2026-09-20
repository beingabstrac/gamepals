#!/bin/bash
# Names bound with const/let that nothing else in the file mentions, which is what typecheck
# fails on and precheck.sh cannot see. Test files count: an unused helper in one has failed CI.
#
# It does NOT see unused function parameters, and typecheck fails on those too: three bots
# stopped using `seat` and cost a CI run. Catching them needs each function's own body, because
# the name is usually still used elsewhere in the file, and two goes at that by brace matching
# flagged a dozen parameters in files that compile perfectly well. A check that cries wolf gets
# ignored, so this says what it cannot see instead. When you change a signature, read it.
# Usage: scripts/unused-scan.sh <file ...>
python3 - "$@" <<'PY'
import re, sys, os
bad = False
for path in sys.argv[1:]:
    text = open(path).read()
    names = set(re.findall(r'\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*[=:]', text))
    lone = [n for n in sorted(names) if len(re.findall(r'\b%s\b' % re.escape(n), text)) < 2]
    # A name used once is either unused or exported for somebody else; say which file it is in.
    exported = [n for n in lone if re.search(r'export (?:const|let) %s\b' % re.escape(n), text)]
    unused = [n for n in lone if n not in exported]
    print(f"{os.path.basename(path)} -> {', '.join(unused) if unused else 'all used'}"
          + (f"   (exported: {', '.join(exported)})" if exported else ""))
    if unused:
        bad = True
sys.exit(1 if bad else 0)
PY
