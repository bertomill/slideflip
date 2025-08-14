# AI System Architecture Refactoring

## Overview

This document describes the comprehensive refactoring of the SlideFlip backend AI system to use LangGraph workflows and structured prompt templates for better maintainability, monitoring, and scalability.

## Key Improvements

### 1. Structured Prompt Management

**Before:** Hardcoded prompts scattered throughout the codebase
**After:** Centralized YAML-based prompt templates with variable substitution

```
backend/src/prompts/
├── slide_generation/
│   ├── slide_html_generation.yaml
│   └── content_planning.yaml
├── color_palette/
│   └── palette_generation.yaml
└── research_agents/
    ├── web_research.yaml
    └── search_query_optimization.yaml
```

**Benefits:**

- Easy prompt modification without code changes
- Version control for prompts
- Variable substitution with Jinja2 templates
- Built-in validation and monitoring
- Template reusability across different contexts

### 2. LangGraph Workflow Architecture

**Before:** Single-point OpenAI API calls without proper orchestration
**After:** Comprehensive LangGraph workflow with proper state management

```python
# Workflow Steps:
1. Content Planning → 2. File Processing → 3. Research Integration → 4. Slide Generation → 5. Quality Validation
```

**Features:**

- Conditional routing based on available data
- Proper error handling and recovery
- Step-by-step progress tracking
- Comprehensive state management
- Scalable workflow execution

### 3. Monitoring and Observability

**New Features:**

- Real-time workflow execution tracking
- Prompt usage metrics and performance monitoring
- Token consumption and cost tracking
- Error rate and success metrics
- Performance trends and optimization insights

**Monitoring Endpoints:**

- `/monitoring/health` - Health check
- `/monitoring/metrics/system` - System performance
- `/monitoring/metrics/workflows` - Workflow statistics
- `/monitoring/metrics/prompts` - Prompt usage metrics
- `/monitoring/metrics/summary` - Comprehensive overview

### 4. Enhanced File Upload Integration

**Improvements:**

- Seamless integration of uploaded files into the workflow
- Proper content extraction and summarization
- Context-aware prompt generation based on file content
- Support for multiple file types and formats

## Architecture Components

### Core Services

#### 1. PromptManager (`src/core/prompt_manager.py`)

- Loads and manages YAML prompt templates
- Provides variable substitution with Jinja2
- Tracks usage metrics and performance
- Validates template structure and variables

#### 2. SlideGenerationWorkflow (`src/workflows/slide_generation_workflow.py`)

- Orchestrates the complete slide generation process
- Manages workflow state and conditional routing
- Integrates with monitoring and progress tracking
- Handles error recovery and fallback strategies

#### 3. MonitoringService (`src/core/monitoring.py`)

- Tracks workflow execution metrics
- Monitors prompt usage and performance
- Provides observability hooks for external systems
- Manages data retention and cleanup

#### 4. Enhanced AIService (`src/services/ai_service.py`)

- Refactored to use workflow-based approach
- Integration with structured prompt templates
- Improved error handling and validation
- Support for different AI models and configurations

### Workflow State Management

The `SlideGenerationState` TypedDict manages:

- Input parameters (client_id, description, theme, etc.)
- File processing results and content summaries
- Research data and integration status
- Content planning and generation results
- Progress tracking and error handling
- Quality metrics and validation results

### Prompt Template Structure

Each YAML template includes:

- Metadata (name, description, version)
- Model configuration (temperature, max_tokens, model)
- System and user prompt templates with Jinja2 variables
- Variable definitions with validation rules
- Monitoring configuration

Example:

```yaml
name: "slide_html_generation"
description: "Main prompt template for generating HTML slides"
version: "1.0"
model_config:
  temperature: 0.7
  max_tokens: 4000
  model: "gpt-4"

system_prompt: |
  You are a senior frontend developer and UI/UX expert...

user_prompt_template: |
  Create a professional PowerPoint slide based on:
  DESCRIPTION: {description}
  THEME: {theme}
  {%- if color_palette %}
  COLOR PALETTE: {color_palette|join(', ')}
  {%- endif %}

variables:
  - name: "description"
    type: "string"
    required: true
  - name: "theme"
    type: "string"
    default: "Professional"

monitoring:
  track_tokens: true
  track_latency: true
  log_inputs: true
```

## Migration Guide

### For Developers

1. **Updating AI Service Calls:**

   ```python
   # Before
   html = await ai_service.generate_slide_html(description, theme)

   # After
   result = await ai_service.generate_slide_html(
       client_id=client_id,
       description=description,
       theme=theme,
       progress_callback=callback
   )
   html = result.get("html_content")
   ```

2. **Accessing Monitoring Data:**

   ```python
   from src.core.monitoring import get_monitoring_service
   monitoring = get_monitoring_service()
   metrics = monitoring.get_performance_summary()
   ```

3. **Modifying Prompts:**
   - Edit YAML files in `src/prompts/` directory
   - Use Jinja2 syntax for variables: `{variable_name}`
   - Reload templates via API: `POST /monitoring/templates/reload`

### For Operations

1. **Monitoring Endpoints:**

   - Access metrics at `http://localhost:8000/monitoring/metrics/summary`
   - Health check at `http://localhost:8000/monitoring/health`
   - Export metrics: `POST /monitoring/metrics/export`

2. **Configuration:**
   - Prompt templates in `backend/src/prompts/`
   - Monitoring logs in `logs/monitoring.log`
   - Configurable retention periods and cleanup

## Benefits Achieved

### 1. Maintainability

- ✅ Centralized prompt management
- ✅ Clear separation of concerns
- ✅ Version-controlled prompts
- ✅ Structured workflow orchestration

### 2. Scalability

- ✅ LangGraph-based workflow architecture
- ✅ Conditional routing and parallel processing
- ✅ Modular component design
- ✅ Easy integration of new AI agents

### 3. Monitoring & Observability

- ✅ Comprehensive metrics tracking
- ✅ Real-time performance monitoring
- ✅ Token usage and cost optimization
- ✅ Error tracking and alerting

### 4. Developer Experience

- ✅ Clear API interfaces
- ✅ Comprehensive error handling
- ✅ Progress tracking and callbacks
- ✅ Debugging and troubleshooting tools

## Future Enhancements

1. **Advanced Research Integration**

   - Integration with web research agents
   - Multi-source data aggregation
   - Quality scoring and source validation

2. **Model Optimization**

   - A/B testing for different prompts
   - Model performance comparison
   - Cost optimization strategies

3. **Advanced Monitoring**

   - Integration with Prometheus/Grafana
   - Real-time alerting and notifications
   - Performance anomaly detection

4. **Workflow Extensions**
   - Multi-slide presentation generation
   - Template-based slide creation
   - Advanced customization options

## Dependencies Added

```txt
# Template Engine for Prompts
Jinja2>=3.1.0
PyYAML>=6.0

# Already included:
langgraph>=0.2.0
langchain>=0.3.0
langchain-community>=0.3.0
langchain-openai>=0.2.0
```

## API Changes

### New Endpoints

- `GET /monitoring/*` - Monitoring and metrics endpoints
- `POST /monitoring/templates/reload` - Reload prompt templates
- `POST /monitoring/metrics/export` - Export metrics data

### Modified Methods

- `AIService.generate_slide_html()` - Now requires client_id and returns detailed results
- `AIService.generate_content_plan()` - Updated to use structured templates
- Added `AIService.generate_color_palette()` - New structured palette generation

This refactoring provides a solid foundation for scalable AI operations while maintaining backward compatibility and improving system reliability.
