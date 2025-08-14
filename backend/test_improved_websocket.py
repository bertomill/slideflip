"""
Test script for the improved WebSocket implementation
"""

import asyncio
import json
import websockets
from src.models.websocket_messages import (
    MessageType, FileUploadMessage, StatusRequestMessage,
    ThemeSelectionMessage, ContentPlanningMessage
)

async def test_websocket_connection():
    """Test basic WebSocket connection and message handling"""
    
    client_id = "test_client_123"
    uri = f"ws://localhost:8000/ws/{client_id}"
    
    try:
        print(f"Connecting to {uri}...")
        
        async with websockets.connect(uri) as websocket:
            print("✅ Connected successfully!")
            
            # Test 1: Receive session initialized message
            print("\n🧪 Test 1: Session Initialization")
            session_msg = await websocket.recv()
            session_data = json.loads(session_msg)
            print(f"Received: {session_data['type']}")
            assert session_data['type'] == 'session_initialized'
            print("✅ Session initialized correctly")
            
            # Test 2: Send status request
            print("\n🧪 Test 2: Status Request")
            status_request = {
                "id": "test_status_001",
                "type": MessageType.STATUS_REQUEST,
                "timestamp": "2024-01-01T00:00:00Z",
                "client_id": client_id,
                "data": {}
            }
            
            await websocket.send(json.dumps(status_request))
            print("Status request sent")
            
            # Receive acknowledgment
            ack_msg = await websocket.recv()
            ack_data = json.loads(ack_msg)
            print(f"Received acknowledgment: {ack_data['type']}")
            assert ack_data['type'] == 'acknowledge'
            
            # Receive status response
            status_msg = await websocket.recv()
            status_data = json.loads(status_msg)
            print(f"Received status: {status_data['type']}")
            assert status_data['type'] == 'status_response'
            print("✅ Status request/response working")
            
            # Test 3: Send ping
            print("\n🧪 Test 3: Ping/Pong")
            ping_request = {
                "id": "test_ping_001",
                "type": MessageType.PING,
                "timestamp": "2024-01-01T00:00:00Z",
                "client_id": client_id,
                "data": {}
            }
            
            await websocket.send(json.dumps(ping_request))
            print("Ping sent")
            
            # Receive pong
            pong_msg = await websocket.recv()
            pong_data = json.loads(pong_msg)
            print(f"Received: {pong_data['type']}")
            assert pong_data['type'] == 'pong'
            print("✅ Ping/Pong working")
            
            # Test 4: Send theme selection
            print("\n🧪 Test 4: Theme Selection")
            theme_request = {
                "id": "test_theme_001",
                "type": MessageType.THEME_SELECTION,
                "timestamp": "2024-01-01T00:00:00Z",
                "client_id": client_id,
                "data": {
                    "theme_id": "professional-blue",
                    "theme_name": "Professional Blue",
                    "color_palette": ["#1e40af", "#3b82f6", "#60a5fa"],
                    "slide_count": 1
                }
            }
            
            await websocket.send(json.dumps(theme_request))
            print("Theme selection sent")
            
            # Receive acknowledgment
            ack_msg = await websocket.recv()
            ack_data = json.loads(ack_msg)
            print(f"Received acknowledgment: {ack_data['type']}")
            assert ack_data['type'] == 'acknowledge'
            
            # Receive progress update
            progress_msg = await websocket.recv()
            progress_data = json.loads(progress_msg)
            print(f"Received: {progress_data['type']} - {progress_data['data']['message']}")
            assert progress_data['type'] == 'progress_update'
            print("✅ Theme selection working")
            
            print("\n🎉 All WebSocket tests passed!")
            
    except websockets.exceptions.ConnectionClosed as e:
        print(f"❌ Connection closed: {e}")
        return False
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False
    
    return True

async def test_file_upload():
    """Test file upload with validation"""
    
    client_id = "test_client_upload"
    uri = f"ws://localhost:8000/ws/{client_id}"
    
    try:
        print(f"\n📁 Testing File Upload...")
        
        async with websockets.connect(uri) as websocket:
            # Wait for session initialization
            await websocket.recv()
            
            # Test valid file upload
            file_request = {
                "id": "test_file_001",
                "type": MessageType.FILE_UPLOAD,
                "timestamp": "2024-01-01T00:00:00Z",
                "client_id": client_id,
                "data": {
                    "filename": "test.txt",
                    "content": "VGVzdCBmaWxlIGNvbnRlbnQ=",  # "Test file content" in base64
                    "file_type": "text/plain",
                    "file_size": 17
                }
            }
            
            await websocket.send(json.dumps(file_request))
            print("File upload sent")
            
            # Receive messages until upload complete
            messages_received = 0
            while messages_received < 5:  # Expect ack + multiple progress updates
                msg = await websocket.recv()
                data = json.loads(msg)
                print(f"Received: {data['type']} - {data.get('data', {}).get('message', '')}")
                messages_received += 1
                
                if data['type'] == 'progress_update' and data['data']['progress'] == 100:
                    print("✅ File upload completed")
                    break
            
            # Test invalid file upload (too large)
            invalid_file_request = {
                "id": "test_file_002",
                "type": MessageType.FILE_UPLOAD,
                "timestamp": "2024-01-01T00:00:00Z",
                "client_id": client_id,
                "data": {
                    "filename": "large.txt",
                    "content": "VGVzdA==",
                    "file_type": "text/plain",
                    "file_size": 99999999  # Too large
                }
            }
            
            await websocket.send(json.dumps(invalid_file_request))
            print("Invalid file upload sent")
            
            # Should receive error
            error_msg = await websocket.recv()
            error_data = json.loads(error_msg)
            print(f"Received error: {error_data['type']}")
            assert error_data['type'] == 'error_response'
            print("✅ File validation working")
            
    except Exception as e:
        print(f"❌ File upload test failed: {e}")
        return False
    
    return True

async def test_concurrent_connections():
    """Test multiple concurrent connections"""
    
    print(f"\n👥 Testing Concurrent Connections...")
    
    async def connect_client(client_id):
        uri = f"ws://localhost:8000/ws/{client_id}"
        try:
            async with websockets.connect(uri) as websocket:
                # Wait for session initialization
                await websocket.recv()
                
                # Send a status request
                status_request = {
                    "id": f"status_{client_id}",
                    "type": MessageType.STATUS_REQUEST,
                    "timestamp": "2024-01-01T00:00:00Z",
                    "client_id": client_id,
                    "data": {}
                }
                
                await websocket.send(json.dumps(status_request))
                
                # Receive acknowledgment and response
                await websocket.recv()  # ack
                await websocket.recv()  # status response
                
                return True
        except Exception as e:
            print(f"❌ Client {client_id} failed: {e}")
            return False
    
    # Test 5 concurrent connections
    tasks = []
    for i in range(5):
        tasks.append(connect_client(f"concurrent_client_{i}"))
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    successful_connections = sum(1 for r in results if r is True)
    print(f"✅ {successful_connections}/5 concurrent connections successful")
    
    return successful_connections >= 4  # Allow 1 failure

async def main():
    """Run all WebSocket tests"""
    
    print("🚀 Starting WebSocket Implementation Tests")
    print("=" * 50)
    
    # Check if backend is running
    try:
        import requests
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code != 200:
            print("❌ Backend health check failed")
            return
    except:
        print("❌ Backend is not running. Start with: uv run python main.py")
        return
    
    print("✅ Backend is running")
    
    tests = [
        ("Basic WebSocket Connection", test_websocket_connection),
        ("File Upload", test_file_upload),
        ("Concurrent Connections", test_concurrent_connections)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'=' * 20} {test_name} {'=' * 20}")
        
        try:
            result = await test_func()
            results.append((test_name, result))
            
            if result:
                print(f"✅ {test_name} PASSED")
            else:
                print(f"❌ {test_name} FAILED")
                
        except Exception as e:
            print(f"❌ {test_name} ERROR: {e}")
            results.append((test_name, False))
    
    # Summary
    print(f"\n{'=' * 50}")
    print("🧪 TEST RESULTS SUMMARY")
    print(f"{'=' * 50}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:.<40} {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! WebSocket implementation is working correctly.")
    else:
        print(f"⚠️  {total - passed} tests failed. Please review the implementation.")

if __name__ == "__main__":
    asyncio.run(main())