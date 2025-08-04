#!/usr/bin/env python3
"""
Script to run LLM slide generation tests
"""

import asyncio
import sys
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_test(test_name: str, input_directory: str = "uploads/client_client_1754248313928/"):
    """Run a specific test"""
    try:
        if test_name == "comprehensive":
            logger.info(f"Running comprehensive LLM test with input directory: {input_directory}")
            from test_llm_slide_generation import LLMSlideGenerationTester
            tester = LLMSlideGenerationTester(input_directory)
            results, analysis = await tester.run_comprehensive_test()
            logger.info("✅ Comprehensive test completed")
            
        elif test_name == "html_files":
            logger.info(f"Running HTML files test with input directory: {input_directory}")
            from test_existing_html_files import test_llm_generation_with_html_files, compare_html_generation
            results = await test_llm_generation_with_html_files(input_directory)
            html_comparison = await compare_html_generation()
            logger.info("✅ HTML files test completed")
            
        elif test_name == "html_parsing":
            logger.info(f"Running HTML parsing and LLM test with input directory: {input_directory}")
            from test_html_parsing_and_llm import HTMLParsingAndLLMTester
            tester = HTMLParsingAndLLMTester(input_directory)
            results = await tester.run_comprehensive_test()
            logger.info("✅ HTML parsing and LLM test completed")
            
        elif test_name == "integration":
            logger.info("Running LLM integration test...")
            from test_llm_integration import test_llm_integration
            await test_llm_integration()
            logger.info("✅ Integration test completed")
            
        elif test_name == "new_generation":
            logger.info("Running new slide generation test...")
            from test_new_slide_generation import test_new_slide_generation
            await test_new_slide_generation()
            logger.info("✅ New generation test completed")
            
        else:
            logger.error(f"Unknown test: {test_name}")
            return False
            
        return True
        
    except Exception as e:
        logger.error(f"Test {test_name} failed: {e}")
        return False

async def run_all_tests(input_directory: str = "uploads/client_client_1754248313928"):
    """Run all tests"""
    tests = ["integration", "new_generation", "html_files", "html_parsing", "comprehensive"]
    
    logger.info(f"Running all LLM tests with input directory: {input_directory}")
    
    results = {}
    for test in tests:
        logger.info(f"\n{'='*50}")
        logger.info(f"Running test: {test}")
        logger.info(f"{'='*50}")
        
        success = await run_test(test, input_directory)
        results[test] = "PASS" if success else "FAIL"
    
    # Print summary
    logger.info(f"\n{'='*50}")
    logger.info("TEST SUMMARY")
    logger.info(f"{'='*50}")
    
    passed = sum(1 for result in results.values() if result == "PASS")
    total = len(results)
    
    for test, result in results.items():
        logger.info(f"{test}: {result}")
    
    logger.info(f"\nPassed: {passed}/{total}")
    logger.info(f"Success rate: {(passed/total)*100:.1f}%")
    
    return passed == total

def main():
    """Main function"""
    if len(sys.argv) > 1:
        test_name = sys.argv[1]
        
        # Check if input directory is specified
        input_directory = "uploads/client_client_1754248313928"  # default
        if len(sys.argv) > 2:
            input_directory = sys.argv[2]
        
        if test_name == "all":
            success = asyncio.run(run_all_tests(input_directory))
            sys.exit(0 if success else 1)
        else:
            success = asyncio.run(run_test(test_name, input_directory))
            sys.exit(0 if success else 1)
    else:
        print("Usage:")
        print("  python run_llm_tests.py <test_name> [input_directory]")
        print("  python run_llm_tests.py all [input_directory]")
        print("\nAvailable tests:")
        print("  integration     - Basic LLM integration test")
        print("  new_generation  - New slide generation flow test")
        print("  html_files      - Test with existing HTML files")
        print("  html_parsing    - Test HTML parsing and LLM generation")
        print("  comprehensive   - Comprehensive test with all client folders")
        print("  all            - Run all tests")
        print("\nExamples:")
        print("  python run_llm_tests.py comprehensive")
        print("  python run_llm_tests.py html_files")
        print("  python run_llm_tests.py html_parsing")
        print("  python run_llm_tests.py comprehensive /path/to/custom/uploads")
        print("  python run_llm_tests.py all /path/to/custom/uploads")

if __name__ == "__main__":
    main() 