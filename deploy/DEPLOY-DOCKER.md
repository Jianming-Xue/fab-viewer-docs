# MES 日志链路 · Docker 单机部署

> 适用：本机 Docker / Docker Desktop 单机部署。RHEL 裸机见 [DEPLOY-REDHAT.md](DEPLOY-REDHAT.md)，全目录说明见 [README.md](README.md)。
> 真实地址与凭据只写在部署机本地文件；仓库里用 `os-node-01:9200`、`fvdev` 等示例值占位。

## 1. 链路与目录

```
MES 日志 → filebeat 容器 ──host.docker.internal:5045──→ logstash 容器 ──https──→ OpenSearch
            采集层                                    加工层 mes-lines           行索引 dev-mes-log-line-*
```

部署机上按下面摆。`★` 是仓库里没有的 4 个本地封装，其余从 `deploy/` 拷原样：

```
<deploy-dir>/
├── docker/filebeat/docker-compose.yml        ★
├── docker/filebeat/filebeat.yml             从 deploy/filebeat/filebeat.yml 拷来，改输出段
├── docker/filebeat/systemlogs/              MES 日志放这里，容器内挂 /home/ad300w/systemlog/
├── docker/filebeat/data/                    registry 持久化；删掉 = 下次全量重采
├── docker/logstash/Dockerfile                ★
├── docker/logstash/docker-compose.yml        ★
├── docker/logstash/conf/logstash.docker.yml  ★ 仓库 logstash.yml 的容器化版
└── logstash/                                deploy/logstash/ 整目录原位（compose 用 ../../logstash/ 挂）
```

compose 用相对路径 `../../logstash/...` 直接挂仓库目录，所以 `logstash/` 不用另拷一份；只有 `filebeat.yml` 要拷到 `docker/filebeat/`，因为它的输出段必须改。

## 2. 现场化 3 处

| # | 文件 | 仓库值 | 现场改成 |
|---|---|---|---|
| 1 | `logstash/pipeline/50-output.conf` 第 23 行 `hosts` | `["https://os-node-01:9200", "https://os-node-02:9200", "https://os-node-03:9200"]` | 现场 OS 地址，几个节点写几个 |
| 2 | 同上第 24–25 行 `user` / `password` | `fvdev` / `fvdev` | 真实账号密码，**只改本地副本，不进仓库** |
| 3 | `docker/filebeat/filebeat.yml` 输出段 | `hosts: ["logstash-01:5045", "logstash-02:5045"]` + `loadbalance: true` | `["host.docker.internal:5045"]`，删 `loadbalance` |

凭据按仓库口径写在 `50-output.conf` 里，**不读环境变量、不用 keystore**；compose 里也不注入 `OS_USER` / `OS_PASSWORD`。自签证书时按 `50-output.conf` 第 30 行注释带 `cacert`，公有 CA 不用。

另外两项按现场网络核一下：

- `10-input.conf` 第 15 行端口 `5045`，filebeat 输出必须同值。
- `40-derive-fields.conf` 第 102 行 `cidrs = ['10.0.0.0/8']`：容器 IP 是 `172.x`，改成 `['10.0.0.0/8','172.16.0.0/12','192.168.0.0/16']` 才取得到 `HOSTIP`，否则行身份串拼不全、所有行文档 `_id` 退化互相覆盖。
- 同文件第 142 行 `prefix = 'dev-'` 默认即用；换前缀要与 OS 侧模板、ISM、读别名三处同步，见 [README.md](README.md) 的存储层一节。

`filebeat.yml` 的日志路径已经是 `/home/ad300w/systemlog/` 下的 `UAT_MBX.<族>srv_log*` 与 `*COMM_*srv*.log*`，日志拷进 `systemlogs/` 就采，不用改路径。业务族靠 `UAT_MBX.` / `DEV_MBX.` 前缀区分环境；COMM 两族不带环境段，**同目录别同时启用 DEV 和 UAT 的 COMM 组**，否则同一批文件采两遍。

## 3. 镜像准备（离线导入）

构建过程要联网装输出插件，所以 **build 必须在联网机完成**，离线机只做 load。

```bash
# 联网机
docker pull logstash:9.5.5 && docker pull elastic/filebeat:9.5.6
cd <deploy-dir>/docker/logstash && docker build -t logstash-mes:9.5.5 .
docker save logstash-mes:9.5.5     -o logstash-mes-9.5.5.tar
docker save elastic/filebeat:9.5.6 -o filebeat-9.5.6.tar
scp *.tar <user>@<offline-host>:/tmp/images/

# 离线机
docker load -i /tmp/images/logstash-mes-9.5.5.tar
docker load -i /tmp/images/filebeat-9.5.6.tar
docker images | grep -E 'logstash-mes|filebeat'
```

Dockerfile 固化了 `LS_JAVA_OPTS=-Xmx2g`（装插件默认 1G 堆会 OOM，别去掉），构建时还会校验插件为 2.x、装错直接失败。离线机**不要**再跑 `docker compose build`。升级时改 Dockerfile 基础镜像版本 → 重新 build/save → load → `up -d` 重建容器。

## 4. 首次部署

前提：OS 模板 + ISM 已装入（[README.md](README.md) 存储层，一次性，集群级对象）。

```bash
cd <deploy-dir>/docker/logstash
docker compose run --rm logstash /usr/share/logstash/bin/logstash -t   # Configuration OK
docker compose up -d
curl -s localhost:9600/_node/stats/pipelines | jq '.pipelines["mes-lines"].events'

cd ../filebeat && docker compose up -d
docker logs filebeat 2>&1 | grep -i established
```

首次部署**不需要 Python**：`pipeline/30-msgkind.conf` 已是成品。只有改 `MSG_KIND` 标签规则时才动 `fabviewer.yaml` + `tools/render_msgkinds.py`。

## 5. 验证判据

| 位置 | 命令 | 判据 |
|---|---|---|
| filebeat | `docker logs filebeat` | `Connection to backoff(async(tcp://host.docker.internal:5045)) established` |
| logstash | `curl -s localhost:9600/_node/stats/pipelines \| jq '.pipelines["mes-lines"].events'` | `in` 与 `out` 同步涨 |
| OS | `GET dev-mes-log-line-read/_count`（带凭据） | 文档数在涨 |
| DLQ | `docker exec logstash-mes ls /usr/share/logstash/data/dead_letter_queue/main/` | 空；有文件 = 有写入被拒 |

## 6. 日常运维

```bash
# 起停 / 日志
docker compose -f docker/logstash/docker-compose.yml {up -d|down|logs -f}
docker compose -f docker/filebeat/docker-compose.yml {up -d|down|logs -f}

# 改标签规则：不重启、不改代码
vi logstash/fabviewer.yaml
python3 logstash/tools/render_msgkinds.py        # 重渲染 30-msgkind.conf
python3 logstash/tools/render_msgkinds.py --check # 校生成物与 yaml 一致
# config.reload.automatic: 3s 自动重载

# 全量重采（数据从零）
cd docker/filebeat && docker compose stop filebeat && rm -rf data/registry && docker compose start filebeat

# 新日志接入：拷进 systemlogs/，文件名须匹配业务族或 COMM 两族的 glob
cp <日志文件> docker/filebeat/systemlogs/
```

**完全重来**：`docker rm -f logstash-mes filebeat` → 删卷 `logstash_logstash-data` 与两处 `data/`（`systemlogs` 先备份）→ 重拷 `deploy/` 两套目录 → 按第 2 节做 3 处现场化 → 按第 3、4 节重建镜像与启动。4 个 `★` 封装文件别漏。

## 7. 已知坑（实测）

| 症状 | 原因 / 处置 |
|---|---|
| filebeat 起不来报 config 权限 | bind mount 属主差异，compose 已带 `--strict.perms=false` |
| 日志见 `async client does not support "ttl"` warn | 仓库配置带的 `ttl` 项，无害可忽略 |
| `filtered` 涨、`out` 恒 0、DLQ 空 | 守门哨静默 drop：核 `filebeat.yml` 的 `system.name` 是否为 `MES-300Works` |
| 读别名查询 400 `index_closed` | 别名下有索引被手动 close；重开或摘除，查询带 `ignore_unavailable=true` 可绕过 |
| 构建镜像时装插件失败 / OOM | Dockerfile 已固化 `LS_JAVA_OPTS=-Xmx2g`；构建必须在联网机做 |
