#!/usr/bin/env sh
set -eu

repo_dir="${GITLAB_REPO_DIR:?GITLAB_REPO_DIR is required}"
workspace_root="${WORKSPACE_ROOT:-/workspace}"
port="${OPENCODE_PORT:-4096}"
target_dir="$workspace_root/$repo_dir"

if [ ! -d "$target_dir/.git" ]; then
    echo "Repository has not been initialized: $target_dir" >&2
    exit 1
fi

cd "$target_dir"

exec opencode web --hostname 0.0.0.0 --port "$port"