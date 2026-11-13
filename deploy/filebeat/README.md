# filebeat · 采集层部署（每台业务机一份）

本层是**新装**（业务机上原本没有 Filebeat）。三步：**改 1 行 → 拷 + 自检 → 起服务 + 验证**。

当前只采 **DEV 开发环境**（`ENV: DEV`）的 3 类日志：`*FABsrv.log*` / `*COMM_RCVsrv*.log*` / `*COMM_SNDsrv*.log*`；UAT 两组 input（`ENV: UAT`）与其余服务族在 `filebeat.yml` 里已注释，按需放开。日志目录 DEV → `/mes/dev/systemlogs/`、UAT → `/mes/uat/systemlogs/`（ENV 值大写，目录名小写）；装之前核一下现场实际目录名。输出目标 `logstash-01:5045` / `logstash-02:5045`。

---

## 第一步：改 1 行

| 文件 | 位置 | 改成什么 |
|---|---|---|
| `filebeat.yml` | 末尾「输出」段 | `hosts` → 现场的加工层地址（多节点有几个写几个）。**端口必须与 logstash 侧 `10-input.conf` 同值** |

其余整份照拷。只有这两种机器要多改：

| 情况 | 改哪 |
|---|---|
| 日志盘没挂在 `/mes` | 各组 `paths` 的前缀 |
| 要采 UAT 环境 | 把 `filebeat.yml` 里 UAT 两组 input 逐行取消注释，并按需放开服务族路径 |

**当前生效的 input**（`id` 别随手改 —— `id` 变了等于换了一个采集器，registry 会另起一份、从头重读）：

| input id | 采什么 | 多行合并 | 状态 |
|---|---|---|---|
| `mes-dev-plain` | DEV 的 `*FABsrv.log*` / `*COMM_RCVsrv*.log*` | 否 | 启用 |
| `mes-dev-comm-snd` | DEV 的 `*COMM_SNDsrv*.log*` | **是** | 启用 |
| `mes-uat-plain` / `mes-uat-comm-snd` | UAT 对应两类 | 同左 | 整组注释 |

---

## 第二步：拷 + 自检

```bash
sudo cp filebeat.yml /etc/filebeat/filebeat.yml
sudo vi /etc/filebeat/filebeat.yml                          # 改上面那行 hosts

sudo filebeat test config -c /etc/filebeat/filebeat.yml     # 期望 Config OK
sudo filebeat test output -c /etc/filebeat/filebeat.yml     # 期望 talk to server... OK
```

`-c` 不能省 —— 不带它读的是默认路径，可能跟你手上这份不是同一个文件。

**起服务之前先做两件事**：

1. **估数据量** —— `du -sh /mes/*/systemlogs/`。配置里 `ignore_older: 0` + `tail_files: false` 是**有意的**：首次启动会把现存的滚动件**全部回灌**。历史量大时加工层会先吃到一波集中写入，必要时先开一个环境、稳了再开另一个。
2. **放开文件句柄** —— 要求 `ulimit -n ≥ 4096`，官方 systemd unit 不一定给。加一段覆盖：

   ```ini
   # /etc/systemd/system/filebeat.service.d/override.conf
   [Service]
   LimitNOFILE=65536
   ```

   然后 `sudo systemctl daemon-reload`。

---

## 第三步：起服务 + 验证

```bash
sudo systemctl enable --now filebeat
```

**只有一条判据：`registry` 的 mtime 在不在动。**

| 现象 | 含义 | 下一步 |
|---|---|---|
| mtime 在爬 | 真在采 | —— |
| mtime 不动 | 路径没匹配上 | 核 `paths` 与 `ls /mes/*/systemlogs/` 里的真实文件名（Linux 区分大小写） |
| mtime 在动，但加工层 `events.in` 不涨 | 采到了、送不出去 | 回第二步看 `test output` |

---

## 常见故障

| 现象 | 原因 | 处置 |
|---|---|---|
| **漏行**（滚动之后丢一段） | `close.on_state_change.renamed` 被设成 `true`，改名即关 harvester | 必须 `false`；文件身份走 9.x 默认的 fingerprint，改名后指纹不变、继续读完 |
| 采到归档件（`.log.1.gz`） | 通配把压缩件匹配进来了 | `prospector.scanner.exclude_files` 里要有压缩与改名两类 |
| `HOSTIP` 为空、锁流三元组缺一段 | `add_host_metadata.netinfo.enabled` 是 `false` | 改 `true`。这个开关管的就是往事件里带不带 `host.ip` |
| `too many open files` | `harvester_limit` 或 `ulimit -n` 太小 | 见第二步第 2 条 |
| 重启后重复投递 | registry flush 后重读（正常） | 不用管：行文档按 `LOG_LINE_ID` 做 `_id`，重复投递覆盖同一篇。**纯文本行除外** —— 它取不到行首时间戳、时间改用采集时刻，重投会多出一篇 |
| 采集明显滞后 | 文件滚太快，harvester 跟不上 | 确认 `check_interval: 5s`，再看是不是被 `harvester_limit` 排队挡住 |

**升级与回滚**：动之前先 `sudo tar czf /root/filebeat-registry-$(date +%F).tgz /var/lib/filebeat`。丢了 registry 会**全量重读**（不丢数据，靠幂等覆盖，但会灌一批重复事件）。多台机器**滚动升级**，不要一次全停 —— 采集是幂等的（**纯文本行除外**，会被重复投递）。
