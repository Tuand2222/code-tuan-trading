#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

command -v timeout >/dev/null || {
  echo "build-verified.sh requires GNU timeout." >&2
  exit 69
}

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm run install:ci and wait for it to finish before building." >&2
  exit 69
fi

resolve_commit() {
  local candidate
  for candidate in \
    "${GITHUB_SHA:-}" \
    "${CF_PAGES_COMMIT_SHA:-}" \
    "${VERCEL_GIT_COMMIT_SHA:-}" \
    "${SOURCE_VERSION:-}" \
    "${COMMIT_SHA:-}"; do
    if [[ -n "${candidate}" ]]; then
      printf '%s' "${candidate}"
      return 0
    fi
  done

  git -C "${SITES_PROJECT_ROOT}" rev-parse HEAD 2>/dev/null || printf '%s' "unknown"
}

build_commit="$(resolve_commit)"
build_time="${BUILD_TIME:-$(date -u +'%Y-%m-%dT%H:%M:%SZ')}"
short_commit="${build_commit:0:7}"

export NEXT_PUBLIC_APP_COMMIT="${build_commit}"
export NEXT_PUBLIC_APP_BUILD_TIME="${build_time}"

mkdir -p "${SITES_PROJECT_ROOT}/public"
printf '{"app":"Trading Plan Pro","commit":"%s","shortCommit":"%s","builtAt":"%s"}\n' \
  "${build_commit}" "${short_commit}" "${build_time}" \
  > "${SITES_PROJECT_ROOT}/public/version.json"

echo "Build version: ${short_commit} (${build_time})"
echo "Running bounded vinext build..."
timeout \
  --signal=TERM \
  --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" \
  "${SITES_BUILD_TIMEOUT:-3m}" \
  "${vinext}" build

"${script_dir}/validate-artifact.sh"
