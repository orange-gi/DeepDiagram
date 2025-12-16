from typing import Literal
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm

llm = get_llm(model_name="claude-sonnet-3.7") # Use a fast model for routing, or default to general config

def router_node(state: AgentState):
    """
    Analyzes the user's input and determines the appropriate agent.
    """
    messages = state['messages']
    current_code = state.get("current_code", "")
    
    # Determine active context from code
    active_context = "None"
    if current_code:
        if "mermaid" in current_code or "graph TD" in current_code or "flowchart" in current_code:
            active_context = "Flowchart (Mermaid)"
        elif "series" in current_code and "type" in current_code:
             active_context = "Chart (ECharts)"
        elif "# " in current_code and ("- " in current_code or "##" in current_code):
             active_context = "Mindmap (Markdown)"

    agent_descriptions = {
        "mindmap": "Best for hierarchical structures, brainstorming, outlining ideas, and organizing concepts. Output: Markdown/Markmap.",
        "flow": "Best for sequential processes, workflows, decision trees, and logic flows. Output: Mermaid Flowchart.",
        "charts": "Best for quantitative data visualization (sales, stats, trends). Output: ECharts (Bar, Line, Pie, etc.).",
        "drawio": "Best for complex architecture diagrams, cloud infrastructure (AWS/Azure), UML class diagrams, and network topologies. Output: Draw.io XML. Use this if user explicitly asks for 'Draw.io' or 'architecture'.",
        "general": "Handles greetings, questions unrelated to diagramming, or requests that don't fit other categories."
    }

    descriptions_text = "\n".join([f"- '{key}': {desc}" for key, desc in agent_descriptions.items()])

    system_prompt = f"""You are an Intent Router. 
    Analyze the user's request and the conversation history to classify the intent into one of the categories.
    
    CURRENT VISUAL CONTEXT: {active_context}
    (This is what the user is currently looking at on the screen)

    Context Awareness Rules:
    1. IF "CURRENT VISUAL CONTEXT" is "Chart" AND user asks to "add", "remove", "change", "update" numbers or items -> YOU MUST ROUTE TO 'charts'.
    2. IF "CURRENT VISUAL CONTEXT" is "Mindmap" AND user asks to "add node", "expand" -> YOU MUST ROUTE TO 'mindmap'.
    3. IF "CURRENT VISUAL CONTEXT" is "Flowchart" AND user asks to "change shape", "connect" -> YOU MUST ROUTE TO 'flow'.
    
    Agent Capabilities:
    {descriptions_text}
    
    Output ONLY the category name.
    """
    
    # Serialize history to text to prevent the LLM from entering "Chat Mode"
    conversation_text = ""
    for msg in messages:
        role = "User" if msg.type == "human" else "Assistant"
        content = msg.content
        if isinstance(content, list):
            text_parts = []
            for item in content:
                if isinstance(item, dict):
                    if item.get("type") == "text":
                        text_parts.append(item.get("text", ""))
                    elif item.get("type") == "image_url":
                        text_parts.append("[User uploaded an image]")
            conversation_text += f"{role}: {' '.join(text_parts)}\n"
        else:
            conversation_text += f"{role}: {content}\n"
    
    # We pass the full history so the router can see previous context
    # Use a single HumanMessage containing instructions + history to force analysis mode
    final_prompt = f"{system_prompt}\n\nCONVERSATION HISTORY:\n{conversation_text}\n\nUser's Last Request: {messages[-1].content}\n\nCLASSIFICATION:"
    
    response = llm.invoke([HumanMessage(content=final_prompt)])
    intent = response.content.strip().lower()
    
    print(f"DEBUG ROUTER | Context: {active_context} | Raw Intent: {intent}")

    if "mindmap" in intent:
        return {"intent": "mindmap"}
    elif "flow" in intent:
        return {"intent": "flow"}
    elif "chart" in intent:
        return {"intent": "charts"}
    elif "drawio" in intent or "draw.io" in intent or "architecture" in intent or "network" in intent:
        return {"intent": "drawio"} 
    elif "general" in intent:
        return {"intent": "general"}
    else:
        return {"intent": "general"} # Default to general for safety

def route_decision(state: AgentState) -> Literal["mindmap_agent", "flow_agent", "charts_agent", "drawio_agent", "general_agent"]:
    intent = state.get("intent")
    if intent == "mindmap":
        return "mindmap_agent"
    elif intent == "flow":
        return "flow_agent"
    elif intent == "charts":
        return "charts_agent"
    elif intent == "drawio":
        return "drawio_agent"
    elif intent == "general":
        return "general_agent"
    return "general_agent"
