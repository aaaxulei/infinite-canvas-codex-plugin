# Infinite Canvas Codex Plugin

让 Codex 安全连接并操作用户当前打开的 Infinite Canvas 画布。

本仓库只包含 Codex Plugin、MCP Server 和操作 Skill，不包含 Infinite Canvas
业务源码、用户数据或服务端密钥。

## 安装

要求：

- Codex Desktop
- 能访问 Infinite Canvas feat 环境
- 读取飞书 Doc/Wiki 时，本机需安装 `lark-cli` 并完成飞书用户授权

插件会自动使用系统 Node.js 或 Codex 自带的 Node.js，通常无需另外安装或配置
`PATH`。如自动发现失败，可通过 `INFINITE_CANVAS_NODE` 指定 Node.js 可执行文件的
绝对路径。

执行：

```bash
codex plugin marketplace add aaaxulei/infinite-canvas-codex-plugin
codex plugin add infinite-canvas@aaaxulei
```

安装完成后新建一个 Codex 任务，使 Plugin 和 MCP tools 被加载。

## 升级

已经安装过插件的同事执行：

```bash
codex plugin marketplace upgrade aaaxulei
codex plugin add infinite-canvas@aaaxulei
```

升级完成后重启 Codex，并新建一个任务。

## 连接画布

1. 打开并登录 [Infinite Canvas feat](https://staging.designer.etm.tech)。
2. 点击右上角头像，选择 **连接 Codex**。
3. 生成一次性配对码并复制完整连接信息。
4. 将连接信息发送给 Codex。

配对码 5 分钟后失效且只能使用一次。用户可以随时在 **连接 Codex** 面板撤销
已授权 Token。

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
.agents/plugins/marketplace.json
plugins/infinite-canvas/
├── .codex-plugin/plugin.json
├── .mcp.json
├── scripts/
│   ├── mcp-server.mjs
│   └── start-mcp.sh
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
