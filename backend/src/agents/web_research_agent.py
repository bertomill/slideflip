"""
Enhanced Web Research Agent

Cost-optimized web research agent with hybrid Tavily-Firecrawl strategy.
Uses Tavily for primary search (70-80% of content) and Firecrawl for deep research (20-30%).
"""

from .base_agent import BaseAgent
from typing import Dict, Any, List, Optional
import asyncio
import aiohttp
import logging
from datetime import datetime


class WebResearchAgent(BaseAgent):
    """Cost-optimized web research agent with hybrid Tavily-Firecrawl strategy"""

    def __init__(self):
        super().__init__("web_researcher", timeout=45)
        self.tavily_client = None
        self.firecrawl_client = None
        self._initialize_clients()

    def _initialize_clients(self):
        """Initialize search API clients"""
        try:
            from src.core.config import Settings
            settings = Settings()

            # Initialize Tavily (primary search engine)
            if settings.TAVILY_API_KEY:
                try:
                    from tavily import TavilyClient
                    self.tavily_client = TavilyClient(
                        api_key=settings.TAVILY_API_KEY)
                    self.logger.info("Tavily client initialized successfully")
                except ImportError:
                    self.logger.warning(
                        "Tavily client not available - install tavily-python")
                except Exception as e:
                    self.logger.error(f"Error initializing Tavily client: {e}")

            # Initialize Firecrawl (deep research engine)
            if settings.FIRECRAWL_API_KEY:
                try:
                    from firecrawl import FirecrawlApp
                    self.firecrawl_client = FirecrawlApp(
                        api_key=settings.FIRECRAWL_API_KEY)
                    self.logger.info(
                        "Firecrawl client initialized successfully")
                except ImportError:
                    self.logger.warning(
                        "Firecrawl client not available - install firecrawl-py")
                except Exception as e:
                    self.logger.error(
                        f"Error initializing Firecrawl client: {e}")

        except Exception as e:
            self.logger.error(f"Error initializing clients: {e}")

    async def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Execute cost-optimized hybrid web research"""
        query = state["query"]
        description = state["description"]
        options = state["options"]

        self.logger.info(f"Starting web research for query: {query[:100]}...")

        # Step 1: Primary Tavily search (70-80% of content)
        tavily_results = []
        if self.tavily_client:
            tavily_results = await self._search_tavily(query, description, options)
        else:
            self.logger.warning(
                "Tavily client not available, skipping primary search")

        # Step 2: Determine if deep research is needed
        research_depth = options.get("research_depth", "standard")
        quality_threshold = options.get("quality_threshold", 0.7)

        # Step 3: Conditional Firecrawl deep research (20-30% of content)
        firecrawl_results = []
        if (research_depth == "comprehensive" or
                self._should_trigger_deep_research(tavily_results, quality_threshold)):
            if self.firecrawl_client:
                firecrawl_results = await self._deep_research_firecrawl(
                    query, description, tavily_results, options
                )
            else:
                self.logger.warning(
                    "Firecrawl client not available, skipping deep research")

        # Step 4: Combine and balance results (maintain 70-80% / 20-30% ratio)
        combined_results = await self._balance_search_results(
            tavily_results, firecrawl_results, options
        )

        # Query expansion
        expanded_queries = await self._expand_query(query, description)

        # Source quality assessment
        quality_scored_results = await self._assess_source_quality(combined_results)

        # Calculate confidence score
        confidence_score = self._calculate_confidence(quality_scored_results)

        return {
            "primary_results": quality_scored_results[:options.get("maxResults", 5)],
            "expanded_queries": expanded_queries,
            "source_diversity": self._calculate_source_diversity(quality_scored_results),
            "confidence_score": confidence_score,
            "sources": self._extract_all_sources(quality_scored_results[:10]),
            "cost_breakdown": self._calculate_cost_breakdown(tavily_results, firecrawl_results),
            "search_strategy": "hybrid_tavily_firecrawl"
        }

    async def _search_tavily(self, query: str, description: str, options: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Enhanced Tavily search with better query construction"""
        try:
            # Build optimized search query
            search_query = self._build_optimized_query(
                query, description, options)

            # Configure search options
            search_options = {
                "search_depth": "advanced",
                "max_results": options.get("maxResults", 5),
                "include_answer": options.get("includeAnswer", True),
                "include_images": options.get("includeImages", False),
            }

            # Add domain exclusions
            if options.get("excludeSocial", True):
                search_options["exclude_domains"] = [
                    'reddit.com', 'twitter.com', 'facebook.com', 'instagram.com'
                ]

            # Execute search
            self.logger.info(
                f"Executing Tavily search with query: {search_query[:100]}...")
            result = await asyncio.to_thread(
                self.tavily_client.search,
                search_query,
                **search_options
            )

            # Format results
            formatted_results = []
            for item in result.get("results", []):
                formatted_results.append({
                    "title": item.get("title", ""),
                    "content": item.get("content", ""),
                    "url": item.get("url", ""),
                    "score": item.get("score", 0.5),
                    "source": "tavily"
                })

            self.logger.info(
                f"Tavily search returned {len(formatted_results)} results")
            return formatted_results

        except Exception as e:
            self.logger.error(f"Tavily search error: {e}")
            return []

    async def _deep_research_firecrawl(
        self,
        query: str,
        description: str,
        tavily_results: List[Dict[str, Any]],
        options: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Deep research using Firecrawl for high-value content extraction"""
        try:
            if not self.firecrawl_client:
                return []

            # Select high-quality URLs from Tavily results for deep crawling
            candidate_urls = self._select_urls_for_deep_research(
                tavily_results)

            if not candidate_urls:
                # Fallback: search for URLs to crawl
                candidate_urls = await self._find_urls_for_crawling(query, description)

            firecrawl_results = []

            # Limit to 2-3 URLs to control costs (20-30% of total content)
            max_urls = min(len(candidate_urls), 3)
            self.logger.info(f"Deep research on {max_urls} URLs")

            for url in candidate_urls[:max_urls]:
                try:
                    # Use Firecrawl to extract detailed content
                    crawl_result = await asyncio.to_thread(
                        self.firecrawl_client.scrape_url,
                        url
                    )

                    if crawl_result and crawl_result.success:
                        firecrawl_results.append({
                            "title": crawl_result.metadata.get('title', 'Deep Research Content') if crawl_result.metadata else 'Deep Research Content',
                            "content": (crawl_result.markdown or '')[:1000],
                            "url": url,
                            "score": 0.85,  # High score for deep research
                            "source": "firecrawl",
                            "content_type": "deep_research",
                            "extraction_quality": "high"
                        })

                except Exception as crawl_error:
                    self.logger.warning(
                        f"Failed to crawl {url}: {crawl_error}")
                    continue

            self.logger.info(
                f"Firecrawl deep research returned {len(firecrawl_results)} results")
            return firecrawl_results

        except Exception as e:
            self.logger.error(f"Firecrawl deep research error: {e}")
            return []

    def _select_urls_for_deep_research(self, tavily_results: List[Dict[str, Any]]) -> List[str]:
        """Select high-quality URLs from Tavily results for deep research"""
        candidate_urls = []

        # Sort by score and select top-quality sources
        sorted_results = sorted(
            tavily_results,
            key=lambda x: x.get('score', 0),
            reverse=True
        )

        for result in sorted_results[:5]:  # Top 5 candidates
            url = result.get('url', '')
            score = result.get('score', 0)

            # Only select high-quality sources for expensive deep research
            if score > 0.7 and url and self._is_suitable_for_deep_research(url):
                candidate_urls.append(url)

        return candidate_urls

    def _is_suitable_for_deep_research(self, url: str) -> bool:
        """Check if URL is suitable for deep research (cost-effective)"""
        # Prefer authoritative domains for deep research
        authoritative_domains = [
            'gov', 'edu', 'org', 'reuters.com', 'bloomberg.com',
            'wsj.com', 'economist.com', 'harvard.edu', 'mit.edu'
        ]

        # Avoid social media and low-value domains
        avoid_domains = [
            'reddit.com', 'twitter.com', 'facebook.com', 'instagram.com',
            'tiktok.com', 'youtube.com'
        ]

        try:
            domain = url.split('/')[2] if len(url.split('/')) > 2 else url
        except (IndexError, AttributeError):
            return False

        # Check for authoritative domains
        if any(auth_domain in domain for auth_domain in authoritative_domains):
            return True

        # Avoid low-value domains
        if any(avoid_domain in domain for avoid_domain in avoid_domains):
            return False

        # Default: suitable if not explicitly avoided
        return True

    async def _find_urls_for_crawling(self, query: str, description: str) -> List[str]:
        """Fallback method to find URLs for crawling when Tavily results are insufficient"""
        # Simple implementation - in production, this could use a lightweight search
        # For now, return empty list to avoid additional API costs
        return []

    def _should_trigger_deep_research(
        self,
        tavily_results: List[Dict[str, Any]],
        quality_threshold: float
    ) -> bool:
        """Determine if deep research should be triggered based on quality metrics"""
        if not tavily_results:
            return True  # No results, try deep research

        # Calculate average quality score
        scores = [r.get('score', 0.5) for r in tavily_results]
        avg_score = sum(scores) / len(scores) if scores else 0.5

        # Trigger deep research if quality is below threshold
        return avg_score < quality_threshold

    async def _balance_search_results(
        self,
        tavily_results: List[Dict[str, Any]],
        firecrawl_results: List[Dict[str, Any]],
        options: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Balance results to maintain 70-80% Tavily, 20-30% Firecrawl ratio"""
        max_results = options.get("maxResults", 5)

        # Calculate target distribution
        tavily_target = int(max_results * 0.75)  # 75% Tavily
        firecrawl_target = max_results - tavily_target  # 25% Firecrawl

        # Take top results from each source
        balanced_results = []

        # Add Tavily results (70-80%)
        balanced_results.extend(tavily_results[:tavily_target])

        # Add Firecrawl results (20-30%)
        balanced_results.extend(firecrawl_results[:firecrawl_target])

        return balanced_results

    def _calculate_cost_breakdown(
        self,
        tavily_results: List[Dict[str, Any]],
        firecrawl_results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate cost breakdown for transparency"""
        total_sources = len(tavily_results) + len(firecrawl_results)

        return {
            "tavily_calls": len(tavily_results),
            "firecrawl_calls": len(firecrawl_results),
            "total_sources": total_sources,
            "cost_ratio": {
                "tavily_percentage": (len(tavily_results) / total_sources * 100) if total_sources > 0 else 0,
                "firecrawl_percentage": (len(firecrawl_results) / total_sources * 100) if total_sources > 0 else 0
            },
            "estimated_cost_savings": "60-70% vs pure Firecrawl approach"
        }

    def _build_optimized_query(self, query: str, description: str, options: Dict[str, Any]) -> str:
        """Build optimized search query"""
        # Start with base query
        search_query = query[:200]

        # Add description if space allows
        if description and len(search_query) < 300:
            remaining_space = 350 - len(search_query)
            search_query += f" {description[:remaining_space]}"

        # Add focus keywords based on presentation style
        style = options.get("presentationStyle", "executive")
        style_keywords = {
            "executive": "insights trends business",
            "technical": "analysis data research",
            "educational": "examples case studies"
        }

        if style in style_keywords and len(search_query) < 370:
            search_query += f" {style_keywords[style]}"

        return search_query[:400]  # Tavily limit

    async def _expand_query(self, query: str, description: str) -> List[str]:
        """Generate expanded search queries"""
        # Simple expansion for Phase 1
        expansions = []

        # Add synonyms and related terms
        if "market" in query.lower():
            expansions.append(query.replace("market", "industry"))
        if "trend" in query.lower():
            expansions.append(query.replace("trend", "pattern"))

        # Add specific focus queries
        expansions.extend([
            f"{query} statistics data",
            f"{query} case study example",
            f"{query} best practices"
        ])

        return expansions[:3]  # Limit for Phase 1

    async def _assess_source_quality(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Assess and score source quality"""
        for result in results:
            # Basic quality scoring
            quality_score = 0.5  # Base score

            # Domain reputation scoring
            url = result.get("url", "")
            if url:
                try:
                    domain = url.split("/")[2]
                    if any(trusted in domain for trusted in ["gov", "edu", "org"]):
                        quality_score += 0.2
                    if any(news in domain for news in ["reuters", "bloomberg", "wsj"]):
                        quality_score += 0.15
                except (IndexError, AttributeError):
                    pass

            # Content quality indicators
            content = result.get("content", "")
            if len(content) > 100:  # Substantial content
                quality_score += 0.1
            if any(indicator in content.lower() for indicator in ["study", "research", "analysis"]):
                quality_score += 0.1

            result["quality_score"] = min(quality_score, 1.0)

        # Sort by quality score
        return sorted(results, key=lambda x: x.get("quality_score", 0), reverse=True)
