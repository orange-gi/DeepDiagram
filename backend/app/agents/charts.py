from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm
from app.core.context import set_context, get_messages, get_context
import json

llm = get_llm()

CHARTS_SYSTEM_PROMPT = """You are an expert Data Visualization Specialist.
Your goal is to generate professional ECharts configurations (JSON).

### INPUT ANALYSIS
- Identify the data series, categories (labels), and the best chart type (Bar, Line, Pie, Scatter, Radar, etc.) to represent the relationship.

### OUTPUT INSTRUCTIONS
- Return ONLY a valid JSON string representing the ECharts 'option' object.
- **Do NOT** wrap in markdown code blocks (e.g. ```json ... ```). Just the raw JSON string.
- **Do NOT** include any explanatory text outside the JSON.

### ECHARTS CONFIGURATION TIPS
- **Structure**:
  {
    "title": { "text": "..." },
    "tooltip": { "trigger": "axis" },
    "legend": { "data": [...] },
    "xAxis": { "type": "category", "data": [...] },
    "yAxis": { "type": "value" },
    "series": [ { "name": "...", "type": "bar", "data": [...] } ]
  }
- **Styling**: Add `smooth: true` for line charts. Use colors if specified.
- **Pie Charts**: DO NOT use xAxis/yAxis. Use `series: [{ type: 'pie', data: [{name:..., value:...}] }]`.

### EXECUTION
- **CONTENT RICHNESS**: If the user request is simple (e.g., "draw a sales chart"), assume multiple series or categories to make the chart look professional and informative. Use diverse chart types and add helpful ECharts features like dataZoom or markPoints if they add value.
- **DATA QUALITY**: If data is missing, GENERATE realistic, detailed dummy data that reflects the user's intent.
- **LANGUAGE**: Detect the user's language. All chart titles, legends, axis labels, and series names MUST be in that same language.
- Return ONLY the JSON string.
"""

@tool
async def create_chart(instruction: str):
    """
    Renders a Chart using Apache ECharts based on instructions.
    Args:
        instruction: Detailed instruction on what chart to create or modify.
    """
    messages = get_messages()
    context = get_context()
    current_code = context.get("current_code", "")
    
    # Call LLM to generate the ECharts option
    system_msg = CHARTS_SYSTEM_PROMPT
    if current_code:
        system_msg += f"\n\n### CURRENT CHART CODE\n```json\n{current_code}\n```\nApply changes to this code."
        
    prompt = [SystemMessage(content=system_msg)] + messages
    if instruction:
        prompt.append(HumanMessage(content=f"Instruction: {instruction}"))
    
    response = await llm.ainvoke(prompt)
    option_str = response.content
    
    # Strip potential markdown boxes
    import re
    # Remove starting markdown fence (with or without language)
    option_str = re.sub(r'^```\w*\n?', '', option_str.strip())
    # Remove ending markdown fence
    option_str = re.sub(r'\n?```$', '', option_str.strip())
    
    return option_str.strip()

tools = [create_chart]
llm_with_tools = llm.bind_tools(tools)

async def charts_agent_node(state: AgentState):
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
            msg.content = "Continue" # Or a better placeholder

    set_context(messages, current_code=current_code)
    
    system_prompt = SystemMessage(content="""You are an expert Data Visualization Orchestrator.
    Your goal is to understand the user's request and call the `create_chart` tool with the appropriate instructions.
    
    ### PROACTIVENESS PRINCIPLES:
    1. **BE DECISIVE**: If the user asks for a chart (e.g., "draw a pie chart"), call the tool IMMEDIATELY.
    2. **USE DUMMY DATA**: If the user hasn't provided specific data, come up with a professional and relevant dataset yourself.
    3. **AVOID HESITATION**: DO NOT ask the user for data, topics, or categories. Just pick something interesting and generate it.
    """)
    
    response = await llm_with_tools.ainvoke([system_prompt] + messages)
    return {"messages": [response], "current_code": current_code}
