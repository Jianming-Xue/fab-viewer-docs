# MES 日志链路 · RHEL 裸机部署

> 适用：RedHat 8/9（dnf / systemd）。Docker 单机见 [DEPLOY-DOCKER.md](DEPLOY-DOCKER.md)，全目录说明见 [README.md](README.md)。
> 真实地址与凭据只写在部署机本地文件；仓库里用 `os-node-01:9200`、`fvdev` 等示例值占位。

```
业务机 filebeat（每台一份，恒为新装）──5045──→ 加工机 logstash（mes-lines 管道）──https──→ OpenSearch
```

**上线顺序：存储 → 加工 → 采集** —— 加工层没起来就开采集，事件会堵在 filebeat 内存队列。命令均以 `root` / `sudo` 执行，`<repo>` 指 clone 下来的仓库目录。

## 0. 两条路线

| 组件 | 路线 A：已有组件 + 部署（主线） | 路线 B：新装组件 + 部署 |
|---|---|---|
| OpenSearch | 集群已在，只装模板 + ISM（[README.md](README.md) 存储层） | 按官方文档新装 2.x/3.x，`_cluster/health` green 后同样装模板 + ISM |
| Logstash | 实例已在（9.x），**追加** mes-lines 管道，不覆盖已有配置 | rpm 新装，主配置整份用仓库版 |
| Filebeat | 恒为新装（第 2 节） | 同左 |

## 1. 加工层 Logstash（加工机）

### 1.1 安装与版本

路线 A：先核版本，已有实例的任何配置（别的管道、`logstash.yml`、`pipelines.yml` 既有条目）**一个字不动**。

```bash
/usr/share/logstash/bin/logstash --version    # 期望 9.x
```

路线 B：

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
dnf install -y logstash        # 9.5.x，rpm 自带 JDK
cp <repo>/deploy/logstash/conf/logstash.yml /etc/logstash/logstash.yml
cp <repo>/deploy/logstash/conf/jvm.options /etc/logstash/jvm.options   # 堆大小按机器调
```

### 1.2 输出插件（两条路线都要，必须 2.x，1.x 不支持 Logstash 8+）

```bash
/usr/share/logstash/bin/logstash-plugin install logstash-output-opensearch
/usr/share/logstash/bin/logstash-plugin list --verbose | grep logstash-output-opensearch   # 期望 (2.x.y
```

离线机先在联网机 `logstash-plugin prepare-offline-pack logstash-output-opensearch` 生成离线包，再 `logstash-plugin install file:///tmp/<包名>.zip`。

### 1.3 拷文件（最小集）

```bash
mkdir -p /etc/logstash-mes/pipeline /etc/logstash-mes/tools
cp <repo>/deploy/logstash/pipeline/*.conf              /etc/logstash-mes/pipeline/
cp <repo>/deploy/logstash/fabviewer.yaml                /etc/logstash-mes/
cp <repo>/deploy/logstash/tools/render_msgkinds.py      /etc/logstash-mes/tools/
cp <repo>/deploy/logstash/patterns/mes                  /etc/logstash/patterns/mes
chown -R logstash:logstash /etc/logstash-mes
```

`/etc/logstash/patterns` 已有同名 `mes` 就改名（如 `mes-fab`），并同步改 `20-parse.conf` 两处 `patterns_dir`。**首次部署不需要 Python** —— `30-msgkind.conf` 已是成品；`fabviewer.yaml` 与渲染脚本只是以后改标签规则用。

### 1.4 现场化 5 项

| # | 位置 | 仓库值 → 现场值 |
|---|---|---|
| 1 | `50-output.conf` 第 23 行 `hosts` | `["https://os-node-01:9200", ...03]` → 现场 OS 地址，几个节点写几个；公有 CA 证书保持 `ssl` / 校验开，自签按第 30 行注释带 `cacert` |
| 2 | 同上第 24–25 行 `user` / `password` | `fvdev` / `fvdev` → 真实账号密码。**按仓库口径写在配置文件里，不读环境变量、不用 keystore**；只改本地副本、真值不进仓库，文件权限设 `640 logstash:logstash` |
| 3 | `10-input.conf` 第 15 行 `port` | `5045` 默认即用；换值须与所有采集机的 filebeat 输出同值 |
| 4 | `40-derive-fields.conf` 第 102 行 `cidrs` | `['10.0.0.0/8']` → 按现场内网网段，如 `['10.0.0.0/8','172.16.0.0/12','192.168.0.0/16']`；命中不到业务机 IP 则 `HOSTIP` 为空、行进不了流 |
| 5 | 同文件第 142 行 `prefix` | `'dev-'` 默认即用；须与 [README.md](README.md) 存储层装入的模板 / ISM pattern、读别名一致 |

换前缀只改第 5 项那一处，另 3 处文字顺手同步：`40-derive-fields.conf` 第 127 行注释、`50-output.conf` 第 4 行举例、[README.md](README.md) 的必改表。

### 1.5 追加管道声明与实例设置

`/etc/logstash/pipelines.yml` **末尾追加**（已有条目一个字不动）：

```yaml
- pipeline.id: mes-lines
  path.config: "/etc/logstash-mes/pipeline/*.conf"
  pipeline.workers: 4
  pipeline.batch.size: 500
  pipeline.ecs_compatibility: disabled
  queue.type: persisted
```

`pipeline.ecs_compatibility: disabled` 不能省：行索引模板 `dynamic: strict`，开着 ECS 会补元字段、整篇写入失败。

实例级设置：路线 A 逐项确认 `/etc/logstash/logstash.yml`、**缺才加**（整实例生效，会影响别的管道）—— `dead_letter_queue.enable: true`、`config.reload.automatic: true`、`config.reload.interval: 3s`；路线 B 第 1.1 节已整份用仓库版，无需再动。

### 1.6 系统项、校验、启动

```bash
firewall-cmd --permanent --add-port=5045/tcp && firewall-cmd --reload   # 加工机放行 beats 口
sudo -u logstash /usr/share/logstash/bin/logstash -t                    # Configuration OK
systemctl enable --now logstash
curl -s localhost:9600/_node/stats/pipelines | jq '.pipelines["mes-lines"].events'
```

路线 A 重启会断该实例上别的管道几秒，多节点加工层逐个重启。

## 2. 采集层 Filebeat（每台业务机一份，恒为新装）

### 2.1 安装

```bash
dnf install -y filebeat        # 9.5.x，repo 同第 1.1 节路线 B
```

离线机：`dnf download filebeat --resolve` 拿全依赖 rpm 后 `dnf install ./*.rpm`。

### 2.2 配置（两处现场改）

```bash
cp <repo>/deploy/filebeat/filebeat.yml /etc/filebeat/filebeat.yml
vi /etc/filebeat/filebeat.yml
```

- **输出**：`output.logstash.hosts` 示例 `["logstash-01:5045", "logstash-02:5045"]` → 现场加工层地址，端口与 `10-input.conf` 同值；多节点保留 `loadbalance: true`。
- **日志路径**：每组 `paths` 是绝对路径 glob，不要求固定挂点。默认 `/home/ad300w/systemlog/` 下 `UAT_MBX.<族>srv_log*`（当前启用 FAB / QUERY / LIST / OCAP / XSITE 5 个业务族，其余候选族在组内注释、按需放开）与 `*COMM_RCVsrv*.log*` / `*COMM_SNDsrv*.log*`；日志盘挂别处只换目录前缀，切 Mailbox 只换文件名里 `UAT_MBX` 那一段（**Mailbox 名与服务族之间是点，不是下划线**）。改完用 `ls` 核对真实文件名（Linux 区分大小写）。
- **DEV 两组整组注释**，放开时逐行去掉行首 `#`；`ENV: DEV` 和 input id **别改**（id 一改 registry 从头重读）。DEV / UAT 共用同一目录，业务族靠 `UAT_MBX.` / `DEV_MBX.` 区分；**COMM 两族 glob 完全相同，同目录同时启用两套会把同一批文件各采一遍**，只留一套 COMM 组或让现场分目录。

### 2.3 自检

```bash
filebeat test config -c /etc/filebeat/filebeat.yml    # Config OK（-c 不能省）
filebeat test output -c /etc/filebeat/filebeat.yml    # talk to server... OK
```

起服务前 `du -sh` 估日志目录：`ignore_older: 0` + `tail_files: false` 首启会把现存滚动件全部回灌，行文档按 `_id` 幂等覆盖，不算重复（纯文本行例外）。

### 2.4 RHEL 系统项

```bash
# SELinux：日志目录在 /home 下，非标准日志路径要打标签
dnf install -y policycoreutils-python-utils
semanage fcontext -a -t var_log_t "/home/ad300w/systemlog(/.*)?"
restorecon -Rv /home/ad300w/systemlog

# 文件句柄（要求 ulimit -n ≥ 4096）
systemctl edit filebeat      # 写入 [Service] / LimitNOFILE=65536
```

### 2.5 起服务 + 验证

```bash
systemctl daemon-reload && systemctl enable --now filebeat
```

判据只有一条：`/var/lib/filebeat/registry` 的 mtime 在动。不动就核 `paths` 与 `ls` 的真实文件名；mtime 动但加工层 `events.in` 不涨，回第 2.3 节看 `test output`。**改配置前**备份 registry：`tar czf /root/filebeat-registry-$(date +%F).tgz /var/lib/filebeat`；多台业务机滚动升级，不要一次全停。

## 3. 规则热改（加工机，不重启进程）

```bash
vi /etc/logstash-mes/fabviewer.yaml
python3 /etc/logstash-mes/tools/render_msgkinds.py          # 重渲染 30-msgkind.conf
python3 /etc/logstash-mes/tools/render_msgkinds.py --check  # 校生成物一致
# config.reload.automatic: 3s 自动生效
```

## 4. 验证清单与常见问题

| 检查点 | 命令 | 期望 |
|---|---|---|
| 加工层管道 | `curl -s localhost:9600/_node/stats/pipelines \| jq '.pipelines["mes-lines"].events'` | in / out 同步涨 |
| 落库 | `curl -s -u '<账号>:<密码>' "https://<OS_HOST>:<OS_PORT>/dev-mes-log-line-read/_count"` | 文档数在涨 |
| DLQ | `ls /var/lib/logstash/dead_letter_queue/main/ 2>/dev/null` | 空；有文件 = 写入被拒 |
| 采集进度 | `ls -l --time-style=full-iso /var/lib/filebeat/registry/filebeat/log.json` | mtime 在动 |

| 症状 | 处置 |
|---|---|
| `filtered` 涨、`out` 恒 0、DLQ 空 | 守门哨静默 drop：核 `filebeat.yml` 的 `system.name` 是否 `MES-300Works` |
| `_id` / 索引名成字面量 `%{[@metadata][...]}` | ruby 滤器崩、行身份串没拼上：核 `cidrs` 是否命中业务机 IP、`LOG_FINGERPRINT` 是否有值 |
| filebeat 连不上 5045 | 加工机 `firewall-cmd --list-ports`；`test output` 定位 |
| 读别名查询 400 `index_closed` | 别名下有索引被 close：重开或摘除；查询带 `ignore_unavailable=true` 绕过 |
| 日志行没落对应日期的索引 | 索引按行内 `LOG_TIME` 落天；解析不出的纯文本行按采集时刻落当天，重采会变 |
