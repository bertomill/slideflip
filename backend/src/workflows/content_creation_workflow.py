"""
LangGraph-based Content Creation Workflow

This workflow uses LangGraph to orchestrate content creation with proper agent behavior,
state management, and tool usage instead of direct OpenAI calls.
"""

import logging
from typing import Dict, Any, Optional, List, TypedDict
from datetime import datetime
import json

from langgraph.graph import StateGraph, END, START
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

from src.core.config import Settings
from src.core.simple_prompt_manager import get_prompt_manager

logger = logging.getLogger(__name__)


# Pydantic models for structured output
class ContentSection(BaseModel):
    """Model for a content section"""
    title: str = Field(..., description="Section title")
    description: str = Field(..., description="Detailed section description")


class ContentPlan(BaseModel):
    """Model for structured content plan output"""
    title: str = Field(..., description="Engaging presentation title")
    main_sections: List[ContentSection] = Field(..., description="Array of content sections")
    key_messages: List[str] = Field(..., description="Key points to emphasize")
    estimated_duration: str = Field(..., description="Estimated presentation time")


class ContentAnalysis(BaseModel):
    """Model for content analysis output"""
    content_quality_score: int = Field(..., ge=0, le=100, description="Content quality score (0-100)")
    requires_research: bool = Field(..., description="Whether research enhancement would be beneficial")
    suggested_sections: List[str] = Field(..., description="Suggested section titles")
    content_complexity: str = Field(..., description="Content complexity level: low, medium, or high")


class ContentCreationState(TypedDict):
    """State for content creation workflow"""
    uploaded_content: str
    user_description: str
    theme_info: Optional[Dict[str, Any]]
    research_data: Optional[str]
    content_style: str
    use_ai_agent: bool
    
    # Processing state
    current_step: str
    content_plan: str
    sections: Dict[str, Any]
    metadata: Dict[str, Any]
    errors: List[str]
    completed: bool


class ContentCreationWorkflow:
    """
    LangGraph workflow for content creation with agentic behavior
    """
    
    def __init__(self):
        self.settings = Settings()
        self.prompt_manager = get_prompt_manager()
        self.llm = ChatOpenAI(
            api_key=self.settings.OPENAI_API_KEY,
            model="gpt-3.5-turbo",
            temperature=0.7
        )
        
        # Create structured output parsers (industry standard approach)
        self.analysis_parser = JsonOutputParser(pydantic_object=ContentAnalysis)
        self.content_parser = JsonOutputParser(pydantic_object=ContentPlan)
        
        self.workflow = self._build_workflow()
        
    def _build_workflow(self) -> StateGraph:
        """Build the LangGraph workflow for content creation"""
        
        # Create workflow graph
        workflow = StateGraph(ContentCreationState)
        
        # Add nodes
        workflow.add_node("analyze_input", self._analyze_input_node)
        workflow.add_node("plan_content", self._plan_content_node)
        workflow.add_node("enhance_with_research", self._enhance_with_research_node)
        workflow.add_node("generate_sections", self._generate_sections_node)
        workflow.add_node("finalize_content", self._finalize_content_node)
        workflow.add_node("handle_error", self._handle_error_node)
        
        # Set entry point
        workflow.set_entry_point("analyze_input")
        
        # Add conditional edges
        workflow.add_conditional_edges(
            "analyze_input",
            self._should_continue_from_analysis,
            {
                "plan": "plan_content",
                "error": "handle_error"
            }
        )
        
        workflow.add_conditional_edges(
            "plan_content",
            self._should_enhance_with_research,
            {
                "enhance": "enhance_with_research",
                "generate": "generate_sections",
                "error": "handle_error"
            }
        )
        
        workflow.add_edge("enhance_with_research", "generate_sections")
        workflow.add_edge("generate_sections", "finalize_content")
        workflow.add_edge("finalize_content", END)
        workflow.add_edge("handle_error", END)
        
        return workflow.compile()
    
    async def create_content(
        self,
        uploaded_content: str,
        user_description: str,
        theme_info: Optional[Dict[str, Any]] = None,
        research_data: Optional[str] = None,
        use_ai_agent: bool = False,
        content_style: str = "professional"
    ) -> Dict[str, Any]:
        """
        Execute the content creation workflow
        """
        try:
            logger.info("🚀 Starting LangGraph content creation workflow")
            
            # Initialize state
            initial_state = ContentCreationState(
                uploaded_content=uploaded_content,
                user_description=user_description,
                theme_info=theme_info,
                research_data=research_data,
                content_style=content_style,
                use_ai_agent=use_ai_agent,
                current_step="starting",
                content_plan="",
                sections={},
                metadata={
                    "workflow_start": datetime.now().isoformat(),
                    "generation_mode": "langgraph_workflow"
                },
                errors=[],
                completed=False
            )
            
            # Execute workflow
            result = await self.workflow.ainvoke(initial_state)
            
            if result.get("completed"):
                logger.info("✅ LangGraph workflow completed successfully")
                return self._format_workflow_result(result)
            else:
                logger.error("❌ LangGraph workflow failed")
                return self._format_error_result(result)
                
        except Exception as e:
            logger.error(f"Error in LangGraph workflow: {e}")
            return self._format_fallback_result(uploaded_content, user_description, str(e))
    
    async def _analyze_input_node(self, state: ContentCreationState) -> ContentCreationState:
        """Analyze input using LangChain structured output chaining (industry standard)"""
        try:
            logger.info("📊 Analyzing input with LangChain structured output")
            
            state["current_step"] = "analyzing_input"
            
            # Create prompt with format instructions
            analysis_prompt = ChatPromptTemplate.from_messages([
                ("system", """You are an expert content analyst. Analyze the provided content and user requirements.

                Analyze:
                1. Content quality and completeness (rate 0-100)
                2. User description specificity 
                3. Whether research enhancement would be beneficial
                4. Content complexity level: "low", "medium", or "high"
                
                {format_instructions}
                """),
                ("human", """
                User Description: {user_description}
                Content Style: {content_style}
                Use AI Agent: {use_ai_agent}
                
                Uploaded Content:
                {uploaded_content}
                
                Research Available: {has_research}
                """)
            ])
            
            # Format prompt with parser instructions
            formatted_prompt = analysis_prompt.partial(
                format_instructions=self.analysis_parser.get_format_instructions()
            )
            
            # Create the full chain: prompt -> LLM -> structured parser
            analysis_chain = formatted_prompt | self.llm | self.analysis_parser
            
            # Execute the chain for guaranteed structured output
            analysis_result = await analysis_chain.ainvoke({
                "user_description": state["user_description"],
                "content_style": state["content_style"],
                "use_ai_agent": state["use_ai_agent"],
                "uploaded_content": state["uploaded_content"][:1000] + "..." if len(state["uploaded_content"]) > 1000 else state["uploaded_content"],
                "has_research": bool(state["research_data"])
            })
            
            # Result is already a Pydantic object - no parsing needed!
            state["metadata"]["analysis"] = analysis_result.dict() if hasattr(analysis_result, 'dict') else analysis_result
            logger.info(f"✅ LangChain structured analysis completed: quality={analysis_result.get('content_quality_score', 'unknown')}")
            
            return state
            
        except Exception as e:
            logger.error(f"Error in analyze_input_node: {e}")
            # Fallback analysis
            state["metadata"]["analysis"] = {
                "content_quality_score": 70, 
                "requires_research": False,
                "suggested_sections": ["Introduction", "Main Content", "Conclusion"],
                "content_complexity": "medium"
            }
            state["errors"].append(f"Analysis failed: {str(e)}")
            return state
    
    async def _plan_content_node(self, state: ContentCreationState) -> ContentCreationState:
        """Plan content using LangChain structured output chaining (industry standard)"""
        try:
            logger.info("📝 Planning content with LangChain structured output")
            
            state["current_step"] = "planning_content"
            
            # Create prompt with format instructions
            planning_prompt = ChatPromptTemplate.from_messages([
                ("system", """You are an expert content planner. Create a comprehensive content plan for a presentation.

{format_instructions}

Create an engaging title, 3-5 main sections with clear titles and descriptions, key messages, and estimated duration."""),
                ("human", """Create a detailed content plan for: {user_description}

Content Style: {content_style}
Analysis Results: {analysis}

Source Material: {uploaded_content}

Make it engaging and well-structured for the specified content style.""")
            ])
            
            # Format prompt with parser instructions
            formatted_prompt = planning_prompt.partial(
                format_instructions=self.content_parser.get_format_instructions()
            )
            
            # Create the full chain: prompt -> LLM -> structured parser
            planning_chain = formatted_prompt | self.llm | self.content_parser
            
            # Execute the chain with error handling
            try:
                content_plan_result = await planning_chain.ainvoke({
                    "user_description": state["user_description"],
                    "content_style": state["content_style"],
                    "analysis": state["metadata"].get("analysis", {}),
                    "uploaded_content": state["uploaded_content"][:1500] + "..." if len(state["uploaded_content"]) > 1500 else state["uploaded_content"]
                })
                
                # Debug: Log the result type and structure
                logger.info(f"Content plan result type: {type(content_plan_result)}")
                logger.info(f"Content plan result: {str(content_plan_result)[:200]}...")
                
                # JsonOutputParser should return a dict directly
                if isinstance(content_plan_result, dict):
                    content_plan_dict = content_plan_result
                elif hasattr(content_plan_result, 'dict'):
                    content_plan_dict = content_plan_result.dict()
                else:
                    # Fallback: try to convert to dict
                    content_plan_dict = dict(content_plan_result) if hasattr(content_plan_result, '__iter__') else {}
                
                # Validate required fields and fix if needed
                if 'title' not in content_plan_dict:
                    content_plan_dict['title'] = f"Presentation: {state['user_description']}"
                
                if 'main_sections' not in content_plan_dict or not isinstance(content_plan_dict['main_sections'], list):
                    content_plan_dict['main_sections'] = [
                        {"title": "Introduction", "description": "Overview and objectives"},
                        {"title": "Main Content", "description": "Core information"},
                        {"title": "Conclusion", "description": "Summary and next steps"}
                    ]
                
                if 'key_messages' not in content_plan_dict:
                    content_plan_dict['key_messages'] = ["Key insights from content"]
                
                if 'estimated_duration' not in content_plan_dict:
                    content_plan_dict['estimated_duration'] = "15-20 minutes"
                
                sections_count = len(content_plan_dict.get('main_sections', []))
                logger.info(f"✅ Content plan created with {sections_count} sections")
                
            except Exception as parse_error:
                logger.error(f"Chain execution failed: {parse_error}")
                # Create complete fallback
                content_plan_dict = {
                    "title": f"Presentation: {state['user_description']}",
                    "main_sections": [
                        {"title": "Introduction", "description": "Overview and objectives"},
                        {"title": "Main Content", "description": "Core information from uploaded content"},
                        {"title": "Conclusion", "description": "Summary and next steps"}
                    ],
                    "key_messages": ["Key insights from uploaded content"],
                    "estimated_duration": "15-20 minutes"
                }
                state["metadata"]["chain_parse_error"] = str(parse_error)
            
            state["content_plan"] = json.dumps(content_plan_dict, indent=2)
            state["metadata"]["planning"] = content_plan_dict
            
            return state
            
        except Exception as e:
            logger.error(f"Error in plan_content_node: {e}")
            
            # Create structured fallback plan
            fallback_plan = ContentPlan(
                title=f"Presentation: {state['user_description']}",
                main_sections=[
                    ContentSection(title="Introduction", description="Overview and objectives"),
                    ContentSection(title="Main Content", description="Core information from uploaded content"),
                    ContentSection(title="Conclusion", description="Summary and next steps")
                ],
                key_messages=["Key insights from uploaded content"],
                estimated_duration="15-20 minutes"
            )
            
            fallback_dict = fallback_plan.dict()
            state["content_plan"] = json.dumps(fallback_dict, indent=2)
            state["metadata"]["planning"] = fallback_dict
            state["metadata"]["used_fallback_planning"] = True
            state["metadata"]["planning_error"] = str(e)
            state["errors"].append(f"Content planning failed: {str(e)}")
            
            return state
    
    async def _enhance_with_research_node(self, state: ContentCreationState) -> ContentCreationState:
        """Enhance content plan with research data"""
        try:
            logger.info("🔍 Enhancing content with research")
            
            state["current_step"] = "enhancing_with_research"
            
            if not state["research_data"]:
                logger.info("No research data available, skipping enhancement")
                return state
            
            enhancement_prompt = ChatPromptTemplate.from_messages([
                ("system", """You are a research integration specialist. Enhance the existing content plan by incorporating relevant research data while maintaining the original structure and focus."""),
                ("human", """
                Original Content Plan:
                {content_plan}
                
                Research Data to Integrate:
                {research_data}
                
                Enhance the content plan by:
                1. Adding relevant research insights
                2. Including supporting data and statistics
                3. Enriching examples with research findings
                4. Maintaining the original structure
                
                Return the enhanced plan in the same JSON format.
                """)
            ])
            
            messages = enhancement_prompt.format_messages(
                content_plan=state["content_plan"],
                research_data=state["research_data"][:1000] + "..." if len(state["research_data"]) > 1000 else state["research_data"]
            )
            
            enhanced_response = await self.llm.ainvoke(messages)
            
            # Update content plan with research enhancements
            try:
                enhanced_plan = json.loads(enhanced_response.content)
                state["content_plan"] = json.dumps(enhanced_plan, indent=2)
                state["metadata"]["research_enhanced"] = True
                logger.info("✅ Content plan enhanced with research data")
            except json.JSONDecodeError:
                logger.warning("Failed to parse enhanced plan, keeping original")
                state["metadata"]["research_enhanced"] = False
            
            return state
            
        except Exception as e:
            logger.error(f"Error in enhance_with_research_node: {e}")
            state["errors"].append(f"Research enhancement failed: {str(e)}")
            return state
    
    async def _generate_sections_node(self, state: ContentCreationState) -> ContentCreationState:
        """Generate detailed content for each section"""
        try:
            logger.info("🏗️ Generating detailed section content")
            
            state["current_step"] = "generating_sections"
            
            # Parse content plan to get sections with better error handling
            try:
                plan_data = json.loads(state["content_plan"])
                sections = plan_data.get("main_sections", [])
                
                # Ensure sections have the right structure
                if sections and isinstance(sections[0], dict):
                    # Already in correct format
                    pass
                else:
                    # Convert to correct format if needed
                    sections = [{"title": "Main Content", "description": state["content_plan"]}]
                    
            except (json.JSONDecodeError, KeyError, TypeError) as e:
                logger.warning(f"Failed to parse content plan: {e}, using fallback sections")
                # Create fallback sections based on user description
                sections = [
                    {"title": "Introduction", "description": f"Overview of {state['user_description']}"},
                    {"title": "Main Content", "description": "Core information and insights"},
                    {"title": "Conclusion", "description": "Summary and next steps"}
                ]
            
            generated_sections = {}
            
            for i, section in enumerate(sections):
                try:
                    section_prompt = ChatPromptTemplate.from_messages([
                        ("system", """You are an expert content creator. Generate detailed, engaging content for a presentation section based on the provided outline and context."""),
                        ("human", """
                        Section Title: {section_title}
                        Section Description: {section_description}
                        
                        Content Style: {content_style}
                        Overall Context: {user_description}
                        
                        Source Material: {uploaded_content}
                        
                        Generate comprehensive content for this section including:
                        - Detailed explanations
                        - Key points and insights
                        - Relevant examples
                        - Supporting details
                        
                        Make it engaging and informative for a presentation audience.
                        """)
                    ])
                    
                    messages = section_prompt.format_messages(
                        section_title=section.get("title", f"Section {i+1}"),
                        section_description=section.get("description", ""),
                        content_style=state["content_style"],
                        user_description=state["user_description"],
                        uploaded_content=state["uploaded_content"][:1000] + "..." if len(state["uploaded_content"]) > 1000 else state["uploaded_content"]
                    )
                    
                    section_response = await self.llm.ainvoke(messages)
                    
                    generated_sections[f"section_{i}"] = {
                        "title": section.get("title", f"Section {i+1}"),
                        "content": section_response.content,
                        "style_notes": f"Generated for {state['content_style']} style"
                    }
                    
                    logger.info(f"✅ Generated content for section: {section.get('title', f'Section {i+1}')}")
                    
                except Exception as e:
                    logger.warning(f"Failed to generate section {i}: {e}")
                    generated_sections[f"section_{i}"] = {
                        "title": section.get("title", f"Section {i+1}"),
                        "content": f"Content for {section.get('title', f'Section {i+1}')}",
                        "style_notes": "Fallback content"
                    }
            
            state["sections"] = generated_sections
            logger.info(f"✅ Generated {len(generated_sections)} content sections")
            
            return state
            
        except Exception as e:
            logger.error(f"Error in generate_sections_node: {e}")
            state["errors"].append(f"Section generation failed: {str(e)}")
            return state
    
    async def _finalize_content_node(self, state: ContentCreationState) -> ContentCreationState:
        """Finalize and format the complete content"""
        try:
            logger.info("🎯 Finalizing content")
            
            state["current_step"] = "finalizing"
            
            # Add final metadata
            state["metadata"].update({
                "workflow_end": datetime.now().isoformat(),
                "sections_generated": len(state["sections"]),
                "has_errors": len(state["errors"]) > 0,
                "processing_steps": [
                    "analyze_input",
                    "plan_content",
                    "enhance_with_research" if state["research_data"] else None,
                    "generate_sections",
                    "finalize_content"
                ]
            })
            
            # Calculate slide count
            slide_count = max(3, len(state["sections"]))
            state["metadata"]["slide_count"] = slide_count
            
            state["completed"] = True
            logger.info("✅ Content creation workflow completed successfully")
            
            return state
            
        except Exception as e:
            logger.error(f"Error in finalize_content_node: {e}")
            state["errors"].append(f"Finalization failed: {str(e)}")
            return state
    
    async def _handle_error_node(self, state: ContentCreationState) -> ContentCreationState:
        """Handle errors and provide fallback content"""
        logger.warning("⚠️ Handling workflow errors")
        
        state["current_step"] = "error_handling"
        
        # Create fallback content
        fallback_content = {
            "section_0": {
                "content": f"Overview: {state['user_description']}",
                "style_notes": "Introduction section"
            },
            "section_1": {
                "content": f"Key content from uploaded materials: {state['uploaded_content'][:300]}...",
                "style_notes": "Main content section"
            },
            "section_2": {
                "content": "Additional information and conclusions will be provided here.",
                "style_notes": "Conclusion section"
            }
        }
        
        state["sections"] = fallback_content
        state["content_plan"] = f"Fallback content plan for: {state['user_description']}"
        state["metadata"]["fallback_used"] = True
        state["completed"] = True
        
        return state
    
    def _should_continue_from_analysis(self, state: ContentCreationState) -> str:
        """Determine next step after analysis"""
        if state["errors"]:
            return "error"
        return "plan"
    
    def _should_enhance_with_research(self, state: ContentCreationState) -> str:
        """Determine if research enhancement is needed"""
        if state["errors"]:
            return "error"
        
        if state["research_data"] and state["use_ai_agent"]:
            return "enhance"
        
        return "generate"
    
    def _format_workflow_result(self, state: ContentCreationState) -> Dict[str, Any]:
        """Format successful workflow result"""
        return {
            "title": f"Presentation: {state['user_description']}",
            "content_plan": state["content_plan"],
            "slide_count": state["metadata"].get("slide_count", 3),
            "generation_mode": "langgraph_workflow",
            "metadata": state["metadata"],
            **state["sections"]
        }
    
    def _format_error_result(self, state: ContentCreationState) -> Dict[str, Any]:
        """Format error result"""
        return {
            "title": f"Presentation: {state['user_description']}",
            "content_plan": state.get("content_plan", "Content generation failed"),
            "slide_count": len(state.get("sections", {})) or 1,
            "generation_mode": "langgraph_workflow_error",
            "errors": state["errors"],
            "metadata": state["metadata"],
            **state.get("sections", {})
        }
    
    def _format_fallback_result(self, uploaded_content: str, user_description: str, error: str) -> Dict[str, Any]:
        """Format fallback result when workflow fails completely"""
        return {
            "title": f"Presentation: {user_description}",
            "content_plan": f"Fallback content for: {user_description}",
            "slide_count": 3,
            "generation_mode": "fallback",
            "fallback_reason": error,
            "section_0": {
                "content": f"Overview: {user_description}",
                "style_notes": "Introduction"
            },
            "section_1": {
                "content": f"Content: {uploaded_content[:200]}...",
                "style_notes": "Main content"
            },
            "section_2": {
                "content": "Conclusion and next steps",
                "style_notes": "Conclusion"
            }
        }