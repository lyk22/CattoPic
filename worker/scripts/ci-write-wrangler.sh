#!/usr/bin/env bash
# Write worker/wrangler.toml from CI secrets (file is gitignored locally).
# Supports WRANGLER_TOML_CONTENT (GitHub Actions) or WRANGLER_TOML (shorter name for dashboards).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTENT="${WRANGLER_TOML_CONTENT:-${WRANGLER_TOML:-}}"
if [[ -z "$CONTENT" ]]; then
  echo "Missing WRANGLER_TOML_CONTENT or WRANGLER_TOML: paste your full wrangler.toml body as an encrypted build variable." >&2
  exit 1
fi
printf '%s\n' "$CONTENT" > "${ROOT}/wrangler.toml"
echo "Wrote ${ROOT}/wrangler.toml"
