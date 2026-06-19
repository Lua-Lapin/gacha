#!/usr/bin/env bash
set -euo pipefail

if [ -t 0 ]; then
  files="$(git ls-files)"
else
  files="$(cat)"
fi

bad="$(echo "$files" | grep -E '(^|/)\.env($|\.)|\.db$|\.sqlite$' || true)"

if [ -n "$bad" ]; then
  echo "ERROR: secret/db files must never be committed:" >&2
  echo "$bad" >&2
  exit 1
fi
exit 0
