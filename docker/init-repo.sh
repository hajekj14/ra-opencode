#!/usr/bin/env sh
set -eu

repo_url="${GITLAB_REPO_URL:?GITLAB_REPO_URL is required}"
repo_dir="${GITLAB_REPO_DIR:?GITLAB_REPO_DIR is required}"
workspace_root="${WORKSPACE_ROOT:-/workspace}"
home_dir="${HOME:-/home/opencode}"

mkdir -p "$workspace_root" "$home_dir"

repo_host="$(printf '%s' "$repo_url" | sed -E 's#https?://([^/]+)/.*#\1#')"
if [ -n "${GITLAB_USERNAME:-}" ] && [ -n "${GITLAB_TOKEN:-}" ]; then
    cat > "$home_dir/.netrc" <<EOF
machine $repo_host
login ${GITLAB_USERNAME}
password ${GITLAB_TOKEN}
EOF
    chmod 600 "$home_dir/.netrc"
fi

target_dir="$workspace_root/$repo_dir"

if [ -d "$target_dir/.git" ]; then
    git -C "$target_dir" remote set-url origin "$repo_url"
    git -C "$target_dir" fetch --all --prune
elif [ -e "$target_dir" ]; then
    echo "Target path exists but is not a git repository: $target_dir" >&2
    exit 1
else
    git clone "$repo_url" "$target_dir"
fi