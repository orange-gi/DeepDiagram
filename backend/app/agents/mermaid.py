from langchain_core.messages import SystemMessage
from langchain_core.tools import tool
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm

llm = get_llm()

@tool
def create_mermaid(code: str):
    """
    Renders a diagram using Mermaid syntax.
    Args:
        code: A valid Mermaid syntax string.
    """
    # Robustly strip markdown code blocks
    import re
    cleaned_code = re.sub(r'^```[a-zA-Z]*\n', '', code)
    cleaned_code = re.sub(r'\n```$', '', cleaned_code)
    return cleaned_code.strip()

tools = [create_mermaid]
llm_with_tools = llm.bind_tools(tools)

async def mermaid_agent_node(state: AgentState):
    messages = state['messages']
    
    system_prompt = SystemMessage(content="""You are an expert Mermaid Diagram Generator.
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
    
    ### FORMAT
    You must call the `create_mermaid` tool with the raw Mermaid syntax string.
    Do not wrap the code in markdown blocks in the tool argument, but the tool will strip them if you do.
    
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
    """)
    
    response = await llm_with_tools.ainvoke([system_prompt] + messages)
    return {"messages": [response]}
