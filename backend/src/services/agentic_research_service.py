"""
Agentic Research Service

Service for managing agentic research workflows using LangGraph.
Coordinates multiple specialized research agents with real-time progress tracking.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import uuid

from src.workflows.research_workflow import ResearchWorkflow, ResearchState
from src.models.message_models import EnhancedResearchOptions, AgentConfig

logger = logging.getLogger(__name__)


class AgenticResearchService:
    """Service for managing agentic research workflows"""

    def __init__(self, websocket_manager=None):
        self.websocket_manager = websocket_manager
        self.workflow = ResearchWorkflow(websocket_manager)
        self.active_workflows: Dict[str, ResearchState] = {}

    async def start_research(
        self,
        query: str,
        description: str,
        options: Dict[str, Any],
        client_id: str
    ) -> Dict[str, Any]:
        """Start agentic research workflow"""
        try:
            # Parse enhanced options
            research_options = self._parse_research_options(options)

            # Determine enabled agents
            enabled_agents = self._get_enabled_agents(research_options)

            # Create initial state
            workflow_id = f"research_{client_id}_{uuid.uuid4().hex[:8]}"
            initial_state = ResearchState(
                query=query,
                description=description,
                options=research_options.dict() if hasattr(
                    research_options, 'dict') else research_options,
                client_id=client_id,
                workflow_id=workflow_id,
                enabled_agents=enabled_agents,
                current_agent="",
                progress=0,
                errors=[],
                agent_results=[],
                web_results=None,
                data_analysis=None,
                graphics_suggestions=None,
                fact_check_results=None,
                synthesized_content=None,
                quality_score=None
            )

            # Store active workflow
            self.active_workflows[workflow_id] = initial_state

            # Execute workflow
            result = await self.workflow.execute(initial_state)

            # Update stored workflow
            self.active_workflows[workflow_id] = result

            # Format final result
            return {
                "workflow_id": workflow_id,
                "status": "completed",
                "synthesized_content": result["synthesized_content"],
                "quality_score": result["quality_score"],
                "agent_results": result["agent_results"],
                "sources": self._extract_all_sources(result),
                "processing_time": self._calculate_total_time(result),
                "enabled_agents": enabled_agents,
                "cost_metrics": self.get_cost_metrics(result)
            }

        except Exception as e:
            logger.error(f"Error starting research workflow: {e}")
            raise

    def _parse_research_options(self, options: Dict[str, Any]) -> EnhancedResearchOptions:
        """Parse and validate research options"""
        try:
            # If it's already an EnhancedResearchOptions object, return it
            if isinstance(options, EnhancedResearchOptions):
                return options

            # Parse from dictionary
            return EnhancedResearchOptions(**options)
        except Exception as e:
            logger.warning(
                f"Error parsing research options, using defaults: {e}")
            # Return default options with basic web research enabled
            return EnhancedResearchOptions(
                enabled_agents={
                    "web_researcher": AgentConfig(enabled=True, priority=1, timeout=45)
                }
            )

    def _get_enabled_agents(self, options: EnhancedResearchOptions) -> List[str]:
        """Determine which agents are enabled"""
        enabled = []

        # Always include web researcher in Phase 1 if not explicitly disabled
        web_config = options.enabled_agents.get("web_researcher")
        if web_config is None or web_config.enabled:
            enabled.append("web_researcher")

        # Add other agents based on configuration (for future phases)
        for agent_name, config in options.enabled_agents.items():
            if config.enabled and agent_name not in enabled:
                enabled.append(agent_name)

        # Ensure at least web researcher is enabled
        if not enabled:
            enabled.append("web_researcher")

        return enabled

    def _extract_all_sources(self, result: ResearchState) -> List[Dict[str, Any]]:
        """Extract all sources from agent results"""
        all_sources = []

        for agent_result in result.get("agent_results", []):
            sources = agent_result.get("sources", [])
            all_sources.extend(sources)

        # Remove duplicates
        seen_urls = set()
        unique_sources = []
        for source in all_sources:
            url = source.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique_sources.append(source)

        return unique_sources

    def _calculate_total_time(self, result: ResearchState) -> float:
        """Calculate total processing time"""
        total_time = 0.0
        for agent_result in result.get("agent_results", []):
            total_time += agent_result.get("processing_time", 0.0)
        return total_time

    def get_cost_metrics(self, result: ResearchState) -> Dict[str, Any]:
        """Calculate cost metrics for transparency and optimization"""
        cost_breakdown = {"total_api_calls": 0,
                          "tavily_calls": 0, "firecrawl_calls": 0}

        for agent_result in result.get("agent_results", []):
            if agent_result.get("agent_name") == "web_researcher":
                breakdown = agent_result.get(
                    "results", {}).get("cost_breakdown", {})
                cost_breakdown["tavily_calls"] += breakdown.get(
                    "tavily_calls", 0)
                cost_breakdown["firecrawl_calls"] += breakdown.get(
                    "firecrawl_calls", 0)

        cost_breakdown["total_api_calls"] = cost_breakdown["tavily_calls"] + \
            cost_breakdown["firecrawl_calls"]

        return {
            "cost_breakdown": cost_breakdown,
            "cost_efficiency": "70-80% Tavily (low cost) + 20-30% Firecrawl (high value)",
            "estimated_savings": "60-70% vs pure Firecrawl approach"
        }

    async def get_workflow_status(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """Get status of active workflow"""
        if workflow_id in self.active_workflows:
            state = self.active_workflows[workflow_id]
            return {
                "workflow_id": workflow_id,
                "progress": state["progress"],
                "current_agent": state["current_agent"],
                "enabled_agents": state["enabled_agents"],
                "status": "active" if state["progress"] < 100 else "completed"
            }
        return None

    async def cancel_workflow(self, workflow_id: str, client_id: str) -> bool:
        """Cancel active research workflow"""
        if workflow_id in self.active_workflows:
            state = self.active_workflows[workflow_id]
            if state["client_id"] == client_id:
                # Mark as cancelled
                state["errors"].append("Workflow cancelled by user")
                del self.active_workflows[workflow_id]
                return True
        return False

    async def list_available_agents(self) -> Dict[str, Any]:
        """List available agents and their capabilities"""
        return {
            "available_agents": {
                "web_researcher": {
                    "name": "Web Research Agent",
                    "description": "Enhanced web search with multiple sources and quality assessment",
                    "capabilities": [
                        "Multi-engine search (Tavily + Firecrawl)",
                        "Query optimization and expansion",
                        "Source quality assessment",
                        "Cost-optimized hybrid strategy"
                    ],
                    "typical_duration": "10-45 seconds",
                    "dependencies": ["Tavily API (primary)", "Firecrawl API (deep research)"],
                    "enabled_by_default": True
                }
            },
            "preset_configurations": {
                "quick_research": {
                    "name": "Quick Research",
                    "description": "Fast research with web agent only",
                    "enabled_agents": {
                        "web_researcher": {"enabled": True, "timeout": 20}
                    },
                    "recommended_for": ["time_sensitive", "basic_research"]
                },
                "standard_research": {
                    "name": "Standard Research",
                    "description": "Balanced research with web agent",
                    "enabled_agents": {
                        "web_researcher": {"enabled": True, "timeout": 45}
                    },
                    "recommended_for": ["general_purpose", "presentations"]
                },
                "comprehensive_research": {
                    "name": "Comprehensive Research",
                    "description": "Deep research with all available agents",
                    "enabled_agents": {
                        "web_researcher": {"enabled": True, "priority": 1, "timeout": 60}
                    },
                    "recommended_for": ["detailed_analysis", "executive_presentations"]
                }
            }
        }

    async def get_research_history(self, client_id: str, limit: int = 20) -> Dict[str, Any]:
        """Get research history for a client"""
        # In a real implementation, this would query a database
        # For now, return active workflows for this client
        client_workflows = []

        for workflow_id, state in self.active_workflows.items():
            if state["client_id"] == client_id:
                client_workflows.append({
                    "workflow_id": workflow_id,
                    "query": state["query"],
                    "description": state["description"],
                    "status": "completed" if state["progress"] >= 100 else "active",
                    "quality_score": state.get("quality_score", 0.0),
                    "enabled_agents": state["enabled_agents"],
                    "created_at": datetime.now().isoformat(),  # Would be stored timestamp
                    "processing_time": self._calculate_total_time(state)
                })

        return {
            "client_id": client_id,
            "total_count": len(client_workflows),
            "results": client_workflows[:limit],
            "pagination": {
                "limit": limit,
                "offset": 0,
                "has_more": len(client_workflows) > limit
            }
        }

