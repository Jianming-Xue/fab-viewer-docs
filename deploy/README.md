# deploy · 链路三层的部署产物

本目录放**可部署的东西**。口径不在这里 —— 口径在 `docs/`，本目录只回答「怎么装、怎么起、怎么验、怎么回」。

**注意：现场两个中间件都已经存在**（OpenSearch 多节点集群、Logstash 多节点实例），且各有别的系统在用。所以三层方案都是**追加部署** —— 只加本链路自己那一份，不动别的系统的东西：

| 层 | 追加什么 | 会不会碰到别的系统 | 口径文档 | 部署说明 |
|---|---|---|---|---|
| 存储 | 2 个 ISM 策略 + 2 个索引模板 | 不碰。只留下 `mes-log-*` 索引与两个读别名 | `docs/09`、`docs/04` §5 | [README](opensearch/README.md) |
| 加工 | 1 条管道（文件全在独立目录 `/etc/logstash-mes/`） | 只往 `pipelines.yml` 末尾追加一段、`logstash.yml` 补两个开关 | `docs/04` §3 | [README](logstash/README.md) |
| 采集 | 每台机器一份配置 | 本层是新装（业务机上原本没有 Filebeat） | `docs/04` §2 | [README](filebeat/README.md) |

**派生层不在本目录。** 它是一个自研服务 **`tworks-log-int`**，源码、建表脚本与部署产物都不在本目录内。位置与规模见 `docs/06-派生服务工程实现.md` §1.1、§1.4。

三份部署说明里的图（改动对照 + 验证期望输出）都在 [`assets/`](assets/README.md)，生成源在同目录 `_src/`。

**示例值说明**：文档与图里的地址、端口是示例 —— `mes-os-01:9200`（存储）、`mes-ls-01:5045`（加工，假设 5044 已被别的系统占用）。现场按实际填，但**加工侧的收端口与采集侧的送端口必须是同一个值**。

## 版本矩阵（现场口径）

| 层 | 组件 | 版本 | 适配情况 |
|---|---|---|---|
| 存储 | OpenSearch | **3.8.0** | 已按 3.x 对齐：可组合模板 `_index_template`、策略靠 `ism_template` 挂 |
| 加工 | Logstash | **9.5.0** | 已按 9.x 对齐：`api.http.*`、ECS 关、buffer 默认改 heap |
| 加工 | logstash-output-opensearch | 2.x | 必须 2.x（1.x 不支持 Logstash 8+） |
| 采集 | Filebeat | 待确认 | 配置按 `filestream` 写，7.15+ 通用；版本号待补 |

三处版本相关的坑，直接命中本方案、都已处理：

1. **Logstash 9.0 移除了 `http.host` / `http.port`** —— 改名 `api.http.host` / `api.http.port`。留旧名不是警告，是**启动失败**。
2. **Logstash 9.x 的 pipeline 默认 `ecs_compatibility: v8`** —— 不关掉，事件会多出 `ecs` / `host` 等元字段，撞上行索引模板的 `dynamic: strict`；而且 `logstash-output-opensearch` 的模板管理器在 JRuby 10 上会因 `File.exists?` 被移除而报错。本方案两处都关，外加 `manage_template => false`。
3. **OpenSearch 3.0 移除了 legacy `_template` API**，且不再支持用索引模板挂 ISM 策略 —— 本方案用 `_index_template`，策略靠策略自带的 `ism_template` 匹配。

## 上线顺序：存储 → 加工 → 采集

顺序不能反，两条都是硬理由：

1. **存储先就绪。** Logstash 一起来就会往 OpenSearch 写。索引模板没装的话，行索引会以默认的 `dynamic: true` 建出来 —— 字段类型由第一个文档**猜**出来，之后**改不回来**（OpenSearch 不允许改已存在字段的类型）。模板必须在任何一个事件落地**之前**装好。
2. **加工先就绪。** Filebeat 一起来就往加工层送。管道不在时 Filebeat 会一直重试、registry 不推进、内存队列积压；更麻烦的是现场会以为「采集在跑」，其实数据全堵在内存里。

采集层是三层里唯一可以随时开、随时停的 —— 它有 registry，重启后从断点接着读，重复投递靠行 ID 幂等（`docs/04` §3.2.2；**纯文本行除外**，它重投会多出一篇）。

## 端到端验收

三层各自验完之后，走一遍全链路：

1. **采集在动** —— `journalctl -u filebeat` 无 error；`/var/lib/filebeat/registry` 目录的 mtime 在变。
2. **加工在吞** —— `curl -s localhost:9600/_node/stats/pipelines | jq '.pipelines["mes-lines"].events'`，`in` 与 `out` 都在涨。
3. **存储落对了** —— 查当天行索引，确认文档数与字段类型：

   ```bash
   curl -s "$OS/mes-log-line-read/_count?q=system.name:MES-300Works"
   curl -s "$OS/mes-log-line-prod-$(date +%Y.%m.%d)/_mapping" | jq '.[].mappings.properties.LOG_TIME'
   # 期望：{"type":"keyword"}；若出现 "text" 或带 fields.keyword，说明模板没生效，索引是猜出来的
   ```

4. **三处时间一致** —— 抽一条文档，`@timestamp`（入库时间）、`LOG_TIME`（日志时间）、`_id` 末段（17 位毫秒串）三个值应当同源自同一行且量级一致。这一条能一次抓出时区、厘秒补位、模板三类问题。

## 改口径时动哪个文件

| 想改什么 | 动哪 | 能不能热生效 |
|---|---|---|
| 消息类型标签规则（`MSG_KIND`） | `logstash/fabviewer.yaml` 第 1 段 | 能。重跑渲染脚本，3 秒内生效，不重启 |
| 拆分/字段类型（模板） | `opensearch/1x-template-*.json` | **只能对新索引生效**。已建的索引改不动，要改类型只能重建索引 |
| 保留期、热温冷档位 | `opensearch/0x-ism-*.json` | 能。对已建索引同样生效 |
| 采集路径、多行规则 | `filebeat/filebeat.yml` | 要重启 Filebeat |
| 加工侧结构性改动（conf） | `logstash/pipeline/*.conf` | 要重启整个 Logstash 实例 |

**规则一句话**：能外置的都外置了（`logstash/fabviewer.yaml` 是加工层的规则源），conf / JSON 里的都是结构性的东西，改动要按上面第三列判断影响面。
