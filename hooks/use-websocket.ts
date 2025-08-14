/**
 * Primary WebSocket Hook
 * This is the main export that components should use
 */

// Export everything from the improved WebSocket hook
export * from './use-improved-websocket';
export { default } from './use-improved-websocket';

// Also provide named exports for backwards compatibility
export { useImprovedWebSocket as useWebSocket } from './use-improved-websocket';