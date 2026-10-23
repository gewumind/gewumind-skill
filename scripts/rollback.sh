#!/usr/bin/env bash
#
# rollback.sh — 回滚到指定备份版本，并可选复验
#
# 用法：
#   scripts/rollback.sh --base http://localhost:9089 --version <backupVersion> \
#     --ai-key <keyId:secret> \
#     [--component 设备列表 --api /api/device/list --menu-url /device/list \
#      --username admin --password 123456]
#
# --ai-key 也可用环境变量 GW_AI_KEY。
# 回滚本身只调 POST /api/ai/rollback（body: {"version":"..."}，头 X-AI-Key）。
# 给了 --component/--api/--menu-url 中任意一个时，回滚后自动跑 verify-publish.mjs。
set -euo pipefail

BASE="http://localhost:9089"
VERSION=""
AI_KEY="${GW_AI_KEY:-}"
DO_VERIFY=1
VERIFY_ARGS=()

usage() {
  sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --ai-key) AI_KEY="$2"; shift 2 ;;
    --no-verify) DO_VERIFY=0; shift ;;
    --component|--api|--menu-url|--token|--username|--password|--api-method|--api-body|--json)
      VERIFY_ARGS+=("$1" "$2"); shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "rollback: 未知参数 $1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -n "$VERSION" ]] || { echo "rollback: 缺少 --version" >&2; exit 2; }
[[ -n "$AI_KEY" ]] || { echo "rollback: 缺少 --ai-key（或 GW_AI_KEY）" >&2; exit 2; }
BASE="${BASE%/}"

response="$(curl -sS -m 30 -X POST "$BASE/api/ai/rollback" \
  -H "X-AI-Key: $AI_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"version\":\"$VERSION\"}")"
printf '%s\n' "$response"

if ! node -e 'const d=JSON.parse(process.argv[1]); process.exit(d && d.success === true ? 0 : 1)' "$response"; then
  echo "rollback: 回滚失败" >&2
  exit 1
fi

if [[ "$DO_VERIFY" -eq 1 && ${#VERIFY_ARGS[@]} -gt 0 ]]; then
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  exec node "$here/verify-publish.mjs" --base "$BASE" "${VERIFY_ARGS[@]}"
fi

echo "rollback: OK ($VERSION)"
