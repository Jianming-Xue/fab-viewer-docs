# MES 日志链路 · RHEL 裸机部署说明

> 适用：RedHat 8/9（dnf/systemd）。源 [fab-viewer-docs deploy/](https://github.com/Jianming-Xue/fab-viewer-docs/tree/main/deploy)，
> 本文是它的完整落地版，`dev-` 前缀为本现场实际值。Docker 版见 [DEPLOY-DOCKER.md](DEPLOY-DOCKER.md)。
>
> **本文所有 `<占位符>` 由现场提供，真实地址/凭据只落在部署机的 keystore / 本地配置里，不进文档、不外发。**

```
业务机 filebeat（每台一份，恒为新装）──5045──→ 加工机 logstash（mes-lines 管道）──https──→ OpenSearch 集群
```

**组件来源分两条路线，按现场实际情况选：**

| 组件 | 路线 A：已有组件 + 部署（现场实际形态，主线） | 路线 B：新装组件 + 部署 |
|---|---|---|
| OpenSearch | 集群已在，只装入模板 + ISM（§0.1） | 按 §0.2 新装集群后，同样执行 §0.1 |
| Logstash | 实例已在（9.x），**追加** mes-lines 管道，不覆盖已有配置（§1 走 A 分支） | 按 §1.1-A 新装实例，主配置整份用仓库版 |
| Filebeat | —（恒为新装，§2） | —（恒为新装，§2） |

**上线顺序：存储 → 加工 → 采集**（加工层管道没起来之前别开采集，事件会堵在 filebeat 内存队列）。
命令均在 `root` 或 `sudo` 下执行；`<repo>` 指 `git clone` 下来的 fab-viewer-docs 目录。

## 0. OpenSearch 侧

### 0.1 装入模板与 ISM（两条路线都要做，一次性，集群级对象）

仓库 json 是通用前缀 `mes-log-line-`，装入时替换成 `dev-mes-log-line-`：

```bash
OS='https://<OS_HOST>:<OS_PORT>'; AUTH='<OS_USER>:<OS_PASSWORD>'

# 行索引模板（strict 20 字段；aliases 段自带读别名 dev-mes-log-line-read，新索引自动挂）
sed 's/mes-log-line-/dev-mes-log-line-/g' <repo>/deploy/opensearch/11-template-line.json \
  | curl -s -u "$AUTH" -XPUT "$OS/_index_template/dev-mes-log-line-tpl" -H 'Content-Type: application/json' -d @-

# ISM 策略：hot（0-30d 可写）→ warm（30d 只读+force merge 单段）→ cold（180d）→ delete（360d）
sed 's/mes-log-line-/dev-mes-log-line-/g' <repo>/deploy/opensearch/01-ism-line-360d.json \
  | curl -s -u "$AUTH" -XPUT "$OS/_plugins/_ism/policies/dev-mes-log-line-policy" -H 'Content-Type: application/json' -d @-

# 验证：两条都应 200
curl -s -o /dev/null -w '%{http_code}\n' -u "$AUTH" "$OS/_index_template/dev-mes-log-line-tpl"
curl -s -o /dev/null -w '%{http_code}\n' -u "$AUTH" "$OS/_plugins/_ism/policies/dev-mes-log-line-policy"
```

删数据索引不影响模板/ISM/别名；所用能力（_index_template、_plugins/_ism）为 OpenSearch 自带，无需额外插件。

### 0.2 路线 B：新装 OpenSearch 集群（简述）

按官方文档安装对应版本的 OpenSearch 集群（本链路对版本无特殊要求，2.x/3.x 均可；节点数与 TLS 按现场规划），
装好确认 `_cluster/health` 为 green 后，回到 §0.1 装入模板与 ISM 即可。行索引量级不大，1~3 节点起步够用。

## 1. 加工层 Logstash（加工机）

### 1.1 安装

**路线 A（已有实例，主线）**：跳过安装。先核版本必须 9.x：

```bash
/usr/share/logstash/bin/logstash --version    # 期望 logstash 9.x
```

已有实例的任何配置（别的管道、logstash.yml、pipelines.yml 既有条目）**一个字不动**，后面只做"追加"。

**路线 B（新装实例）**：

```bash
rpm --import https://artifacts.elastic.co/GPG-KEY-elasticsearch
cat >/etc/yum.repos.d/elastic-9.x.repo <<'EOF'
[elastic-9.x]
name=Elastic repository for 9.x packages
baseurl=https://artifacts.elastic.co/packages/9.x/yum
gpgcheck=1
gpgkey=https://artifacts.elastic.co/GPG-KEY-elasticsearch
enabled=1
EOF
dnf install -y logstash        # 9.5.x，rpm 自带 JDK，无需另装
# 主配置整份用仓库版（含热重载 3s、persisted 队列、DLQ、ECS 关闭；api 只听 127.0.0.1）
cp <repo>/deploy/logstash/conf/logstash.yml  /etc/logstash/logstash.yml
cp <repo>/deploy/logstash/conf/jvm.options   /etc/logstash/jvm.options   # 堆大小按机器调
```

### 1.2 输出插件（两条路线都要；必须 2.x，1.x 不支持 Logstash 8+）

```bash
/usr/share/logstash/bin/logstash-plugin install logstash-output-opensearch
/usr/share/logstash/bin/logstash-plugin list --verbose | grep logstash-output-opensearch   # 期望 (2.x.y
```

离线机：先在联网机 `logstash-plugin prepare-offline-pack logstash-output-opensearch` 生成离线包，
拷过去 `logstash-plugin install file:///tmp/logstash-output-opensearch-<ver>.zip`。

### 1.3 凭据（两条路线都要；推荐 keystore，pipeline 里以 ${OS_USER}/${OS_PASSWORD} 引用）

```bash
/usr/share/logstash/bin/logstash-keystore create
/usr/share/logstash/bin/logstash-keystore add OS_USER        # 交互输入现场账号
/usr/share/logstash/bin/logstash-keystore add OS_PASSWORD    # 交互输入现场密码
```

### 1.4 拷文件（两条路线都要，最小集）

```bash
mkdir -p /etc/logstash-mes/pipeline /etc/logstash-mes/tools
cp <repo>/deploy/logstash/pipeline/*.conf /etc/logstash-mes/pipeline/
cp <repo>/deploy/logstash/fabviewer.yaml     /etc/logstash-mes/
cp <repo>/deploy/logstash/tools/render_msgkinds.py /etc/logstash-mes/tools/
cp <repo>/deploy/logstash/patterns/mes       /etc/logstash/patterns/mes
chown -R logstash:logstash /etc/logstash-mes
```

`/etc/logstash/patterns` 已有同名 `mes` 就改名（如 `mes-fab`）并同步改 `20-parse.conf` 的 `patterns_dir` 两处。

### 1.5 现场化 5 项（文件内有【现场改】可搜）

| # | 位置 | 现场值 |
|---|---|---|
| 1 | `/etc/logstash-mes/pipeline/50-output.conf` `hosts` | `["https://<OS_HOST>:<OS_PORT>"]`（公有 CA 证书则 `ssl`/校验保持开、无需 cacert；自签证书按文件内注释挂 CA） |
| 2 | 同上 `user`/`password` | `"${OS_USER}"` / `"${OS_PASSWORD}"`（keystore 解析，真值不进配置） |
| 3 | `10-input.conf` `port` | `5045`（默认即用；换值要与所有采集机的 filebeat 输出同值） |
| 4 | `40-derive-fields.conf` `cidrs` | 按现场内网网段，如 `['10.0.0.0/8','172.16.0.0/12','192.168.0.0/16']`（要能命中业务机 IP，否则 HOSTIP 为空、行进不了流） |
| 5 | `40-derive-fields.conf` `prefix` | `'dev-'`（默认即用；须与 §0 装入的模板/ISM pattern、读别名一致，换前缀三处同步改） |

### 1.6 追加管道声明与实例设置（两条路线都要）

`/etc/logstash/pipelines.yml` **末尾追加**（已有条目一个字不动）：

```yaml
- pipeline.id: mes-lines
  path.config: "/etc/logstash-mes/pipeline/*.conf"
  pipeline.workers: 4
  pipeline.batch.size: 500
  pipeline.ecs_compatibility: disabled
  queue.type: persisted
```

`ecs_compatibility: disabled` 不能省：行索引模板 `dynamic: strict`，开着 ECS 会补元字段、整篇写入失败。

实例级设置：

- **路线 A**：已有实例的 `/etc/logstash/logstash.yml` **逐项确认、缺才加，不要整份覆盖** ——`dead_letter_queue.enable: true`、`config.reload.automatic: true`、`config.reload.interval: 3s`。多管道共用实例时注意 `pipeline.workers`/队列设置写在 pipelines.yml 段内只作用于本管道。
- **路线 B**：§1.1 已整份用仓库版 logstash.yml，含上述全部设置，无需再动。

### 1.7 RHEL 系统项（两条路线都要）

```bash
firewall-cmd --permanent --add-port=5045/tcp && firewall-cmd --reload   # 加工机放行 beats 口
```

### 1.8 校验、启动、验证

```bash
sudo -u logstash /usr/share/logstash/bin/logstash -t    # 期望 Configuration OK
systemctl enable --now logstash
sleep 60
curl -s localhost:9600/_node/stats/pipelines | jq '.pipelines["mes-lines"].events'   # in/out 就绪
curl -s -u "$AUTH" "$OS/dev-mes-log-line-read/_count"    # 采集开后文档数在涨
```

路线 A 重启会断该实例上别的管道几秒，多节点加工层逐个重启。

## 2. 采集层 Filebeat（每台业务机一份，恒为新装）

### 2.1 安装

```bash
# repo 同 §1.1 路线 B（elastic-9.x.repo），然后：
dnf install -y filebeat       # 9.5.x
```

离线机：`dnf download filebeat --resolve` 拿全依赖 rpm 后拷过去 `dnf install ./*.rpm`。

### 2.2 配置（两处现场改）

```bash
cp <repo>/deploy/filebeat/filebeat.yml /etc/filebeat/filebeat.yml
vi /etc/filebeat/filebeat.yml
```

- **输出**：`output.logstash.hosts` 改成加工层实际地址（端口与 `10-input.conf` 同值）：
  `hosts: ["logstash-01:5045", "logstash-02:5045"]` → 现场如 `["<LOGSTASH_HOST>:5045"]`；多节点保留 `loadbalance: true`
- **日志路径**：每组 `paths` 是绝对路径 glob。DEV 三条默认 `/mes/dev/systemlogs/*FABsrv.log*` /
  `*COMM_RCVsrv*.log*` / `*COMM_SNDsrv*.log*`，日志盘挂别处就换前缀，改完 `ls` 核对真实文件名（Linux 区分大小写）
- UAT 两组 input 整组注释着，放开时逐行去 `#`（`ENV: UAT` 和 input id **别改**，id 一改 registry 从头重读）

### 2.3 自检

```bash
filebeat test config -c /etc/filebeat/filebeat.yml    # Config OK（-c 不能省）
filebeat test output -c /etc/filebeat/filebeat.yml    # talk to server... OK
```

起服务前 `du -sh` 估日志目录：`ignore_older: 0` + `tail_files: false` 首启会把现存滚动件全部回灌（行文档按 _id 幂等，不算重复；纯文本行例外）。

### 2.4 RHEL 系统项

```bash
# SELinux：filebeat 读非标准路径的日志目录（日志目录若在 /var/log 下可跳过）
dnf install -y policycoreutils-python-utils
semanage fcontext -a -t var_log_t "/mes/dev/systemlogs(/.*)?"
restorecon -Rv /mes/dev/systemlogs

# 文件句柄（要求 ulimit -n ≥ 4096）
systemctl edit filebeat      # 写入：
#   [Service]
#   LimitNOFILE=65536
```

### 2.5 起服务 + 验证

```bash
systemctl daemon-reload && systemctl enable --now filebeat
```

判据只有一条：`/var/lib/filebeat/registry` 的 mtime 在动。不动就核 `paths` 与 `ls` 的真实文件名；
mtime 动但加工层 `events.in` 不涨，回 §2.3 看 `test output`。

**改配置前**备份 registry：`tar czf /root/filebeat-registry-$(date +%F).tgz /var/lib/filebeat`；
多台业务机滚动升级，不要一次全停。

## 3. 规则热改（加工机，不重启进程）

```bash
vi /etc/logstash-mes/fabviewer.yaml            # 加/改 msg_kinds 规则
python3 /etc/logstash-mes/tools/render_msgkinds.py   # 重渲染 30-msgkind.conf（已是成品，首次不用跑）
# logstash.yml 的 config.reload.automatic: 3s 自动生效
```

## 4. 验证清单与常见问题

| 检查点 | 命令 | 期望 |
|---|---|---|
| 加工层管道 | `curl -s localhost:9600/_node/stats/pipelines \| jq '.pipelines["mes-lines"].events'` | in/out 同步涨 |
| 落库 | `curl -s -u "$AUTH" "$OS/dev-mes-log-line-read/_count"` | 在涨 |
| DLQ | `ls /var/lib/logstash/dead_letter_queue/main/ 2>/dev/null` | 空；有文件 = 有写失败（映射不符/字段类型错） |
| 采集进度 | `ls -l --time-style=full-iso /var/lib/filebeat/registry/filebeat/log.json` | mtime 在动 |

| 症状 | 处置 |
|---|---|
| filtered 涨、out 恒 0、DLQ 空 | 守门哨静默 drop：核 filebeat.yml 的 `system.name` 常量是否 `MES-300Works` |
| _id/索引名成字面量 `%{[@metadata][...]}` | ruby 滤器崩、line_id 没拼上：核 cidrs 是否命中业务机 IP、LOG_FINGERPRINT 是否有值 |
| filebeat 连不上 5045 | 加工机 `firewall-cmd --list-ports`；`test output` 定位 |
| 读别名查询 400 index_closed | 别名下有索引被 close：重开或摘除；查询带 `ignore_unavailable=true` 绕过 |
| 日志行没落对应日期的索引 | 索引按行内 LOG_TIME 落天；纯文本行（解析不出）按采集时刻落当天，重采会变 |
