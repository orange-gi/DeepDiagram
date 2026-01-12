# DeepDiagram AI（三分文档 1/3）：Why-What-How

## Why（为什么做）

- **把“画图”从手工操作变成对话式生成**：技术/业务图（流程、架构、ER、图表、思维导图、信息图）本质是结构化表达，但传统工具学习成本高、修改慢。
- **让“生成”可控、可追踪、可迭代**：将一次生成拆成“路由 → 专家 Agent → 工具输出”，并把执行轨迹、会话与版本分支持久化，支持回滚、重试、对比。
- **统一多种图形范式**：用同一套交互（聊天 + 画布）覆盖不同 DSL/数据结构（Markdown/JSON/XML/DSL）。

## What（是什么）

DeepDiagram AI 是一个开源的 Agentic 可视化平台：前端提供统一画布与聊天面板；后端通过 LangGraph 编排多个“专职制图 Agent”，把自然语言（可带图片）转成可渲染的结构化代码，并在前端实时预览。

### 专职 Agent 与主要输出

- **Mindmap**：输出 Markmap/Markdown
- **Flowchart**：输出 React Flow JSON
- **Mermaid**：输出 Mermaid 语法（sequence/class/state/gantt 等）
- **Charts**：输出 ECharts option JSON
- **Draw.io**：输出 Draw.io XML（mxGraph）
- **Infographic**：输出 AntV Infographic DSL
- **General**：闲聊/引导，不调用制图工具

### 路由方式

- **显式路由**：用户输入包含 `@mindmap/@flowchart/@mermaid/@charts/@drawio/@infographic` 时，直接选定 Agent 并清理标签，避免污染下游。
- **智能路由**：未显式指定时，Router 会根据对话与上一次活跃 Agent 决定目标 Agent（支持连续修改场景）。

## How（怎么做）

### 前端（React + TypeScript + Vite）

- **SSE 流式消费**：调用 `/api/chat/completions` 后，按事件流接收：
  - `session_created`：创建会话
  - `message_created`：消息入库并回写真实 ID
  - `agent_selected`：展示 Router 选中的 Agent
  - `thought`：展示“思考文本”（可选 UI 面板）
  - `tool_args_stream/tool_start/tool_code/tool_end`：展示过程轨迹并驱动画布渲染
- **双面板**：左侧画布渲染，右侧聊天与过程追踪；支持会话历史、版本切换、失败重试与重新生成。

### 后端（FastAPI + LangGraph/LangChain）

- **LangGraph 编排**：`router -> agent -> tools` 的 ReAct 循环；当 Agent 输出包含 tool_calls 时进入 ToolNode 执行，再回到 Agent 继续。
- **多模态输入**：用户图片以 `image_url` 形式进入消息，Router/Agent 直接看到图像内容。
- **事件流输出**：把 Router 结果、LLM 流式 token、tool 调用参数与 tool 输出实时推到前端。

### 持久化（Postgres + SQLModel）

- **ChatSession / ChatMessage** 表存储会话与消息。
- **分支/版本**：通过 `parent_id + turn_index` 组织“重试/分叉”的线性版本；前端可按 turn 切换不同版本。
- **steps**：保存每次生成的过程轨迹（agent_select/tool_start/tool_end 等），用于透明化与调试。

