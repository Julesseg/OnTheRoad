#!/usr/bin/env bash
set -u

project_dir="${AGENT_PROJECT_DIR:?AGENT_PROJECT_DIR is required}"
state_root="${TMPDIR:-/tmp}/agent-hooks"
state_key="$(printf '%s\0%s' "$project_dir" "${AGENT_SESSION_ID:-session}" | shasum -a 256 | awk '{print $1}')"
marker="$state_root/$state_key.edited"

[ -f "$marker" ] || exit 0
rm -f "$marker"

cd "$project_dir"
if test_output="$(npm test 2>&1)"; then
  exit 0
fi

printf 'Tests failed after this session edited source files:\n%s\n' "$(printf '%s\n' "$test_output" | tail -20)"
exit 2
