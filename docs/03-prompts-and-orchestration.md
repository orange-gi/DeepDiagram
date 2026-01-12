# DeepDiagram AI（三分文档 3/3）：提示词（Prompts）与编排要点

本项目的核心不是“一个大模型一次性把图画完”，而是用 **Router + 多个专职 Agent + Tool（严格输出格式）** 的提示词体系，把生成变成可控、可追踪、可迭代的工程流程。

## 1）提示词的三层结构（项目真实落地形态）

### 1.1 Router 提示词（选 Agent）

目标：根据用户意图与上下文，输出一个 intent（mindmap/flowchart/mermaid/charts/drawio/infographic/general）。

关键点：
- **显式路由优先**：用户输入含 `@mindmap/@flowchart/...` 时，直接选定 intent，并从用户文本中清理该标签。
- **连续对话不跑偏**：Router 会参考“执行轨迹（Execution Trace）”与“上一轮活跃 Agent”，在 follow-up / fix 场景优先沿用上一次 Agent。
- **多模态友好**：路由时把最后一条消息原样（含 image_url）交给模型，而不是把图片转成长文本拼接。

### 1.2 Agent 编排提示词（强制 Tool Call + 需求扩写）

目标：把用户的自然语言变成“可执行、可生成专业图形”的 **高保真指令**，并强制调用对应 tool。

共同特征（各 Agent 基本一致）：
- **MANDATORY TOOL CALL**：必须调用某个 tool（例如 Mermaid 必须调用 `create_mermaid`）。
- **MANDATORY ENRICHMENT**：把短 prompt 扩写成完整规格（补角色、边界、错误路径、字段类型、注释等）。
- **LANGUAGE CONSISTENCY**：工具调用与输出语言跟随用户输入语言。

### 1.3 Tool 级提示词（严格输出格式 / 类编译器约束）

目标：让模型只输出目标 DSL/JSON/XML/Markdown 的“可渲染产物”，最大化渲染成功率。

常见约束：
- **只输出原始代码**：不输出解释文字，不带 Markdown 围栏（或工具层会做剥离）。
- **严格语法**：JSON 必须双引号、无注释、无 trailing comma；Draw.io XML 必须满足 mxGraph 结构规则等。
- **增量编辑**：注入 `CURRENT_CODE`，要求在现有代码基础上修改，支持迭代。

## 2）各 Agent 的“输出契约”（Prompt 设计与格式）

| Agent | Tool | 期望输出 | 典型强约束（提示词里的关键点） |
|---|---|---|---|
| Mindmap | `create_mindmap` | Markdown/Markmap | 只有一个 `#` 根节点；层级 4-5；只输出 Markdown |
| Flowchart | `create_flow` | React Flow JSON | Strict JSON；包含 nodes/edges；必须有 decision 分支与错误路径 |
| Mermaid | `create_mermaid` | Mermaid 语法 | 只输出 Mermaid 原始语法；支持多类型；强调语义丰富（alt/opt/loop/note） |
| Charts | `create_chart` | ECharts option JSON | Strict JSON；可合成数据；叙事化标题/标注/dataZoom/toolbox |
| Draw.io | `render_drawio_xml` | mxGraph XML | 只输出原始 XML；结构/父子层级/无压缩；专业布局 |
| Infographic | `create_infographic` | AntV Infographic DSL | 必须选择模板；只输出 DSL；icon/illus/数据合成与叙事 |
| General | 无 | 自然语言 | 不调用工具，仅引导用户可视化 |

## 3）“过程显性化”：提示词如何被前后端消费

后端会把 Router/Agent/Tool 的关键节点转成 SSE 事件，前端据此：
- **渲染过程轨迹**：agent_select / tool_start / tool_end
- **流式预览**：tool_code 让画布可以边生成边渲染（部分 Agent 支持）
- **版本与回滚**：`turn_index + parent_id` 让“重试/分支”可切换

常见事件（前后端契约）：
- `agent_selected`：Router 选择的 agent
- `thought`：非工具流（通常是“思考/文本”）
- `tool_args_stream`：工具调用参数流（便于调试）
- `tool_start` / `tool_end`：工具调用边界
- `tool_code`：工具输出的流式代码（用于预览/过程透明）

## 4）提示词工程技巧（项目已落地）

### 4.1 输出清洗（降低渲染失败率）

工具层普遍会：
- 去掉 `<think>...</think>`
- 剥离 ``` 围栏
- 用正则提取 JSON 主体（从第一个 `{` 到最后一个 `}`）

### 4.2 增量修改（CURRENT_CODE 注入）

工具层在上下文里存在 `current_code` 时，会把当前图代码注入提示词，并要求“在此基础上应用变更”，支持连续改图。

### 4.3 失败修复闭环（前端追加 System Note）

前端在渲染失败重试时，会把错误作为系统注释追加到下一次 prompt：要求模型“修复语法”，形成自修复回路。

