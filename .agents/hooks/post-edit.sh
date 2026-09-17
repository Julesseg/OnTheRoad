#!/usr/bin/env bash
set -u

case "${AGENT_FILE_PATH:-}" in
  *.js|*.jsx|*.ts|*.tsx) ;;
  *) exit 0 ;;
esac

project_dir="${AGENT_PROJECT_DIR:?AGENT_PROJECT_DIR is required}"
state_root="${TMPDIR:-/tmp}/agent-hooks"
state_key="$(printf '%s\0%s' "$project_dir" "${AGENT_SESSION_ID:-session}" | shasum -a 256 | awk '{print $1}')"
mkdir -p "$state_root"
touch "$state_root/$state_key.edited"

cd "$project_dir"
if ! lint_output="$(npm run lint 2>&1)"; then
  printf 'Lint reported issues after editing %s:\n%s\n' "${AGENT_FILE_PATH}" "$(printf '%s\n' "$lint_output" | head -50)"
fi

case "${AGENT_FILE_PATH}" in
  *.ts|*.tsx)
    if ! type_output="$(npx tsc --noEmit 2>&1)"; then
      printf 'Type checking reported issues after editing %s:\n%s\n' "${AGENT_FILE_PATH}" "$(printf '%s\n' "$type_output" | head -50)"
    fi
    ;;
esac

exit 0
