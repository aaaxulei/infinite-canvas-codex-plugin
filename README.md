# Infinite Canvas Codex Plugin

让 Codex 安全连接并操作用户当前打开的 Infinite Canvas 画布。

本仓库只包含 Codex Plugin、MCP Server 和操作 Skill，不包含 Infinite Canvas
业务源码、用户数据或服务端密钥。

## 安装

要求：

- Codex Desktop
- 能访问 Infinite Canvas feat 环境

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
