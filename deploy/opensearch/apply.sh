#!/usr/bin/env bash
# ==============================================================================
# MES 日志链路 · 存储层部署
#
# 装两个 ISM 保留策略 + 两个可组合索引模板，并预建当天行索引与当月块索引。
#
# 追加部署：现场集群已存在、已有别的系统在用。本脚本只 PUT 上面 4 个对象，
# 不动任何现有索引与集群设置。用法见同目录 README.md 的第二步。
#
# 用法：
#   OPENSEARCH_URL="http://10.20.30.50:9200" ./apply.sh
#   带认证：OPENSEARCH_URL=https://os:9200 OPENSEARCH_USER=admin OPENSEARCH_PASSWORD=xxx ./apply.sh
#   自签证书：再加 OPENSEARCH_INSECURE=1
#   只打印命令不执行：./apply.sh --dry-run
#   不预建索引（只装模板）：MES_ENVS="" ./apply.sh
#     —— 环境名默认 "prod pirun"；单环境现场改 MES_ENVS=prod
#
# 只做 PUT / HEAD，不删任何东西，可重复执行。
# 顺序有要求：先 ISM 策略 → 再模板 → 最后建索引
#   （索引一建出来就自动带上别名与策略，所以必须排在两者之后）
#
# 口径见 docs/09-OpenSearch索引模板.md；字段清单见 docs/04-后台链路与数据模型.md §5.2 / §5.3。
# 前置条件、验证清单、回滚做法见同目录 README.md。
# ==============================================================================

set -euo pipefail

OS_URL="${OPENSEARCH_URL:-}"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1
ENVS="${MES_ENVS-prod pirun}"

if [[ $DRY_RUN -eq 0 ]] && ! command -v jq >/dev/null 2>&1; then
  echo "需要 jq 解析集群返回（yum install -y jq / apt-get install -y jq）" >&2
  exit 1
fi

if [[ -z "$OS_URL" && $DRY_RUN -eq 0 ]]; then
  echo "缺少 OPENSEARCH_URL，例如：OPENSEARCH_URL=http://10.20.30.50:9200 ./apply.sh" >&2
  exit 1
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TODAY="$(date +%Y.%m.%d)"
MONTH="$(date +%Y.%m)"

curl_args=(-sS)
if [[ -n "${OPENSEARCH_USER:-}" ]]; then
  curl_args+=(-u "${OPENSEARCH_USER}:${OPENSEARCH_PASSWORD:-}")
fi
if [[ "${OPENSEARCH_INSECURE:-0}" == "1" ]]; then
  curl_args+=(-k)
fi

api() {                        # api <METHOD> <path> [json-file]
  local m="$1" p="$2" f="${3:-}"
  if [[ -n "$f" ]]; then
    curl "${curl_args[@]}" -H 'Content-Type: application/json' -X "$m" "${OS_URL}/${p}" -d @"${DIR}/${f}"
  else
    curl "${curl_args[@]}" -X "$m" "${OS_URL}/${p}"
  fi
}

put() {                        # put <接口路径> <文件>
  local path="$1" file="$2"
  echo "== PUT ${path}  <=  $(basename "$file")"
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "   curl -X PUT -H 'Content-Type: application/json' \"\$OPENSEARCH_URL/${path}\" -d @$(basename "$file")"
    return 0
  fi
  api PUT "$path" "$file" | head -c 300
  echo
}

exists() {                     # exists <index>
  local code
  code=$(curl "${curl_args[@]}" -I -o /dev/null -w '%{http_code}' "${OS_URL}/$1" 2>/dev/null || true)
  [[ "$code" == "200" ]]
}

# ---------- 0/4 前置检查 ----------
if [[ $DRY_RUN -eq 0 ]]; then
  echo "--- 0/4 前置检查 ---"
  root=$(api GET "" || true)
  if [[ -z "$root" ]]; then
    echo "集群不可达：${OS_URL}" >&2
    exit 1
  fi
  echo "  集群 $(echo "$root" | jq -r '.cluster_name')   版本 $(echo "$root" | jq -r '.version.number')"

  ism_code=$(curl "${curl_args[@]}" -o /dev/null -w '%{http_code}' "${OS_URL}/_plugins/_ism/policies" || true)
  if [[ "$ism_code" == "200" ]]; then
    echo "  ISM 插件  可用"
  else
    echo "  ISM 插件不可用（HTTP ${ism_code}）—— 两个保留策略装不上。先确认集群启用了 index_state_management" >&2
    exit 1
  fi

  aci=$(api GET "_cluster/settings?include_defaults=true&flat_settings=true" \
        | jq -r '.defaults["action.auto_create_index"] // .persistent["action.auto_create_index"] // .transient["action.auto_create_index"] // "true"')
  echo "  action.auto_create_index = ${aci}"
  case "$aci" in
    true|*mes-log-*) : ;;
    *)
      echo "  ！该设置不允许自动建 mes-log-* 索引，Logstash 的第一个事件就会被拒。" >&2
      echo "    放开（按需带上 -k / 认证参数）：" >&2
      echo "    curl -X PUT \"${OS_URL}/_cluster/settings\" -H 'Content-Type: application/json' \\" >&2
      echo "         -d '{\"persistent\":{\"action.auto_create_index\":\"+mes-log-*,-*\"}}'" >&2
      ;;
  esac

  nd=$(api GET "_cat/nodes?h=roles&format=json" | jq '[.[] | select((.roles // "") | test("data"))] | length')
  echo "  数据节点数 = ${nd}"
  echo
fi

# ---------- 1/4 ISM 策略 ----------
echo "--- 1/4 ISM 策略 ---"
put "_plugins/_ism/policies/mes-log-line-360d" 01-ism-line-360d.json
put "_plugins/_ism/policies/mes-log-exec-keep" 02-ism-exec-keep.json

# ---------- 2/4 索引模板 ----------
echo "--- 2/4 索引模板 ---"
put "_index_template/mes-log-line" 11-template-line.json
put "_index_template/mes-log-exec" 12-template-exec.json

# ---------- 3/4 预建索引 ----------
# 索引本来会在首次写入时自动创建；先建一次是为了「装完立刻能验」，
# 顺便确认模板真的生效 —— 建出来的索引应当自带读别名与 ISM 策略。
echo "--- 3/4 预建索引（当天行索引 + 当月块索引） ---"
if [[ -z "$ENVS" ]]; then
  echo "  MES_ENVS 为空，跳过 —— 索引将在首次写入时自动创建"
else
  for env in $ENVS; do
    for idx in "mes-log-line-${env}-${TODAY}" "mes-log-exec-${env}-${MONTH}"; do
      if [[ $DRY_RUN -eq 1 ]]; then
        echo "   [dry-run] PUT ${idx}"
      elif exists "$idx"; then
        echo "   已存在，跳过  ${idx}"
      else
        api PUT "$idx" >/dev/null && echo "   已建  ${idx}"
      fi
    done
  done
fi

# ---------- 4/4 核对 ----------
if [[ $DRY_RUN -eq 1 ]]; then
  echo "--- 4/4 核对（dry-run 跳过） ---"
  echo "（dry-run，未发起任何写请求）"
  exit 0
fi

echo "--- 4/4 核对 ---"
api GET "_index_template/mes-log-*" \
  | jq -r '.index_templates[] | "  模板 \(.name)  →  \(.index_template.index_patterns | join(", "))"'
api GET "_cat/indices/mes-log-*?h=index,health,pri,rep&format=json" \
  | jq -r '.[] | "  索引 \(.index)  \(.health)  \(.pri)主/\(.rep)副"' || true
echo
echo "  别名与策略是否挂上，拿任一个刚建的索引验一次："
echo "    curl \"${OS_URL}/mes-log-line-prod-${TODAY}/_alias\"              期望看到 mes-log-line-read"
echo "    curl \"${OS_URL}/_plugins/_ism/explain/mes-log-line-prod-${TODAY}\"  期望 policy_id = mes-log-line-360d"
