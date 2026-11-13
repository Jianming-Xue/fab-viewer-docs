# MES 日志链路 · Docker 部署文档

> 适用：单机 Docker 部署。裸机 RHEL 版见 [DEPLOY-REDHAT.md](DEPLOY-REDHAT.md)。
> 配置源：[fab-viewer-docs deploy/](https://github.com/Jianming-Xue/fab-viewer-docs/tree/main/deploy)
>
> **本文所有 `<占位符>` 由现场提供，真实地址/凭据只写在部署机的本地文件里（docker-compose.yml 环境变量），不进文档、不外发。**

## 1. 架构与目录

```
MES 日志文件 → filebeat 容器 ──host.docker.internal:5045──→ logstash 容器 ──https──→ OpenSearch 集群
                (采集层)                                     (加工层 mes-lines 管道)      (行文档 dev-mes-log-line-*)
```

```
<deploy-dir>/
├── logstash/                        # 加工层
│   ├── Dockerfile                   # ★本地维护：logstash:9.5.5 + logstash-output-opensearch 2.x
│   ├── docker-compose.yml           # ★本地维护：5045/9600 映射、OS 凭据环境变量、logstash-data 卷
│   ├── conf/
│   │   ├── logstash.docker.yml      # ★本地维护：仓库 logstash.yml 的容器化版（api 绑 0.0.0.0、去 path.logs）
│   │   ├── logstash.yml / pipelines.yml / jvm.options   # 仓库原样（pipelines.yml 原样挂载生效）
│   ├── pipeline/*.conf              # 仓库原样，仅 50-output.conf 现场化（见 §2）
│   ├── patterns/mes                 # 仓库原样
│   ├── fabviewer.yaml               # 仓库原样：标签规则源，热改入口
│   └── tools/render_msgkinds.py     # 仓库原样：把 fabviewer.yaml 渲染成 30-msgkind.conf
└── filebeat/                        # 采集层
    ├── docker-compose.yml           # ★本地维护：filebeat:9.5.6、systemlogs/data 挂载
    ├── filebeat.yml                 # 仓库原样，仅输出段现场化（见 §2）
    ├── systemlogs/                  # MES 日志放这里（容器内挂为 /mes/dev/systemlogs）
    └── data/                        # registry 持久化；删掉 = 下次全量重采
```

★ = 仓库没有的本地 Docker 封装（仓库只提供裸机 systemd 方案）；其余文件与仓库一致。

## 2. 现场化改动（相对仓库原版，共 3 处，文件内均有【现场改】/【Docker 部署改】标注）

| # | 文件 | 原版 | 现场值 | 原因 |
|---|---|---|---|---|
| 1 | `logstash/pipeline/50-output.conf` | hosts 三节点示例、user/password `fvdev` | `hosts => ["https://<OS_HOST>:<OS_PORT>"]`；`user => "${OS_USER}"` / `password => "${OS_PASSWORD}"`（真实值写在 docker-compose.yml 环境变量） | 真值不进配置文件；证书若为公有 CA 签发则 ssl 校验保持开、无需 cacert，自签证书见文件内注释 |
| 2 | `logstash/pipeline/40-derive-fields.conf` | `cidrs = ['10.0.0.0/8']` | RFC1918 三段 `['10.0.0.0/8','172.16.0.0/12','192.168.0.0/16']` | 命中 filebeat 容器的 172.x 地址，HOSTIP 才取得到 |
| 3 | `filebeat/filebeat.yml` 输出段 | `hosts: ["logstash-01:5045","logstash-02:5045"]` + `loadbalance: true` | `["host.docker.internal:5045"]`，删 loadbalance | Docker Desktop 下容器经宿主转发；单实例无需负载均衡 |

不需要改的：端口 5045（默认即用）、索引前缀 `prefix = 'dev-'`（上游默认已是）。
索引前缀必须与 OS 侧已装入的模板/ISM pattern、读别名一致（本现场 `dev-mes-log-line-*`）。

## 3. 镜像准备（离线导入方案）

部署机不能访问外网时，镜像在**联网 Docker 机**上准备好、打包传过去。注意：logstash 的
Dockerfile 构建过程要联网装输出插件，所以**构建也必须在联网机完成**，离线机只做 load。

```bash
# ============ 联网机 ============
docker pull logstash:9.5.5             # 基础镜像（重建用，可选打包）
docker pull elastic/filebeat:9.5.6

# 构建 logstash 加工层镜像（Dockerfile 在封装目录 logstash/ 下；
# 装插件默认 1G 堆会 OOM，Dockerfile 已固化 LS_JAVA_OPTS=-Xmx2g，并校验插件为 2.x）
cd <deploy-dir>/logstash && docker build -t logstash-mes:9.5.5 .

# 打包（-o 输出 tar；基础镜像仅在以后要在离线机重新 build 时才需要）
docker save logstash-mes:9.5.5      -o logstash-mes-9.5.5.tar
docker save elastic/filebeat:9.5.6  -o filebeat-9.5.6.tar
docker save logstash:9.5.5          -o logstash-9.5.5.tar

# 传到离线部署机（scp / U盘 均可）
scp *.tar <user>@<offline-host>:/tmp/images/

# ============ 离线部署机 ============
docker load -i /tmp/images/logstash-mes-9.5.5.tar
docker load -i /tmp/images/filebeat-9.5.6.tar
docker load -i /tmp/images/logstash-9.5.5.tar        # 若打包了基础镜像
docker images | grep -E 'logstash-mes|filebeat|logstash'   # 核对三个镜像就位
```

离线机上**不需要再执行 `docker compose build`**（镜像已带插件），直接进入 §4。
版本升级时：联网机改 Dockerfile 里基础镜像版本 → 重新 build/save → 离线机 load → `docker compose up -d` 重建容器。

## 4. 首次部署步骤

前提：OS 侧模板与 ISM 已装入（一次性，见 §8；删索引不影响它们）。

```bash
# 加工层（离线机镜像已 load 时跳过 build）
cd <deploy-dir>/logstash
docker compose build                                              # 仅联网机/镜像未导入时需要
docker compose run --rm logstash /usr/share/logstash/bin/logstash -t   # 期望 Configuration OK
docker compose up -d
curl -s localhost:9600/_node/stats/pipelines                      # mes-lines 管道出现即就绪

# 采集层
cd ../filebeat
docker compose up -d
docker logs filebeat 2>&1 | grep -i established                   # 期望 Connection ... established
```

## 5. 验证判据

| 位置 | 命令 | 判据 |
|---|---|---|
| filebeat | `docker logs filebeat` | `Connection to backoff(async(tcp://host.docker.internal:5045)) established` |
| filebeat | 监控日志 `events.added/done` | 相等 = 全部读完且 ack |
| logstash | `curl -s localhost:9600/_node/stats/pipelines \| jq '.pipelines["mes-lines"].events'` | `in` 与 `out` 同步涨 |
| OS | `GET https://<OS_HOST>:<OS_PORT>/dev-mes-log-line-read/_count`（带凭据） | 文档数在涨 |
| DLQ | `docker exec logstash-mes ls /usr/share/logstash/data/dead_letter_queue/main/` | 空；有文件 = 有写失败事件 |

## 6. 日常运维

```bash
# 起停 / 日志
docker compose -f logstash/docker-compose.yml {up -d|down|logs -f}
docker compose -f filebeat/docker-compose.yml {up -d|down|logs -f}

# 改标签规则（不重启、不改代码）
vi logstash/fabviewer.yaml                 # 加/改 msg_kinds 规则
python3 logstash/tools/render_msgkinds.py  # 重渲染 30-msgkind.conf（挂载目录内即生效）
# logstash config.reload.automatic: 3s 自动重载，无需重启

# 全量重采（数据从零）
cd filebeat && docker compose stop filebeat
rm -rf data/registry
docker compose start filebeat

# 新日志接入
cp <日志文件> filebeat/systemlogs/          # 文件名须匹配 *FABsrv.log* / *COMM_RCVsrv*.log* / *COMM_SNDsrv*.log*
```

## 7. 完全重新部署（清空重来）

```bash
# 1) 停删容器、卷、网络、本地构建镜像（基础镜像保留复用）
docker rm -f logstash-mes filebeat
docker volume rm logstash_logstash-data
docker network rm logstash_default filebeat_default
docker rmi logstash-mes:9.5.5

# 2) 清空两目录（systemlogs 先备份！），拷入新仓库 deploy/{filebeat,logstash}
git clone --depth 1 https://github.com/Jianming-Xue/fab-viewer-docs /tmp/fab-viewer-docs
cp -R /tmp/fab-viewer-docs/deploy/{filebeat,logstash} 的内容 → 两目录
mkdir -p filebeat/{systemlogs,data}

# 3) 按 §2 做 3 处现场化，按 §1 重建 4 个 Docker 封装文件
#    （Dockerfile、logstash/docker-compose.yml、logstash/conf/logstash.docker.yml、filebeat/docker-compose.yml）

# 4) 按 §3 联网机构建镜像并导入（离线机），按 §4 构建、校验、启动、验证
```

## 8. OS 侧模板与 ISM（dev- 前缀，一次性，集群级对象）

仓库 `deploy/opensearch/` 里的 json 是通用前缀 `mes-log-line-`，装入时替换成 `dev-mes-log-line-`：

```bash
OS='https://<OS_HOST>:<OS_PORT>'; AUTH='<OS_USER>:<OS_PASSWORD>'

# 行索引模板（strict 20 字段；aliases 段带读别名 dev-mes-log-line-read，
# 新索引自动挂别名，删索引后无需手工恢复）
sed 's/mes-log-line-/dev-mes-log-line-/g' 11-template-line.json \
  | curl -s -u "$AUTH" -XPUT "$OS/_index_template/dev-mes-log-line-tpl" -H 'Content-Type: application/json' -d @-

# ISM 策略：hot（0-30d 可写）→ warm（30d 只读+force merge 单段）→ cold（180d）→ delete（360d）
sed 's/mes-log-line-/dev-mes-log-line-/g' 01-ism-line-360d.json \
  | curl -s -u "$AUTH" -XPUT "$OS/_plugins/_ism/policies/dev-mes-log-line-policy" -H 'Content-Type: application/json' -d @-

# 验证
curl -s -u "$AUTH" "$OS/_index_template/dev-mes-log-line-tpl" | grep -o dev-mes-log-line-\\*
curl -s -o /dev/null -w '%{http_code}\n' -u "$AUTH" "$OS/_plugins/_ism/policies/dev-mes-log-line-policy"   # 200
```

logstash 侧 `manage_template => false`，模板全由部署侧管；删数据索引不影响模板/ISM/别名。

## 9. 已知坑（验证过的）

| 症状 | 原因 / 处置 |
|---|---|
| filebeat 起不来报 config 权限 | bind mount 属主差异，compose 已带 `--strict.perms=false` |
| 日志见 `async client does not support "ttl"` warn | 仓库配置带的 ttl 项，无害可忽略 |
| logstash filtered 涨、out 恒 0、DLQ 空 | 守门哨把事件静默 drop（system.name 不匹配）；新版仓库已修点号嵌套引用，若再现先查 filebeat.yml 的 system.name 常量 |
| _id / 索引名变成字面量 `%{[@metadata][...]}` | ruby 滤器崩（line_id 没拼上）；新版仓库已修，9600 stats 看 events 对齐 + OS 抽查 _id 格式 |
| 读别名查询 400 index_closed | 别名里有索引被手动 close；重开该索引或从别名摘除，查询带 `ignore_unavailable=true` 可绕过 |
| 构建镜像时装插件失败/OOM | Dockerfile 已固化 `LS_JAVA_OPTS=-Xmx2g`，别去掉；构建必须在联网机做（见 §3） |
