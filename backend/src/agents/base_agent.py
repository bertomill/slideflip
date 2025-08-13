"""
Base Agent Class for Agentic Research System

Provides the foundation for all specialized research agents with standardized
execution patterns, error handling, and result formatting.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field
import asyncio
import logging
from datetime import datetime


class AgentResult(BaseModel):
    """Standard result model for all agents"""
    agent_name: str
    status: str  # success, error, timeout, skipped
    confidence_score: float = Field(ge=0.0, le=1.0)  # 0.0-1.0
    processing_time: float
    results: Dict[str, Any]
    sources: List[Dict[str, Any]]
    metadata: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None


class BaseAgent(ABC):
    """Base class for all research agents"""

    def __init__(self, name: str, timeout: int = 60):
        self.name = name
        self.timeout = timeout
        self.logger = logging.getLogger(f"agent.{name}")

    async def execute_with_timeout(self, state: Dict[str, Any]) -> AgentResult:
        """Execute agent with timeout and error handling"""
        start_time = datetime.now()

        try:
            # Execute with timeout
            result = await asyncio.wait_for(
                self.execute(state),
                timeout=self.timeout
            )

            processing_time = (datetime.now() - start_time).total_seconds()

            return AgentResult(
                agent_name=self.name,
                status="success",
                confidence_score=result.get("confidence_score", 0.5),
                processing_time=processing_time,
                results=result,
                sources=result.get("sources", []),
                metadata={"execution_time": processing_time}
            )

        except asyncio.TimeoutError:
            processing_time = (datetime.now() - start_time).total_seconds()
            self.logger.error(
                f"Agent {self.name} timed out after {processing_time}s")

            return AgentResult(
                agent_name=self.name,
                status="timeout",
                confidence_score=0.0,
                processing_time=processing_time,
                results={},
                sources=[],
                metadata={"timeout": self.timeout},
                error_message=f"Agent timed out after {self.timeout} seconds"
            )

        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds()
            self.logger.error(f"Agent {self.name} failed: {e}")

            return AgentResult(
                agent_name=self.name,
                status="error",
                confidence_score=0.0,
                processing_time=processing_time,
                results={},
                sources=[],
                metadata={"error": str(e)},
                error_message=str(e)
            )

    @abstractmethod
    async def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the agent's main functionality"""
        pass

    def _calculate_confidence(self, results: List[Dict[str, Any]]) -> float:
        """Calculate overall confidence score based on results quality"""
        if not results:
            return 0.0

        scores = [r.get("quality_score", 0.5) for r in results]
        return sum(scores) / len(scores)

    def _calculate_source_diversity(self, results: List[Dict[str, Any]]) -> float:
        """Calculate source diversity score"""
        if not results:
            return 0.0

        domains = set()
        for result in results:
            url = result.get("url", "")
            if url:
                try:
                    domain = url.split(
                        "/")[2] if len(url.split("/")) > 2 else url
                    domains.add(domain)
                except (IndexError, AttributeError):
                    continue

        return min(len(domains) / len(results), 1.0)

    def _extract_all_sources(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract and format all sources from results"""
        sources = []
        seen_urls = set()

        for result in results:
            url = result.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                sources.append({
                    "url": url,
                    "title": result.get("title", ""),
                    "score": result.get("score", 0.5),
                    "source": result.get("source", self.name)
                })

        return sources

