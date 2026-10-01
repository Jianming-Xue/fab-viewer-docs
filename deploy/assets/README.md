# assets · 部署截图

三层部署说明里嵌的图，一律是**改动对照**（改哪个文件、第几行、改成什么）或**验证期望输出**。图里的路径、端口、地址是**示例值**（示例场景：别的系统已占 5044，本链路改用 5045），现场按实际填。

| 图 | 用在哪 |
|---|---|
| `filebeat-step1.png` | 采集层第一步：`output.logstash.hosts` 改哪一行 |
| `filebeat-step2.png` | 采集层第二步：`test config` / `test output` 的期望输出 |
| `filebeat-verify.png` | 采集层第三步:registry 的 mtime 在动 |
| `logstash-step1.png` | 加工层第一步：`50-output.conf` 第 23 行、`10-input.conf` 第 12 行 |
| `logstash-step3.png` | 加工层第三步：`pipelines.yml` 追加的管道块、`logstash.yml` 缺才加的两项 |
| `logstash-verify.png` | 加工层第四步：`events.in` / `events.out` / DLQ 目录 |
| `opensearch-step2.png` | 存储层第二步：`apply.sh` 的四步输出 |
| `opensearch-step3.png` | 存储层第三步：三条 curl 与期望值 |

## 改图怎么重新出图

源在 `_src/`：三个 HTML（`fb` / `ls` / `os`，每张卡一个 `<div class="shot" data-name="…">`）+ 公共样式 `card.css` + 截图脚本 `shot.js`。

```bash
cd deploy/assets/_src
NODE_PATH=<node 工作区>/node_modules node shot.js fb.html ..     # 依次 fb / ls / os
```

脚本按 `data-name` 命名，直接覆盖同名 PNG。只改文案时编辑对应 HTML 重跑即可，不用动截图脚本。

**注**：图是**示例值**，与文档正文里的行号、文件名必须一致 —— 改了配置或行号，三处（配置 / README 正文 / `_src` 里的 HTML）要一起改。
