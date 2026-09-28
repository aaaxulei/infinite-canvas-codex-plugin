# Infinite Canvas Plugin — Codex / Claude Code

让 Codex 或 Claude Code 安全连接并操作用户当前打开的 Infinite Canvas 画布。

本仓库只包含 AI 客户端 Plugin、MCP Server 和操作 Skill，不包含 Infinite Canvas
业务源码、用户数据或服务端密钥。

## 安装

要求：

- Codex Desktop 或 Claude Code
- 能访问并登录目标 Infinite Canvas 环境
- 读取飞书 Doc/Wiki 时，本机需安装 `lark-cli` 并完成飞书用户授权

插件会自动使用系统 Node.js 或 Codex 自带的 Node.js，Codex 用户通常无需另外安装或配置
`PATH`。如自动发现失败，可通过 `INFINITE_CANVAS_NODE` 指定 Node.js 可执行文件的
绝对路径。

Claude Code 用户需要本机 Node.js 18 或更新版本（macOS/Linux；Windows 使用 WSL）。
两端共用相同的 MCP 工具和工作流 Skills，版本为 **0.1.22**。

### Codex

执行：

```bash
codex plugin marketplace add aaaxulei/infinite-canvas-codex-plugin
codex plugin add infinite-canvas@aaaxulei
```

安装完成后新建一个 Codex 任务，使 Plugin 和 MCP tools 被加载。

### Claude Code

```bash
claude plugin marketplace add aaaxulei/infinite-canvas-codex-plugin
claude plugin install infinite-canvas@aaaxulei
```

安装后重开 Claude Code 会话，在 `/mcp` 中确认 `infinite-canvas` 已连接。
可使用 `/infinite-canvas:operate-infinite-canvas` 或
`/infinite-canvas:create-image-templates` 调用 Skill。
无需同时手工注册 MCP，否则会出现重复工具。

## 升级

已经安装过插件的同事执行：

```bash
codex plugin marketplace upgrade aaaxulei
codex plugin add infinite-canvas@aaaxulei
```

升级完成后重启 Codex，并新建一个任务。

Claude Code 用户执行后重新打开会话：

```bash
claude plugin marketplace update aaaxulei
claude plugin update infinite-canvas@aaaxulei
```

## 连接画布

1. 打开并登录你要操作的 Infinite Canvas 环境，保持画布标签页打开。
2. 点击右上角头像，选择 **连接 AI 助手**，再选择客户端。旧版应用的入口仍为 **连接 Codex**，同样支持 Claude Code 配对。
3. 生成一次性配对码并复制完整连接信息。
4. 将包含一次性配对码、API 地址和应用地址的完整连接信息发送给所选客户端。

配对码 5 分钟后失效且只能使用一次。用户可以随时在 连接面板撤销
已授权 Token。Codex 保存在 `~/.config/infinite-canvas/codex.json`，Claude Code 保存在
`~/.config/infinite-canvas/claude-code.json`，均为本机私有文件。两个客户端应分别生成配对码，
各自撤销不会影响另一端；不要复制或分享 Token。多环境使用 `INFINITE_CANVAS_CONFIG`
选择独立文件，默认每个客户端文件只保留最近一次配对。

插件更新可直接配合旧版应用使用。网页新增客户端选择入口需要另行部署应用；
发布插件不代表已部署网页。Claude Code 缺少浏览器控制工具时，可由用户手动打开画布，
已有在线画布仍可经 MCP 操作。

## 使用示例

```text
查看当前画布结构，告诉我有哪些节点和连接。
```

```text
添加一个文本节点和图片生成节点，把它们连接起来。
```

```text
运行当前分组，并持续检查执行状态直到完成。
```

```text
使用 $infinite-canvas:create-image-templates，根据这个飞书文档制作图像模板：<URL>
```

模板 Skill 会优先通过 `lark-doc` 和 `lark-cli` 读取飞书正文及参考图。首次使用前
需要完成 `lark-cli` 配置和用户授权；读取链路不可用时会降级到已登录的 Chrome
会话，仍无法完整访问则会停止生成并要求补充权限或素材。

## 仓库结构

```text
.agents/plugins/marketplace.json    # Codex aaaxulei
.claude-plugin/marketplace.json    # Claude Code aaaxulei
plugins/infinite-canvas/
├── .codex-plugin/plugin.json      # 内联 Codex MCP 配置
├── .claude-plugin/plugin.json
├── .mcp.json                      # Claude Code MCP 配置
├── scripts/
│   ├── mcp-server.mjs
│   ├── start-mcp.sh
│   └── start-claude-mcp.sh
└── skills/
    ├── operate-infinite-canvas/
    └── create-image-templates/
```

## 原始素材下载（0.1.21）

升级后可直接要求：“把这个成功的视频结果下载到指定本地目录，保留原始素材。”
`download_canvas_asset` 复用已有有效配对，支持资产 ID、`asset://` 和同环境普通
素材文件 URL，无需浏览器下载或重新配对。最大 2 GiB，失败可重试，不覆盖已有文件。
当前不支持断点续传；字节数与 SHA-256 校验不等同于音视频完整解码验证。
下载或权限失败会报告原因，不授权自动换素材或重新生成。

## 验证与来源

开发源为 Infinite Canvas 应用仓库的 `plugins/infinite-canvas/`；发布时完整同步，
不维护第二套执行器、模型路由或权限逻辑。Claude marketplace 位于本仓库根目录，
指向 `./plugins/infinite-canvas`，与 Codex 共用同一插件目录。

```bash
node --test plugins/infinite-canvas/scripts/*.test.mjs
claude plugin validate plugins/infinite-canvas/.claude-plugin/plugin.json
claude plugin validate .claude-plugin/marketplace.json
```

协议测试覆盖工具发现、独立配对、凭据权限、重启后读取和撤销隔离；
不替代真实账号、在线浏览器和上游生成的验收。
