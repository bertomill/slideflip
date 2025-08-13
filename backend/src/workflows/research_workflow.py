"""
LangGraph Research Workflow

Main research workflow orchestrator that coordinates multiple agents
to perform comprehensive research with real-time progress updates.
"""

from typing import TypedDict, List, Dict, Any, Optional
import asyncio
import logging
from datetime import datetime

try:
    from langgraph.graph import StateGraph, END
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    # Fallback for when LangGraph is not available

    class StateGraph:
        def __init__(self, state_type):
            self.state_type = state_type
            self.nodes = {}
            self.edges = []

        def add_node(self, name, func):
            self.nodes[name] = func

        def add_conditional_edges(self, source, condition, mapping):
            self.edges.append(("conditional", source, condition, mapping))

        def add_edge(self, source, target):
            self.edges.append(("direct", source, target))

        async def ainvoke(self, state):
            # Simple sequential execution for fallback
            if "web_researcher" in self.nodes:
                state = await self.nodes["web_researcher"](state)
            if "synthesizer" in self.nodes:
                state = await self.nodes["synthesizer"](state)
            return state

    END = "END"

from src.agents.web_research_agent import WebResearchAgent

logger = logging.getLogger(__name__)


class ResearchState(TypedDict):
    # Input parameters
    query: str
    description: str
    options: Dict[str, Any]
    client_id: str
    workflow_id: str

    # Agent results
    web_results: Optional[Dict[str, Any]]
    data_analysis: Optional[Dict[str, Any]]
    graphics_suggestions: Optional[Dict[str, Any]]
    fact_check_results: Optional[Dict[str, Any]]

    # Workflow state
    enabled_agents: List[str]
    current_agent: str
    progress: int
    errors: List[str]
    agent_results: List[Dict[str, Any]]

    # Final output
    synthesized_content: Optional[str]
    quality_score: Optional[float]


class ResearchWorkflow:
    """Main research workflow orchestrator"""

    def __init__(self, websocket_manager=None):
        self.websocket_manager = websocket_manager
        self.agents = {
            "web_researcher": WebResearchAgent()
        }
        self.workflow = self._create_workflow()

    def _create_workflow(self):
        """Create the LangGraph workflow"""
        if LANGGRAPH_AVAILABLE:
            workflow = StateGraph(ResearchState)

            # Add nodes
            workflow.add_node("web_researcher", self._execute_web_research)
            workflow.add_node("synthesizer", self._synthesize_results)

            # Add edges
            workflow.add_conditional_edges(
                "__start__",
                self._route_initial,
                {
                    "web_research": "web_researcher",
                    "skip": "__end__"
                }
            )

            workflow.add_edge("web_researcher", "synthesizer")
            workflow.add_edge("synthesizer", "__end__")

            # Compile the workflow
            return workflow.compile()
        else:
            # Return our fallback implementation
            return StateGraph(ResearchState)

    async def _route_initial(self, state: ResearchState) -> str:
        """Route to appropriate starting agent"""
        if "web_researcher" in state["enabled_agents"]:
            return "web_research"
        return "skip"

    async def _execute_web_research(self, state: ResearchState) -> ResearchState:
        """Execute web research agent"""
        await self._send_progress_update(state, "web_researcher", 10, "Starting web research...")

        try:
            result = await self.agents["web_researcher"].execute_with_timeout(state)

            await self._send_progress_update(
                state, "web_researcher", 90,
                f"Web research completed with {len(result.sources)} sources"
            )

            state["web_results"] = result.results
            state["agent_results"].append(result.dict())
            state["progress"] = 50

        except Exception as e:
            logger.error(f"Web research agent failed: {e}")
            state["errors"].append(f"Web research failed: {str(e)}")
            state["web_results"] = {}

        return state

    async def _synthesize_results(self, state: ResearchState) -> ResearchState:
        """Synthesize all agent results"""
        await self._send_progress_update(state, "synthesizer", 10, "Synthesizing research results...")

        # Basic synthesis for Phase 1
        synthesized = await self._basic_synthesis(state)

        state["synthesized_content"] = synthesized["content"]
        state["quality_score"] = synthesized["quality_score"]
        state["progress"] = 100

        await self._send_progress_update(state, "synthesizer", 100, "Research synthesis completed")

        return state

    async def _basic_synthesis(self, state: ResearchState) -> Dict[str, Any]:
        """Basic synthesis logic for Phase 1"""
        web_results = state.get("web_results", {})

        if not web_results:
            return {
                "content": f"No research results found for query: {state['query']}",
                "quality_score": 0.0
            }

        # Format results for presentation
        content = f"Research Results for: {state['query']}\n\n"

        if "primary_results" in web_results:
            content += "Key Findings:\n"
            for i, result in enumerate(web_results["primary_results"][:3], 1):
                content += f"{i}. {result['title']}\n"
                content += f"   {result['content'][:200]}...\n"
                content += f"   Source: {result['url']}\n\n"

        quality_score = web_results.get("confidence_score", 0.5)

        return {
            "content": content,
            "quality_score": quality_score
        }

    async def _send_progress_update(self, state: ResearchState, agent: str, progress: int, message: str):
        """Send progress update via WebSocket"""
        try:
            if not self.websocket_manager:
                return

            from src.models.message_models import ServerMessage

            progress_message = ServerMessage(
                type="agentic_research_progress",
                data={
                    "workflow_id": state["workflow_id"],
                    "current_agent": agent,
                    "agent_progress": progress,
                    "overall_progress": state.get("progress", 0),
                    "message": message,
                    "timestamp": datetime.now().isoformat(),
                    "enabled_agents": state["enabled_agents"]
                }
            )

            # Send via WebSocket if client is connected
            await self.websocket_manager.send_to_client(
                state["client_id"],
                progress_message.model_dump_json()
            )

        except Exception as e:
            logger.error(f"Error sending progress update: {e}")

    async def execute(self, state: ResearchState) -> ResearchState:
        """Execute the complete research workflow"""
        try:
            # Initialize workflow state
            state["workflow_id"] = f"research_{state['client_id']}_{int(datetime.now().timestamp())}"
            state["agent_results"] = []
            state["progress"] = 0
            state["errors"] = []

            if LANGGRAPH_AVAILABLE:
                # Execute workflow with LangGraph
                result = await self.workflow.ainvoke(state)
            else:
                # Fallback: manual execution
                result = state
                if "web_researcher" in state["enabled_agents"]:
                    result = await self._execute_web_research(result)
                result = await self._synthesize_results(result)

            return result

        except Exception as e:
            logger.error(f"Error executing research workflow: {e}")
            state["errors"].append(str(e))
            raise
