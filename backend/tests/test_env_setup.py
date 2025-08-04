#!/usr/bin/env python3
"""
Test script to verify environment setup
"""

import os
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_env_setup():
    """Test environment setup"""
    print("Testing environment setup...")
    
    # Check if .env.local exists
    env_file = Path(".env.local")
    if env_file.exists():
        print(f"✅ .env.local file exists: {env_file.absolute()}")
        
        # Read and display content (without showing full API key)
        with open(env_file, 'r') as f:
            content = f.read()
            lines = content.split('\n')
            for line in lines:
                if line.startswith("OPENAI_API_KEY="):
                    key = line.split('=')[1]
                    if key:
                        print(f"✅ OPENAI_API_KEY is set: {key[:10]}...")
                    else:
                        print("❌ OPENAI_API_KEY is empty")
                elif line.strip() and not line.startswith('#'):
                    print(f"📝 Other env var: {line.split('=')[0] if '=' in line else line}")
    else:
        print("❌ .env.local file not found")
        return False
    
    # Test config loading
    try:
        from src.core.config import Settings
        settings = Settings()
        
        if settings.OPENAI_API_KEY:
            print("✅ Settings loaded successfully")
            print(f"   API Key: {settings.OPENAI_API_KEY[:10]}...")
            return True
        else:
            print("❌ OPENAI_API_KEY not loaded from settings")
            return False
            
    except Exception as e:
        print(f"❌ Error loading settings: {e}")
        return False

def test_llm_service():
    """Test LLM service initialization"""
    print("\nTesting LLM service...")
    
    try:
        from src.services.llm_service import LLMService
        
        llm_service = LLMService()
        
        if llm_service.is_available():
            print("✅ LLM service is available")
            return True
        else:
            print("❌ LLM service is not available")
            return False
            
    except Exception as e:
        print(f"❌ Error initializing LLM service: {e}")
        return False

def main():
    """Main test function"""
    print("Environment Setup Test")
    print("=" * 30)
    
    # Test environment setup
    env_ok = test_env_setup()
    
    # Test LLM service
    llm_ok = test_llm_service()
    
    # Summary
    print("\n" + "=" * 30)
    print("TEST SUMMARY")
    print("=" * 30)
    print(f"Environment setup: {'✅ PASS' if env_ok else '❌ FAIL'}")
    print(f"LLM service: {'✅ PASS' if llm_ok else '❌ FAIL'}")
    
    if env_ok and llm_ok:
        print("\n🎉 All tests passed! LLM features should work.")
    else:
        print("\n⚠️  Some tests failed. Please check the setup.")
        if not env_ok:
            print("   - Run: python setup_env.py")
        if not llm_ok:
            print("   - Check your OpenAI API key")

if __name__ == "__main__":
    main() 