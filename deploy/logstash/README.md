# logstash · 加工层部署

在现有 Logstash 9.x 实例上追加一条 `mes-lines` 管道：不装 Logstash、不覆盖已有配置。前提 `logstash-output-opensearch` 2.x。方案：改 5 项 → 拷文件 → 追加两处 → 重启验证。

**用哪几个文件**：最小集 = `pipeline/` 6 个 `.conf` + `patterns/mes` + 一段管道声明。`conf/pipelines.yml` 只取那段追加到现场；`fabviewer.yaml` 与 `tools/render_msgkinds.py` 备着改规则用，首次部署不需要 Python；`conf/logstash.yml`、`conf/jvm.options` 只在独立新装实例时用。

## 1. 现场必改 5 项

| # | 位置 | 改成什么（举例） |
|---|---|---|
| 1 | `50-output.conf` 第 23 行 `hosts` | `["https://os-node-01:9200", ...]` 换成现场地址；内网 HTTP 时 `ssl => false` 并删两行证书校验 |
| 2 | `50-output.conf` 第 24–25 行 `user` / `password` | 仓库里是示例值 `fvdev`，现场改成实际账号密码；真值不进仓库 |
| 3 | `10-input.conf` 第 15 行 `port` | `5045`，核对没被占用；换值要与 Filebeat 的 `hosts` 同值 |
| 4 | `40-derive-fields.conf` 第 102 行 `cidrs` | `['10.0.0.0/8']` → 现场内网网段 |
| 5 | `40-derive-fields.conf` 第 142 行 `prefix` | `'dev-'` → 现场索引前缀，须与已入库索引名、读别名、模板 / ISM pattern 一致 |

例：DEV 写出的物理索引是 `dev-mes-log-line-dev-2026.11.12`。

**换环境前缀只改第 5 项那一处**：`prefix` 拼出 `[@metadata][index]`，`50-output.conf` 的 `index` 只是透传；env 段、日期、`_id`、字段白名单和其余 5 段 pipeline 都不受影响。切到 `test-` 时顺手同步 3 处文字：`40-derive-fields.conf` 第 127 行注释、`50-output.conf` 第 4 行举例、本表第 5 项。

## 2. 拷文件

```bash
sudo mkdir -p /etc/logstash-mes/pipeline /etc/logstash-mes/tools
sudo cp pipeline/*.conf          /etc/logstash-mes/pipeline/
sudo cp fabviewer.yaml           /etc/logstash-mes/
sudo cp tools/render_msgkinds.py /etc/logstash-mes/tools/
sudo cp patterns/mes             /etc/logstash/patterns/mes
sudo chown -R logstash:logstash /etc/logstash-mes
```

`20-parse.conf` 的 `patterns_dir` 写死 `/etc/logstash/patterns`；该目录已有同名 `mes` 就改名（如 `mes-fab`）并同步改 `20-parse.conf` 两处。`30-msgkind.conf` 已是成品，不用跑渲染脚本。

## 3. 追加两处

现场 `pipelines.yml` 末尾追加（别人的条目一个字不动）：

```yaml
- pipeline.id: mes-lines
  path.config: "/etc/logstash-mes/pipeline/*.conf"
  pipeline.workers: 4
  pipeline.batch.size: 500
  pipeline.ecs_compatibility: disabled
  queue.type: persisted
```

`ecs_compatibility: disabled` 不能省：开着会补 `ecs` / `host` 元字段，行索引模板是 `dynamic: strict`，多一个字段整篇写入失败。

现场 `logstash.yml` 逐项确认、缺才加：`dead_letter_queue.enable: true`、`config.reload.automatic: true` + `config.reload.interval: 3s`。不要用 `conf/logstash.yml` 整份覆盖。

## 4. 重启 + 验证

```bash
sudo -u logstash /usr/share/logstash/bin/logstash -t      # 期望 Configuration OK
sudo systemctl restart logstash                          # 别的管道会一起断几秒；多节点逐个重启
```

判据：`curl -s localhost:9600/_node/stats/pipelines | jq '.pipelines["mes-lines"].events'`，`in` 与 `out` 都涨即正常；`in` 涨、`out` 不涨去查 DLQ 与 OpenSearch 认证 / 模板。例：`curl -s "https://os-node-01:9200/dev-mes-log-line-read/_count"` 能看到文档数在涨。
