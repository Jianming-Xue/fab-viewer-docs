# filebeat · 采集层部署

每台业务机一份配置，本层是**新装**。方案：改输出与日志路径 → 拷配置自检 → 起服务 → 看 registry。

**当前配置**：只采 DEV（`ENV: DEV`）的 3 类日志 `*FABsrv.log*` / `*COMM_RCVsrv*.log*` / `*COMM_SNDsrv*.log*`，默认目录 `/mes/dev/systemlogs/`；UAT 两组 input 整组注释。输出到 `logstash-01:5045` / `logstash-02:5045`。例：`/mes/dev/systemlogs/MESFABsrv.log` 里的一行，被采成带 `ENV=DEV` 的事件送到 5045。

上线顺序是**存储 → 加工 → 采集**：加工层管道没起来之前别开采集，否则事件会堵在内存队列里。

## 1. 改配置

**① 输出**：`filebeat.yml` 末尾 `output.logstash.hosts` 改成现场加工层地址，端口必须与 `10-input.conf` 同值。

```yaml
hosts: ["logstash-01:5045", "logstash-02:5045"]   # 例：两个加工节点
```

**② 日志路径**：每组 `paths` 是绝对路径 glob，**不要求挂在 `/mes` 下**，日志盘挂哪儿就写哪儿。例：日志实际在 `/data/meslogs/dev/systemlogs/`，生效的 3 条（前两条在 `mes-dev-plain`、第三条在 `mes-dev-comm-snd`）按所在组改成

```yaml
- /data/meslogs/dev/systemlogs/*FABsrv.log*
- /data/meslogs/dev/systemlogs/*COMM_RCVsrv*.log*
- /data/meslogs/dev/systemlogs/*COMM_SNDsrv*.log*
```

`ENV` 只是事件字段，与目录名不必同名；组内注释掉的服务族清单、UAT 组的 `paths` 一并换前缀，免得以后放开时还指向旧目录。改完用 `ls` 核对真实文件名（Linux 区分大小写）。

**③ 放开 UAT**：UAT 两组 `mes-uat-plain` / `mes-uat-comm-snd` 整组注释着，逐行去掉行首 `#` 即可启用，`ENV: UAT` 和 id 别改。注意 `mes-uat-plain` 里列了 10 条路径，比 DEV 同组生效的 2 条多 8 个服务族，把不采的行删掉。改完先跑第 3 步的 `test config`。

`input id` 一律别改：改了等于换采集器、registry 从头重读。

## 2. 一台机器采多个环境

同一台业务机上 DEV 和 UAT 的日志都存在时，**四组 input 同时启用**即可 —— DEV 两组保持原样，UAT 两组取消注释。配置里已经把 UAT 那两组写好了：

| input id | `ENV` | `paths` 前缀 | 多行合并 |
|---|---|---|---|
| `mes-dev-plain` | DEV | `/mes/dev/systemlogs/` | 否 |
| `mes-dev-comm-snd` | DEV | 同上 | 是 |
| `mes-uat-plain` | UAT | `/mes/uat/systemlogs/` | 否 |
| `mes-uat-comm-snd` | UAT | 同上 | 是 |

例：这台机器上 DEV 日志在 `/data/meslogs/dev/systemlogs/`、UAT 在 `/data/meslogs/uat/systemlogs/`，就按第 1 节 ② 把四组各自的 `paths` 换掉，`ENV` 仍是 DEV / UAT —— 两套事件靠 `ENV` 区分，落到同一个管道里不会混。

还要加第三个环境时，**照 DEV 那一对整组复制两组**，只改三处：`id`（换个不重复的名字，如 `mes-sit-plain`）、`fields.ENV`、每组 `paths` 前缀。`COMM_SND` 那组必须连 `parsers` 一并复制，否则报文不合并；id 重复会让两组共用一份 registry、互相抢读。

## 3. 拷 + 自检

```bash
sudo cp filebeat.yml /etc/filebeat/filebeat.yml
sudo filebeat test config -c /etc/filebeat/filebeat.yml     # 期望 Config OK
sudo filebeat test output -c /etc/filebeat/filebeat.yml     # 期望 talk to server... OK
```

`-c` 不能省，不带它读的是默认路径。起服务前先用 `du -sh` 估一下日志目录大小：`ignore_older: 0` + `tail_files: false` 会让首启把现存滚动件全部回灌；`ulimit -n` 至少 4096（用 systemd override 设 `LimitNOFILE=65536`）。

## 4. 起服务 + 验证

```bash
sudo systemctl enable --now filebeat
```

判据只有一条：`/var/lib/filebeat/registry` 的 mtime 在动。不动就核 `paths` 与 `ls` 出来的真实文件名；mtime 动但加工层 `events.in` 不涨，回第 3 步看 `test output`。

**改配置前**先备份 registry：`sudo tar czf /root/filebeat-registry-$(date +%F).tgz /var/lib/filebeat`；多台机器滚动升级，不要一次全停。
