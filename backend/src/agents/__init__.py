"""
Agentic Research System Agents

This package contains the specialized research agents for the SlideFlip agentic research system.
"""

from .base_agent import BaseAgent, AgentResult
from .web_research_agent import WebResearchAgent

__all__ = [
    "BaseAgent",
    "AgentResult",
    "WebResearchAgent"
]

