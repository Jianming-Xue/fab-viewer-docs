# 部署特别提醒（REMINDERS）

> 配套文档：[DEPLOY-DOCKER.md](DEPLOY-DOCKER.md)（Docker 版）、[DEPLOY-REDHAT.md](DEPLOY-REDHAT.md)（RHEL 裸机版）。
> 本文是两份文档里最容易被忽略、出了问题最难排查的几条，上线前逐条过一遍。

## 安全纪律

1. **真实地址与凭据永不进仓库**：文档/配置一律 `<OS_HOST>:<OS_PORT>`、`<OS_USER>:<OS_PASSWORD>` 占位符。
   裸机凭据放 logstash-keystore；Docker 放 compose 环境变量（该文件留在部署机本地）。

## 必须做对的点（做错 = 静默失败，无报错）

2. `pipeline.ecs_compatibility: disabled` 不能省，且只能写在 logstash.yml / pipelines.yml ——
   行索引模板 `dynamic: strict`，ECS 开着会补元字段，**整篇写入失败**。
3. 输出插件必须是 **logstash-output-opensearch 2.x**（1.x 不支持 Logstash 8+）；Docker 构建装插件
   默认 1G 堆会 OOM，Dockerfile 已固化 `LS_JAVA_OPTS=-Xmx2g`，别去掉。
4. filebeat 的 `system.name` 常量必须与守门哨判据一致（`MES-300Works`）—— 不一致时守门哨**静默 drop
   全部事件**，症状是 logstash filtered 涨、out 恒 0、DLQ 空无报错。
5. `40-derive-fields.conf` 的 `cidrs` 必须能命中业务机（或容器）IP —— 取不到 HOSTIP 则 line_id 拼不全，
   所有行文档 _id 退化、互相覆盖。
6. 索引前缀（`prefix = 'dev-'`）必须与 OS 侧模板 pattern、ISM pattern、读别名**三处一致**，换前缀三处同步改。

## 离线环境（air-gapped）

7. Docker：**带插件的 logstash 镜像必须在联网机构建**（构建过程要联网装插件），`docker save` 打包、
   离线机 `docker load`，离线机**不要**再执行 `docker compose build`。
8. RHEL：logstash 插件离线装用 `logstash-plugin prepare-offline-pack`；filebeat 离线装用 `dnf download --resolve`。

## 行为语义（容易误判为 bug）

9. **上线顺序：存储 → 加工 → 采集**。加工层没起来就开采集，事件会堵在 filebeat 内存队列。
10. 行文档按行内 LOG_TIME 落当天的索引；重采按 _id 幂等覆盖、不产生重复。**唯一例外**：解析不出的
    纯文本行 LOG_TIME=采集时刻，每次重采都会生成新 _id、落当天索引。
11. 读别名下若有索引被手动 close，**整个别名的查询都会 400**（不只查不到那天）——重开或摘除该索引；
    查询带 `ignore_unavailable=true` 可临时绕过。
12. filebeat 的 input `id` 一律别改：改了等于换采集器，registry 从头重读；改配置前先备份 registry。
13. filebeat 日志里的 `async client does not support "ttl"` warn 无害，可忽略。

## RHEL 特有

14. 加工机 firewalld 放行 `5045/tcp`；采集机日志目录在非标准路径时需 SELinux fcontext
    （`var_log_t`）+ restorecon，否则 filebeat 读不到、registry 不动。
15. filebeat 句柄：systemd override `LimitNOFILE=65536`（README 要求 ulimit -n ≥ 4096）。
