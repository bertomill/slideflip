#!/usr/bin/env python3
"""
Test script for the Content Creator Agent

This script tests the basic functionality of the content creator agent
to ensure it can generate content in different modes.
"""

from src.agents.content_creator_agent import ContentCreatorAgent
import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))


async def test_content_creator_agent():
    """Test the content creator agent with different scenarios"""

    print("🧪 Testing Content Creator Agent...")

    # Initialize the agent
    agent = ContentCreatorAgent()

    # Test data
    test_content = """
    This is a test document about artificial intelligence in business.
    AI can help companies automate processes, analyze data, and make better decisions.
    Key benefits include increased efficiency, cost savings, and improved customer experience.
    """

    test_description = "Create a presentation about AI benefits in business"

    print("\n1️⃣ Testing Basic Mode (uploaded content only)...")
    try:
        basic_content = await agent.create_content(
            uploaded_content=test_content,
            user_description=test_description,
            use_ai_agent=False
        )
        print(f"✅ Basic mode successful")
        print(f"   Title: {basic_content.get('title', 'N/A')}")
        print(
            f"   Sections: {len([k for k in basic_content.keys() if k.startswith('section_')])}")
        print(
            f"   Generation mode: {basic_content.get('metadata', {}).get('generation_mode', 'N/A')}")
    except Exception as e:
        print(f"❌ Basic mode failed: {e}")

    print("\n2️⃣ Testing AI Agent Mode (enhanced content generation)...")
    try:
        enhanced_content = await agent.create_content(
            uploaded_content=test_content,
            user_description=test_description,
            use_ai_agent=True,
            content_style="professional"
        )
        print(f"✅ AI agent mode successful")
        print(f"   Title: {enhanced_content.get('title', 'N/A')}")
        print(
            f"   Sections: {len([k for k in enhanced_content.keys() if k.startswith('section_')])}")
        print(
            f"   Generation mode: {enhanced_content.get('metadata', {}).get('generation_mode', 'N/A')}")
        print(
            f"   Content style: {enhanced_content.get('metadata', {}).get('content_style', 'N/A')}")
    except Exception as e:
        print(f"❌ AI agent mode failed: {e}")

    print("\n3️⃣ Testing AI Agent Mode with Research Data...")
    try:
        research_data = """
        Recent studies show that 85% of businesses report increased efficiency after implementing AI.
        The global AI market is expected to reach $190 billion by 2025.
        Companies using AI see an average 20% reduction in operational costs.
        """

        research_enhanced_content = await agent.create_content(
            uploaded_content=test_content,
            user_description=test_description,
            research_data=research_data,
            use_ai_agent=True,
            content_style="professional"
        )
        print(f"✅ AI agent mode with research successful")
        print(f"   Title: {research_enhanced_content.get('title', 'N/A')}")
        print(
            f"   Sections: {len([k for k in research_enhanced_content.keys() if k.startswith('section_')])}")
        print(
            f"   Generation mode: {research_enhanced_content.get('metadata', {}).get('generation_mode', 'N/A')}")
        print(
            f"   Has research: {research_enhanced_content.get('metadata', {}).get('has_research', 'N/A')}")
    except Exception as e:
        print(f"❌ AI agent mode with research failed: {e}")

    print("\n4️⃣ Testing Content Quality Validation...")
    try:
        # Test with the enhanced content from step 2
        if 'enhanced_content' in locals():
            quality_result = await agent.validate_content_quality(
                enhanced_content, test_description
            )
            print(f"✅ Quality validation successful")
            print(
                f"   Quality score: {quality_result.get('quality_score', 'N/A')}")
            print(
                f"   Is acceptable: {quality_result.get('is_acceptable', 'N/A')}")
            print(f"   Feedback: {quality_result.get('feedback', [])}")
        else:
            print("⚠️ Skipping quality validation (enhanced content not available)")
    except Exception as e:
        print(f"❌ Quality validation failed: {e}")

    print("\n🎉 Content Creator Agent testing completed!")


if __name__ == "__main__":
    # Run the async test
    asyncio.run(test_content_creator_agent())
