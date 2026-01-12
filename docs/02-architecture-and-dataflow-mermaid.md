# DeepDiagram AI（三分文档 2/3）：架构与数据流（Mermaid 多视角）

## 1）部署视角（Docker Compose / 进程边界）

```mermaid
graph LR
  U[User Browser] -->|HTTP :80| N[Nginx / Frontend Container]
  N -->|/ (static)| FE[React SPA]
  N -->|/api/* reverse proxy| BE[FastAPI Backend :8000]
  BE -->|asyncpg| DB[(Postgres :5432)]

  subgraph Docker Compose
    N
    BE
    DB
  end
```

## 2）运行时数据流（SSE 流式：消息 + 画布）

```mermaid
sequenceDiagram
  participant User
  participant FE as Frontend (ChatPanel/Canvas)
  participant BE as Backend (FastAPI)
  participant LG as LangGraph
  participant R as Router Node
  participant A as Agent Node
  participant T as Tool Node
  participant LLM as LLM Provider

  User->>FE: 输入 prompt / 上传图片
  FE->>BE: POST /api/chat/completions
  BE-->>FE: event: session_created / message_created

  BE->>LG: astream_events(messages)
  LG->>R: router_node(state)
  R->>LLM: 路由提示词 + 最后一条消息(可含图片)
  LLM-->>R: intent
  BE-->>FE: event: agent_selected

  LG->>A: {对应Agent}_agent_node
  A->>LLM: 编排提示词(强制tool) + history
  LLM-->>A: tool_call(args)
  BE-->>FE: event: tool_args_stream / tool_start

  LG->>T: ToolNode 执行 tool（生成代码）
  T->>LLM: 工具级提示词(约束输出) + CURRENT_CODE(用于增量修改)
  LLM-->>T: 代码片段(流式)
  BE-->>FE: event: tool_code（边生成边预览）
  BE-->>FE: event: tool_end（最终结果）

  BE-->>FE: event: message_created（持久化后的assistant消息id）
```

## 3）编排视角（LangGraph 状态机：Router→Agent↔Tools）

```mermaid
stateDiagram-v2
  [*] --> router
  router --> mindmap_agent: intent=mindmap
  router --> flow_agent: intent=flowchart
  router --> mermaid_agent: intent=mermaid
  router --> charts_agent: intent=charts
  router --> drawio_agent: intent=drawio
  router --> infographic_agent: intent=infographic
  router --> general_agent: intent=general

  mindmap_agent --> mindmap_tools: has tool_calls
  mindmap_tools --> mindmap_agent
  mindmap_agent --> [*]: no tool_calls

  flow_agent --> flow_tools: has tool_calls
  flow_tools --> flow_agent
  flow_agent --> [*]: no tool_calls

  mermaid_agent --> mermaid_tools: has tool_calls
  mermaid_tools --> mermaid_agent
  mermaid_agent --> [*]: no tool_calls

  charts_agent --> charts_tools: has tool_calls
  charts_tools --> charts_agent
  charts_agent --> [*]: no tool_calls

  drawio_agent --> drawio_tools: has tool_calls
  drawio_tools --> drawio_agent
  drawio_agent --> [*]: no tool_calls

  infographic_agent --> infographic_tools: has tool_calls
  infographic_tools --> infographic_agent
  infographic_agent --> [*]: no tool_calls

  general_agent --> [*]
```

## 4）事件视角（SSE 事件=前后端契约）

```mermaid
graph TD
  FE[Frontend Store/UI] -->|POST /api/chat/completions| BE[Backend SSE]
  BE -->|session_created| FE
  BE -->|message_created| FE
  BE -->|agent_selected| FE
  BE -->|thought| FE
  BE -->|tool_args_stream| FE
  BE -->|tool_start| FE
  BE -->|tool_code| FE
  BE -->|tool_end| FE

  FE -->|更新 messages/steps| UI[ChatPanel / ExecutionTrace]
  FE -->|更新 renderKey + activeMessageId| Canvas[CanvasPanel]
```

## 5）数据模型视角（会话、消息、分支/版本）

```mermaid
erDiagram
  CHATSESSION ||--o{ CHATMESSAGE : has
  CHATMESSAGE }o--|| CHATMESSAGE : parent

  CHATSESSION {
    int id PK
    string title
    datetime created_at
    datetime updated_at
  }

  CHATMESSAGE {
    int id PK
    int session_id FK
    int parent_id FK
    string role
    string content
    json images
    json steps
    string agent
    int turn_index
    datetime created_at
  }
```

