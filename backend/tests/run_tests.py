#!/usr/bin/env python3
"""
Test runner for SlideFlip Backend

This script provides an easy way to run all tests or specific test categories.
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path

def run_command(command, description):
    """Run a command and handle errors."""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {' '.join(command)}")
    print('='*60)
    
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True)
        print("✅ SUCCESS")
        if result.stdout:
            print("Output:")
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print("❌ FAILED")
        print(f"Error: {e}")
        if e.stdout:
            print("Stdout:")
            print(e.stdout)
        if e.stderr:
            print("Stderr:")
            print(e.stderr)
        return False

def run_all_tests():
    """Run all tests in the tests directory."""
    test_files = [
        "test_backend.py",
        "test_content_storage.py", 
        "test_html_parsing.py",
        "test_llm_integration.py",
        "test_slide_generation.py",
        "test_comprehensive_html.py",
        "test_consolidated_slide_generation.py",
        "test_env_setup.py",
        "test_existing_html_files.py",
        "test_html_parsing_and_llm.py",
        "test_image_extraction.py",
        "test_llm_slide_generation.py",
        "test_new_slide_generation.py"
    ]
    
    success_count = 0
    total_count = len(test_files)
    
    for test_file in test_files:
        test_path = Path(__file__).parent / test_file
        if test_path.exists():
            success = run_command(
                [sys.executable, "-m", "pytest", str(test_path), "-v"],
                f"Test file: {test_file}"
            )
            if success:
                success_count += 1
        else:
            print(f"⚠️  Test file not found: {test_file}")
    
    print(f"\n{'='*60}")
    print(f"Test Summary: {success_count}/{total_count} test files passed")
    print('='*60)
    
    return success_count == total_count

def run_specific_test(test_name):
    """Run a specific test file."""
    test_path = Path(__file__).parent / f"{test_name}.py"
    if not test_path.exists():
        print(f"❌ Test file not found: {test_path}")
        return False
    
    return run_command(
        [sys.executable, "-m", "pytest", str(test_path), "-v"],
        f"Specific test: {test_name}"
    )

def run_with_coverage():
    """Run tests with coverage report."""
    return run_command(
        [sys.executable, "-m", "pytest", "--cov=src", "--cov-report=html", "--cov-report=term"],
        "Tests with coverage report"
    )

def main():
    parser = argparse.ArgumentParser(description="Run SlideFlip Backend tests")
    parser.add_argument(
        "--all", 
        action="store_true", 
        help="Run all tests"
    )
    parser.add_argument(
        "--test", 
        type=str, 
        help="Run a specific test file (without .py extension)"
    )
    parser.add_argument(
        "--coverage", 
        action="store_true", 
        help="Run tests with coverage report"
    )
    
    args = parser.parse_args()
    
    # Change to backend directory
    backend_dir = Path(__file__).parent.parent
    os.chdir(backend_dir)
    
    print("🚀 SlideFlip Backend Test Runner")
    print(f"Working directory: {os.getcwd()}")
    
    if args.test:
        success = run_specific_test(args.test)
    elif args.coverage:
        success = run_with_coverage()
    else:
        # Default: run all tests
        success = run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main() 