#!/usr/bin/env python3
"""
Script to help set up environment variables for the backend
"""

import os
from pathlib import Path


def setup_env_file():
    """Set up the .env.local file for the backend"""
    env_file = Path(".env.local")

    print("Setting up environment file for SlideFlip Backend...")

    # Check if .env.local already exists
    if env_file.exists():
        print(f"✅ .env.local file already exists")

        # Read existing content
        with open(env_file, 'r') as f:
            content = f.read()

        # Check if OPENAI_API_KEY is already set
        if "OPENAI_API_KEY" in content:
            print("✅ OPENAI_API_KEY is already configured")
            return True
        else:
            print("⚠️  OPENAI_API_KEY is not configured")
    else:
        print("📝 Creating new .env.local file")
        content = ""

    # Get OpenAI API key from user
    print("\nPlease enter your OpenAI API key:")
    print("(You can get one from https://platform.openai.com/api-keys)")
    api_key = input("OpenAI API Key: ").strip()

    if not api_key:
        print("❌ No API key provided. Please set OPENAI_API_KEY manually in .env.local")
        return False

    # Add the API key to the content
    if "OPENAI_API_KEY" not in content:
        content += f"\n# OpenAI Configuration\nOPENAI_API_KEY={api_key}\n"
    else:
        # Replace existing OPENAI_API_KEY
        lines = content.split('\n')
        new_lines = []
        for line in lines:
            if line.startswith("OPENAI_API_KEY="):
                new_lines.append(f"OPENAI_API_KEY={api_key}")
            else:
                new_lines.append(line)
        content = '\n'.join(new_lines)

    # Write the file
    with open(env_file, 'w') as f:
        f.write(content)

    print(f"✅ .env.local file created/updated successfully")
    print(f"📁 File location: {env_file.absolute()}")

    return True


def check_env_setup():
    """Check if environment is properly set up"""
    print("Checking environment setup...")

    # Check if .env.local exists
    env_file = Path(".env.local")
    if not env_file.exists():
        print("❌ .env.local file not found")
        return False

    # Check if OPENAI_API_KEY is set
    try:
        from src.core.config import Settings
        settings = Settings()

        if settings.OPENAI_API_KEY:
            print("✅ OPENAI_API_KEY is configured")
            print(f"   Key: {settings.OPENAI_API_KEY[:10]}...")
            return True
        else:
            print("❌ OPENAI_API_KEY is not set")
            return False

    except Exception as e:
        print(f"❌ Error checking environment: {e}")
        return False


def main():
    """Main function"""
    print("SlideFlip Backend Environment Setup")
    print("=" * 40)

    # Check current setup
    if check_env_setup():
        print("\n✅ Environment is properly configured!")
        return

    # Set up environment
    print("\nSetting up environment...")
    if setup_env_file():
        print("\nVerifying setup...")
        if check_env_setup():
            print("\n✅ Environment setup completed successfully!")
        else:
            print("\n❌ Environment setup failed. Please check manually.")
    else:
        print("\n❌ Environment setup failed.")


if __name__ == "__main__":
    main()
