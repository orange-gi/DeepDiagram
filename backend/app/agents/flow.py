from langchain_core.messages import SystemMessage
from langchain_core.tools import tool
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm

llm = get_llm()

@tool
def create_flow(code: str):
    """
    Renders an interactive flowchart using React Flow.
    Args:
        code: A JSON string containing 'nodes' and 'edges' arrays.
    """
    # Robustly strip markdown code blocks
    import re
    cleaned_code = re.sub(r'^```[a-zA-Z]*\n', '', code)
    cleaned_code = re.sub(r'\n```$', '', cleaned_code)
    return cleaned_code.strip()

@tool
def modify_flow(instruction: str, current_code: str):
    """
    Modifies existing Mermaid code based on instructions.
    Args:
        instruction: What to change.
        current_code: The current mermaid code.
    """
    # This is a placeholder; in a real agent, the LLM loop would handle the modification logic 
    # and call create_flow with the new code. 
    # But if we keep this tool, it implies the TOOL does the modification.
    # For now, let's just return a placeholder or ask the LLM to do it.
    # Better approach: The LLM should just call `create_flow` with the NEW code.
    # But for compatibility, let's leave it but returning a comment.
    return f"%% Modified based on: {instruction}\n{current_code}"

tools = [create_flow] # modify_flow is better handled by the LLM generating new code.
llm_with_tools = llm.bind_tools(tools)

async def flow_agent_node(state: AgentState):
    messages = state['messages']
    
    system_prompt = SystemMessage(content="""You are an expert Flowchart Generator.
    Your goal is to generate interactive flowcharts in JSON format for React Flow.
    
    ### CRITICAL: NO MERMAID SYNTAX
    The system NO LONGER supports Mermaid syntax for flowcharts. Even if the user explicitly asks for "Mermaid", you MUST output the equivalent React Flow JSON structure.
    
    ### OUTPUT FORMAT (JSON)
    You MUST call the `create_flow` tool with a valid JSON string containing `nodes` and `edges`:
    {
      "nodes": [
        { "id": "1", "data": { "label": "Start" }, "position": { "x": 0, "y": 0 }, "type": "default" },
        ...
      ],
      "edges": [
        { "id": "e1-2", "source": "1", "target": "2", "label": "Yes", "animated": true },
        ...
      ]
    }
    
    ### POSITIONING
    Assign reasonable x and y coordinates to nodes (e.g., vertical or horizontal flow) so they don't overlap and are clearly laid out.
    """)
    
    response = await llm_with_tools.ainvoke([system_prompt] + messages)
    return {"messages": [response]}
