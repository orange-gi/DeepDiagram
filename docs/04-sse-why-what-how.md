# SSE（三分文档加更）：Why-What-How（结合 DeepDiagram AI 示例）

## Why（为什么需要 SSE）

在“AI 生成图”的场景里，用户体验的关键不是**最终结果**，而是：

- **尽快看到进度**：模型往往需要数秒到数十秒；如果一直转圈，用户会焦虑、误以为卡死。
- **过程可观测、可追溯**：需要把“选了哪个 Agent、调用了什么工具、工具参数是什么、生成代码进度如何、是否报错”展示出来，便于调试与信任建立。
- **支持中途停止/重试**：用户希望随时取消当前生成，或者基于错误信息再次生成。

SSE（Server-Sent Events）适合这类场景：后端可以**一边生成一边推送**，前端可以**边接收边渲染**。

在本项目里，SSE 直接支撑了：
- ChatPanel 的实时输出（`thought`）
- ExecutionTrace 的实时过程轨迹（`agent_selected/tool_start/tool_args_stream/tool_end`）
- 画布的实时预览（`tool_code`，部分 Agent 支持边生成边渲染）

## What（SSE 是什么）

SSE 是一种基于 HTTP 的**服务端单向推送**机制：
- **连接方向**：浏览器发起一次普通 HTTP 请求，服务端保持连接不断开，持续向客户端推送事件。
- **数据格式**：文本流，按“事件块”发送，每个事件块一般形如：
  - `event: <事件名>`
  - `data: <一行 JSON 或文本>`
  - 以空行 `\n\n` 作为事件结束
- **对比 WebSocket**：
  - SSE：服务端 → 客户端单向推送，协议/实现更简单，适合“流式输出/通知/日志”。
  - WebSocket：双向通信更强，但实现与维护成本更高。

在 DeepDiagram AI 中，SSE 被用作“LLM token 流 + 工具调用过程流”的统一通道。

## How（在本项目里 SSE 怎么工作）

### 1）后端：把 LangGraph 事件转换成 SSE 事件

入口是 FastAPI 路由：`POST /api/chat/completions`（见 `backend/app/api/routes.py`），返回 `StreamingResponse(..., media_type="text/event-stream")`。

后端会在生成过程中不断 `yield` 字符串，形如：

- `event: session_created`：新会话创建成功，返回 `session_id`
- `event: message_created`：用户/助手消息入库后回写真实 `id`（前端会用它替换临时负 ID）
- `event: agent_selected`：Router 选中了哪个 Agent（例如 `mermaid/charts/...`）
- `event: thought`：非工具流的模型输出（用于聊天区域展示、思考面板等）
- `event: tool_args_stream`：工具调用参数的流式片段（便于透明化）
- `event: tool_start`：开始调用工具
- `event: tool_code`：工具输出的**代码流**（可边生成边渲染）
- `event: tool_end`：工具调用结束，输出最终结果
- `event: error`：异常/失败

这些事件本质上是把 LangGraph 的 `astream_events` 事件流（router/agent/tool 的生命周期）映射成前端可消费的“UI 事件”。

### 2）前端：用 ReadableStream 手动解析 SSE

本项目没有用 `EventSource`，而是用 `fetch()` + `response.body.getReader()` 自己解析（见 `frontend/src/components/ChatPanel.tsx`）：

1. `fetch('/api/chat/completions', { method: 'POST', ... })`
2. `reader.read()` 循环读取二进制 chunk
3. `TextDecoder` 解码并累积到 buffer
4. 用 `\n\n` 拆分成一个个事件块
5. 用正则匹配 `event: ...\ndata: ...`
6. `JSON.parse(data)` 后按 `eventName` 分发更新 Zustand store

这套做法的好处：
- **可控性强**：能处理 “token 被拆分在多个 chunk” 的情况（`decoder.decode(value, { stream: true })`）。
- **便于扩展**：本项目自定义了多种事件（尤其是 `tool_args_stream` 与 `tool_code`），UI 可以精细响应。

### 3）结合本项目举例：一次生成从请求到画布预览

假设用户输入：`@mermaid 画一个支付流程的时序图`

#### Step A：请求建立 SSE
前端发送 POST；如果是新会话，后端先推：
- `session_created`（前端保存 sessionId，并刷新会话列表）
- `message_created`（用户消息入库，返回真实 message id）

#### Step B：Router 选择 Agent
后端 Router 选定 `mermaid` 后推：
- `agent_selected: {"agent":"mermaid" ...}`
前端会：
- 切换当前 activeAgent（影响画布渲染类型）
- 往 ExecutionTrace 里加一条 `agent_select` step（让用户看到“为什么走到 Mermaid”）

#### Step C：Agent 调用工具（可看到参数、可看到生成进度）
当 Agent 发起工具调用时，后端推：
- `tool_args_stream`（逐段推送工具参数 JSON）
- `tool_start`（工具开始）
随后工具生成代码时，后端推：
- 多次 `tool_code`（Mermaid 语法逐段到达）

前端在 `tool_code` 到达时，会：
- 把它追加进 ExecutionTrace 的 `Result` 步骤内容（流式）
- 对某些 Agent（例如 mindmap/infographic）会在流式过程中刷新画布；对其它 Agent 通常在 `tool_end` 时以“完成态”刷新画布

最后后端推：
- `tool_end`（工具结束，输出最终产物）
- `message_created`（助手消息入库，返回真实 ID）

到这里，用户体验上就是：**聊天区持续出现 thought、过程追踪持续出现工具参数/结果流，画布最终显示可渲染的 Mermaid 图**。

### 4）停止生成（Abort）也是 SSE 体验的一部分

前端保存了 `AbortController`：
- 用户点击 Stop，会 `abort()` 取消请求
- 本项目后端还做了“连接中断时尽量保存部分结果”的兜底逻辑（避免生成了但没落库）

这让 SSE 的“长连接生成”具备可中断性，符合真实使用需求。

## 小结：用一句话理解 SSE（结合本项目）

SSE 在 DeepDiagram AI 里就是一条“不断输出事件块的 HTTP 连接”，把 **路由决策（agent_selected）+ 思考文本（thought）+ 工具调用与代码流（tool_*）** 统一流式推给前端，从而实现“生成可见、过程可追踪、画布可实时预览”的体验。

