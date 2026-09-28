#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 fabviewer.yaml 的第 1 段 msg_kinds 渲染成 Logstash 的条件块
==============================================================

为什么要有这一步：
  「新增一个标签 = 加一条配置，不改代码」（docs/04-后台链路与数据模型.md §3.2.3）。
  规则写在 fabviewer.yaml 里（人类可读、和派生层共用一份），
  Logstash 侧只认 conf —— 所以由本脚本把规则翻译成 conf。
  生成物 pipeline/30-msgkind.conf 由 Logstash 自动重载（config.reload.automatic），
  改完规则重跑本脚本即可生效，**不重启进程、不改代码**。

运行环境：本地 / 构建机（python3 + pyyaml）。生成物随配置一起发布到 Logstash 服务器。
  /Users/xuejianming/.workbuddy/binaries/python/versions/3.13.12/bin/python3 render_msgkinds.py

用法：
  python3 render_msgkinds.py            # 渲染，写 pipeline/30-msgkind.conf
  python3 render_msgkinds.py --check    # 只校验生成物是否与源一致（CI 用，不写文件）
"""

import datetime
import pathlib
import re
import sys

try:
    import yaml
except ImportError:
    sys.exit("需要 pyyaml：pip install pyyaml")

HERE = pathlib.Path(__file__).resolve().parent          # deploy/logstash/tools
ROOT = HERE.parent                                      # deploy/logstash
SRC = ROOT / "fabviewer.yaml"
OUT = ROOT / "pipeline" / "30-msgkind.conf"

HEADER = """# ==============================================================================
# 第 3 段：打消息类型标签（MSG_KIND）—— 口径见 docs/04-后台链路与数据模型.md §3.2.3
#
# ⚠ 本文件由 tools/render_msgkinds.py 从 fabviewer.yaml 的第 1 段**自动生成**，
#   不要手改。改规则请改 fabviewer.yaml，然后重跑：
#       python3 tools/render_msgkinds.py
#   Logstash 开了 config.reload.automatic（3s），生成后自动重载。
#
# 语义：按 yaml 里的顺序，**第一条命中的规则生效**（第一个命中即停）—— 对应 04 §3.2.3
#   「每行只打一个标签」。命中的同时把 capture / set 的值写进行级字段
#   （CALL_SYS / LOCK_OBJ / LOCK_ID / ERR_CODE / RULE_RESULT）。
#   全都不命中 → MSG_KIND = OTHER。
#
# 生成时间：{ts}
# 规则条数：{n}
# ==============================================================================

filter {{
"""

TAIL = """  else {
    # 以上都不是（04 §3.2.3 标签表的默认值）
    mutate { replace => { "MSG_KIND" => "OTHER" } }
  }
}
"""


def esc_in_string(s: str) -> str:
    """conf 双引号字符串里的反斜杠要写成两个：\\S 落成 \\\\S。"""
    return s.replace("\\", "\\\\").replace('"', '\\"')


def esc_in_regex(s: str) -> str:
    """conf 正则字面量 /.../ 里反斜杠原样保留，只需防住斜杠。"""
    return s.replace("/", "\\/")


def to_logstash_grok(pattern: str) -> str:
    """python 命名组 (?P<NAME>...) → oniguruma 命名组 (?<NAME>...)"""
    return re.sub(r"\(\?P<([A-Za-z_]\w*)>", r"(?<\1>", pattern)


def name_first_group(pattern: str, field: str) -> str:
    """把第 1 个捕获组改成命名组（对应 yaml 里 capture 写字符串的语义）"""
    out, i, depth, done = [], 0, 0, False
    while i < len(pattern):
        ch = pattern[i]
        if ch == "\\":
            out.append(pattern[i : i + 2])
            i += 2
            continue
        if ch == "(":
            if pattern.startswith("(?", i) or pattern.startswith("(?:", i):
                out.append(ch)
                i += 1
                continue
            depth += 1
            if not done:
                out.append("(?<%s>" % field)
                done = True
                i += 1
                continue
        out.append(ch)
        i += 1
    if not done:
        raise ValueError("capture 写了字段名，但正则里没有捕获组：%s" % pattern)
    return "".join(out)


def build_rule(rule: dict, first: bool) -> str:
    kind = rule["kind"]
    conds = []
    if rule.get("flag"):
        # 通信族行首的方向标记 ::R:: / ::S:: / ::P:: —— 20-parse 切出来的中间字段 dir_flag。
        # 值是封闭枚举，用相等比较；判完即弃，不落文档（40 段的字段白名单会清掉 dir_flag）。
        conds.append('[dir_flag] == "%s"' % esc_in_string(rule["flag"]))
    if rule.get("prefix"):
        conds.append("[server_id] =~ /%s/" % esc_in_regex(to_logstash_grok(rule["prefix"])))
    if rule.get("regex"):
        conds.append("[LOG_BODY] =~ /%s/" % esc_in_regex(to_logstash_grok(rule["regex"])))
    if not conds:
        raise ValueError("规则 %s 既没有 flag、也没有 prefix / regex" % kind)
    head = "  if " if first else "  else if "

    lines = ["%s%s {" % (head, " and ".join(conds))]

    cap = rule.get("capture")
    if cap and rule.get("match_all"):
        # 一行可多个匹配，全部收进同一字段（多值）
        pattern = esc_in_string(rule["regex"])
        lines.append('    ruby { code => "event.set(\'%s\', event.get(\'LOG_BODY\').to_s.scan(/%s/).flatten)" }' % (cap, pattern))
    elif isinstance(cap, str) and cap:
        pat = to_logstash_grok(name_first_group(rule["regex"], cap))
        lines.append("    grok {")
        lines.append('      match => { "LOG_BODY" => "%s" }' % esc_in_string(pat))
        lines.append("      tag_on_failure => []")
        lines.append("    }")
    elif isinstance(cap, dict):
        pat = to_logstash_grok(rule["regex"])
        lines.append("    grok {")
        lines.append('      match => { "LOG_BODY" => "%s" }' % esc_in_string(pat))
        lines.append("      tag_on_failure => []")
        lines.append("    }")

    body = ['"%s" => "%s"' % (k, v) for k, v in (rule.get("set") or {}).items()]
    if body:
        lines.append("    mutate { add_field => { %s } }" % ", ".join(body))
    lines.append('    mutate { replace => { "MSG_KIND" => "%s" } }' % kind)
    lines.append("  }")
    return "\n".join(lines)


def render() -> str:
    cfg = yaml.safe_load(SRC.read_text(encoding="utf-8"))
    rules = cfg.get("msg_kinds") or []
    if not rules:
        raise ValueError("fabviewer.yaml 里没有 msg_kinds")
    blocks = [build_rule(r, i == 0) for i, r in enumerate(rules)]
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return HEADER.format(ts=ts, n=len(rules)) + "\n\n".join(blocks) + "\n" + TAIL


def main() -> int:
    text = render()
    check = "--check" in sys.argv
    if check:
        cur = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        # 生成时间戳不参与比对
        strip = lambda s: re.sub(r"^# 生成时间：.*$", "", s, flags=re.M)
        if strip(cur) != strip(text):
            print("生成物与 fabviewer.yaml 不一致，请重跑 render_msgkinds.py")
            return 1
        print("30-msgkind.conf 与 fabviewer.yaml 一致")
        return 0
    OUT.write_text(text, encoding="utf-8")
    print("已生成 %s" % OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
