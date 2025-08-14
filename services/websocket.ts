/**
 * Primary WebSocket Service
 * This is the main export that components should use
 */

// Export everything from the improved WebSocket service
export * from './improved-websocket-service';
export { default } from './improved-websocket-service';

// Also provide a named export for backwards compatibility
export { default as webSocketService } from './improved-websocket-service';