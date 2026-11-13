# assets · 部署截图（暂不提供）

部署文件还在现场调整，**当前不放任何截图**。等部署文件稳定后统一重出，再补回采集 / 加工两份 README 的图。

生成源留在 `_src/`：两个 HTML（`fb` / `ls`，每张卡一个 `<div class="shot" data-name="…">`）+ 公共样式 `card.css` + 截图脚本 `shot.js`。

```bash
cd deploy/assets/_src
NODE_PATH=<node 工作区>/node_modules node shot.js fb.html ..     # 依次 fb / ls
```

脚本按 `data-name` 命名，输出到 `assets/` 并覆盖同名 PNG。图里的路径 / 端口 / 地址是示例值，与配置、README 正文、HTML 三处要一致。
