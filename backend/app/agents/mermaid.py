from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm
from app.core.context import set_context, get_messages, get_context

llm = get_llm()

MERMAID_SYSTEM_PROMPT = """You are an expert Mermaid Diagram Generator.
Your goal is to generate technical diagrams using Mermaid syntax.

### SUPPORTED DIAGRAM TYPES
- Sequence Diagrams (sequenceDiagram)
- Class Diagrams (classDiagram)
- State Diagrams (stateDiagram-v2)
- Entity Relationship Diagrams (erDiagram)
- Gantt Charts (gantt)
- User Journey (journey)
- Git Graph (gitGraph)
- Pie Chart (pie) - prefer Charts Agent for complex data, but simple pies are okay here.

Note: Flowcharts are handled by a separate agent, but you can generate them if explicitly requested as "Mermaid flowchart".

### DESIGN PRINCIPLES (CRITICAL)
1. **CONTENT RICHNESS**: If the user request is simple, expand it into a professional, production-ready diagram. Add detailed participants, notes, and edge cases to Sequence Diagrams. For Gantt charts, add more phases and milestones.
2. **FORMAT**: Return the raw Mermaid syntax string. Do not wrap the code in markdown blocks.
3. **LANGUAGE**: Use the user's language for all diagram labels, notes, participant names, and annotations.

### EXAMPLES

**Sequence Diagram:**
sequenceDiagram
    Alice->>John: Hello John, how are you?
    John-->>Alice: Great!
    
**Class Diagram:**
classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal : +int age
    Animal : +String gender
"""

@tool
async def create_mermaid(instruction: str):
    """
    Renders a diagram using Mermaid syntax based on instructions.
    Args:
        instruction: Detailed instruction on what diagram to create or modify.
    """
    messages = get_messages()
    context = get_context()
    current_code = context.get("current_code", "")
    
    # Call LLM to generate the Mermaid code
    system_msg = MERMAID_SYSTEM_PROMPT
    if current_code:
        system_msg += f"\n\n### CURRENT DIAGRAM CODE\n```mermaid\n{current_code}\n```\nApply changes to this code."

    prompt = [SystemMessage(content=system_msg)] + messages
    if instruction:
        prompt.append(HumanMessage(content=f"Instruction: {instruction}"))
    
    response = await llm.ainvoke(prompt)
    code = response.content
    
    # Robustly strip markdown code blocks
    import re
    cleaned_code = re.sub(r'^```[a-zA-Z]*\n', '', code)
    cleaned_code = re.sub(r'\n```$', '', cleaned_code)
    return cleaned_code.strip()

tools = [create_mermaid]
llm_with_tools = llm.bind_tools(tools)

async def mermaid_agent_node(state: AgentState):
    messages = state['messages']
    current_code = state.get("current_code", "")
    
    # Sync current_code from last tool message if available
    if messages and messages[-1].type == "tool":
        last_tool_msg = messages[-1]
        if last_tool_msg.content:
             current_code = last_tool_msg.content.strip()

    # Safety: Ensure no empty text content blocks reach the LLM
    for msg in messages:
        if hasattr(msg, 'content') and not msg.content:
            msg.content = "Generate technical diagram"

    set_context(messages, current_code=current_code)
    
    system_prompt = SystemMessage(content="""You are an expert Mermaid Diagram Orchestrator.
    Your goal is to understand the user's request and call the `create_mermaid` tool with the appropriate instructions.
    
    ### PROACTIVENESS PRINCIPLES:
    1. **BE DECISIVE**: If the user identifies a diagram type (e.g., "sequence diagram"), call the tool IMMEDIATELY.
    2. **DESIGN LOGIC**: If the system logic is not provided, design a professional and technical flow yourself.
    3. **AVOID HESITATION**: DO NOT ask for participants or states. Just generate the complete Mermaid code.
    """)
    
    response = await llm_with_tools.ainvoke([system_prompt] + messages)
    return {"messages": [response], "current_code": current_code}
