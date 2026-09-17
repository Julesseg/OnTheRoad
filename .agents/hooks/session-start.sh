#!/usr/bin/env bash
set -euo pipefail

if [ "${AGENT_REMOTE:-false}" != "true" ]; then
  exit 0
fi

cd "${AGENT_PROJECT_DIR:?AGENT_PROJECT_DIR is required}"
echo "Installing project dependencies..." >&2
npm install >&2
