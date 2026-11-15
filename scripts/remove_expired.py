#!/usr/bin/env python3
"""Delete event and volunteer cards whose data-hide-after time has passed.

The page script already hides these cards for visitors at that time. This
script deletes them from the HTML too, so file previews and future edits do
not show stale events.

A card is any line that opens a <div> or <li> with data-hide-after="<ISO time
with offset>". The script deletes the card through its matching closing tag,
plus the comment block directly above it (no blank line between).

Usage:
  python3 scripts/remove_expired.py            # edit files in place
  python3 scripts/remove_expired.py --dry-run  # only list what would go
  python3 scripts/remove_expired.py --now 2026-11-26T00:00:00-05:00

Prints one line per deleted card ("<file>: <title>"). Exit code 0 always,
unless a safety check fails (then 1 and no file is written).
"""
import argparse
import datetime as dt
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES = ["index.html", "parent-hub.html", "teacher-hub.html"]
OPEN_RE = re.compile(r'^\s*<(div|li)\b[^>]*\bdata-hide-after="([^"]+)"')
TITLE_RE = re.compile(r'class="(?:priority-title|vol-card-title)[^"]*">(.*?)</', re.S)


def tag_balance(text, tag):
    return len(re.findall(rf"<{tag}\b", text)) - len(re.findall(rf"</{tag}>", text))


def find_end(lines, start, tag):
    depth = 0
    for i in range(start, len(lines)):
        depth += len(re.findall(rf"<{tag}\b", lines[i]))
        depth -= len(re.findall(rf"</{tag}>", lines[i]))
        if depth <= 0:
            return i
    return None


def comment_start(lines, start):
    """Index of a comment block that ends on the line just above start."""
    i = start - 1
    if i < 0 or not lines[i].strip().endswith("-->"):
        return start
    while i >= 0:
        if "<!--" in lines[i]:
            return i
        i -= 1
    return start


def process(path, now):
    text = path.read_text()
    lines = text.split("\n")
    removed, drop = [], set()
    i = 0
    while i < len(lines):
        m = OPEN_RE.match(lines[i])
        if not m:
            i += 1
            continue
        tag, when = m.group(1), m.group(2)
        try:
            hide_at = dt.datetime.fromisoformat(when)
        except ValueError:
            print(f"warning: {path.name}:{i + 1}: bad data-hide-after {when!r}", file=sys.stderr)
            i += 1
            continue
        if hide_at.tzinfo is None or hide_at > now:
            i += 1
            continue
        end = find_end(lines, i, tag)
        if end is None:
            raise SystemExit(f"error: {path.name}:{i + 1}: no closing </{tag}>")
        first = comment_start(lines, i)
        # Take one blank line after the card too, so no double gap remains.
        last = end + 1 if end + 1 < len(lines) and not lines[end + 1].strip() else end
        block = "\n".join(lines[i:end + 1])
        t = TITLE_RE.search(block)
        title = html.unescape(re.sub(r"<[^>]+>", "", t.group(1))).strip() if t else "(untitled)"
        removed.append(f"{title} (ended {when})")
        drop.update(range(first, last + 1))
        i = end + 1
    if not removed:
        return text, []
    new = "\n".join(l for n, l in enumerate(lines) if n not in drop)
    for tag in ("div", "li"):
        if tag_balance(new, tag) != tag_balance(text, tag):
            raise SystemExit(f"error: {path.name}: <{tag}> balance changed; nothing written")
    return new, removed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--now", help="ISO time with offset (for testing)")
    args = ap.parse_args()
    now = dt.datetime.fromisoformat(args.now) if args.now else dt.datetime.now(dt.timezone.utc)
    for name in FILES:
        path = ROOT / name
        if not path.exists():
            continue
        new, removed = process(path, now)
        for r in removed:
            print(f"{name}: {r}")
        if removed and not args.dry_run:
            path.write_text(new)


if __name__ == "__main__":
    main()
