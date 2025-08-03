#!/usr/bin/env python3
"""
Simple test script for the SlideFlip Backend
"""

import asyncio
import websockets
import json
import base64
import time
from typing import Dict, Any

class BackendTester:
    """Simple test client for the SlideFlip Backend"""
    
    def __init__(self, uri: str = "ws://localhost:8000/ws/test_client"):
        self.uri = uri
        self.websocket = None
        self.test_results = []
    
    async def connect(self):
        """Connect to the backend"""
        try:
            self.websocket = await websockets.connect(self.uri)
            print(f"✅ Connected to {self.uri}")
            return True
        except Exception as e:
            print(f"❌ Failed to connect: {e}")
            return False
    
    async def disconnect(self):
        """Disconnect from the backend"""
        if self.websocket:
            await self.websocket.close()
            print("🔌 Disconnected from backend")
    
    async def send_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Send a message and wait for response"""
        try:
            await self.websocket.send(json.dumps(message))
            print(f"📤 Sent: {message['type']}")
            
            # Wait for response
            response = await asyncio.wait_for(self.websocket.recv(), timeout=10.0)
            response_data = json.loads(response)
            print(f"📥 Received: {response_data['type']}")
            
            return response_data
        except Exception as e:
            print(f"❌ Error sending/receiving message: {e}")
            return {"error": str(e)}
    
    async def test_connection(self):
        """Test basic connection"""
        print("\n🔗 Testing connection...")
        
        if not await self.connect():
            return False
        
        # Wait for connection established message
        try:
            response = await asyncio.wait_for(self.websocket.recv(), timeout=5.0)
            response_data = json.loads(response)
            
            if response_data['type'] == 'connection_established':
                print("✅ Connection established successfully")
                return True
            else:
                print(f"❌ Unexpected response: {response_data}")
                return False
        except Exception as e:
            print(f"❌ Connection test failed: {e}")
            return False
    
    async def test_file_upload(self):
        """Test file upload functionality"""
        print("\n📁 Testing file upload...")
        
        # Create a simple test file content
        test_content = "This is a test file content for SlideFlip backend testing."
        encoded_content = base64.b64encode(test_content.encode()).decode()
        
        message = {
            "type": "file_upload",
            "data": {
                "filename": "test_file.txt",
                "content": encoded_content,
                "file_type": "text/plain",
                "file_size": len(test_content)
            }
        }
        
        response = await self.send_message(message)
        
        if response.get('type') == 'file_upload_success':
            print("✅ File upload test passed")
            return True
        else:
            print(f"❌ File upload test failed: {response}")
            return False
    
    async def test_slide_description(self):
        """Test slide description functionality"""
        print("\n📝 Testing slide description...")
        
        message = {
            "type": "slide_description",
            "data": {
                "description": "Create a professional slide about quarterly sales results with charts and key insights."
            }
        }
        
        response = await self.send_message(message)
        
        if response.get('type') == 'slide_description_success':
            print("✅ Slide description test passed")
            return True
        else:
            print(f"❌ Slide description test failed: {response}")
            return False
    
    async def test_slide_processing(self):
        """Test slide processing functionality"""
        print("\n⚙️ Testing slide processing...")
        
        message = {
            "type": "process_slide",
            "data": {
                "options": {
                    "theme": "professional",
                    "layout": "standard"
                }
            }
        }
        
        response = await self.send_message(message)
        
        if response.get('type') == 'processing_status':
            print("✅ Slide processing test passed")
            return True
        else:
            print(f"❌ Slide processing test failed: {response}")
            return False
    
    async def test_ping(self):
        """Test ping functionality"""
        print("\n🏓 Testing ping...")
        
        message = {
            "type": "ping",
            "data": {}
        }
        
        response = await self.send_message(message)
        
        if response.get('type') == 'pong':
            print("✅ Ping test passed")
            return True
        else:
            print(f"❌ Ping test failed: {response}")
            return False
    
    async def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting SlideFlip Backend Tests")
        print("=" * 50)
        
        tests = [
            ("Connection", self.test_connection),
            ("File Upload", self.test_file_upload),
            ("Slide Description", self.test_slide_description),
            ("Slide Processing", self.test_slide_processing),
            ("Ping", self.test_ping)
        ]
        
        results = []
        
        for test_name, test_func in tests:
            try:
                result = await test_func()
                results.append((test_name, result))
            except Exception as e:
                print(f"❌ {test_name} test crashed: {e}")
                results.append((test_name, False))
        
        # Print summary
        print("\n" + "=" * 50)
        print("📊 Test Results Summary")
        print("=" * 50)
        
        passed = 0
        total = len(results)
        
        for test_name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name:20} {status}")
            if result:
                passed += 1
        
        print("=" * 50)
        print(f"Total: {total}, Passed: {passed}, Failed: {total - passed}")
        
        if passed == total:
            print("🎉 All tests passed!")
        else:
            print("⚠️ Some tests failed!")
        
        await self.disconnect()
        return passed == total

async def main():
    """Main test function"""
    tester = BackendTester()
    success = await tester.run_all_tests()
    
    if success:
        print("\n✅ Backend is working correctly!")
        exit(0)
    else:
        print("\n❌ Backend has issues!")
        exit(1)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Tests interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\n💥 Test runner crashed: {e}")
        exit(1) 