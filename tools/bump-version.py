"""Bump the ?v= cache-busting tag on every CSS/JS reference.

GitHub Pages caches files for up to 10 minutes. Every stylesheet link, module
script tag and module import carries the same ?v=<tag>, so a release must
change it everywhere at once - otherwise a visitor can get new HTML with old
scripts. Run this before committing a change to any .css or .js file:

    python tools/bump-version.py            # tag = current UTC time
    python tools/bump-version.py 20261009a  # or pick one
"""
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TAG = re.compile(r"(\.(?:css|js)\?v=)[A-Za-z0-9]+")


def main() -> None:
    tag = sys.argv[1] if len(sys.argv) > 1 else datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
    if not re.fullmatch(r"[A-Za-z0-9]+", tag):
        sys.exit("tag must be letters and digits only")
    files = [*ROOT.glob("*.html"), *ROOT.glob("js/**/*.js")]
    changed = 0
    for path in files:
        text = path.read_text(encoding="utf-8")
        new, n = TAG.subn(rf"\g<1>{tag}", text)
        if n and new != text:
            path.write_text(new, encoding="utf-8", newline="\n")
            changed += 1
    print(f"?v={tag} in {changed} file(s)")


if __name__ == "__main__":
    main()
