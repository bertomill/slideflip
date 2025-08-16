/**
 * Frontend logging utility for Slideo
 * Provides structured logging with different levels and contexts
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogContext {
  component?: string;
  userId?: string;
  sessionId?: string;
  clientId?: string;
  step?: string;
  messageId?: string;
  duration?: number;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: Error;
}

class SlideoLogger {
  private minLevel: LogLevel = LogLevel.INFO;
  private context: LogContext = {};
  private listeners: ((entry: LogEntry) => void)[] = [];

  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.minLevel = minLevel;
    
    // Set level from environment in development
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      const envLevel = localStorage.getItem('slideo-log-level');
      if (envLevel) {
        this.minLevel = parseInt(envLevel) || LogLevel.INFO;
      }
    }
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
    if (typeof window !== 'undefined') {
      localStorage.setItem('slideo-log-level', level.toString());
    }
  }

  withContext(context: LogContext): SlideoLogger {
    const newLogger = new SlideoLogger(this.minLevel);
    newLogger.context = { ...this.context, ...context };
    newLogger.listeners = [...this.listeners];
    return newLogger;
  }

  addListener(listener: (entry: LogEntry) => void): void {
    this.listeners.push(listener);
  }

  removeListener(listener: (entry: LogEntry) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private log(level: LogLevel, message: string, context: LogContext = {}, error?: Error): void {
    if (level < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
      error
    };

    // Console output
    this.logToConsole(entry);

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(entry);
      } catch (e) {
        console.error('Logger listener error:', e);
      }
    });

    // Store in session storage for debugging (development only)
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      this.storeLogEntry(entry);
    }
  }

  private logToConsole(entry: LogEntry): void {
    const { timestamp, level, message, context, error } = entry;
    const prefix = `[${timestamp}] [${LogLevel[level]}]`;
    
    // Format context for display
    const contextStr = Object.keys(context).length > 0 
      ? ` (${Object.entries(context).map(([k, v]) => `${k}=${v}`).join(', ')})`
      : '';

    const fullMessage = `${prefix} ${message}${contextStr}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(fullMessage, error);
        break;
      case LogLevel.INFO:
        console.info(fullMessage, error);
        break;
      case LogLevel.WARN:
        console.warn(fullMessage, error);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(fullMessage, error);
        break;
    }
  }

  private storeLogEntry(entry: LogEntry): void {
    try {
      const stored = sessionStorage.getItem('slideo-logs');
      const logs: LogEntry[] = stored ? JSON.parse(stored) : [];
      
      // Keep only last 100 entries
      if (logs.length >= 100) {
        logs.shift();
      }
      
      logs.push(entry);
      sessionStorage.setItem('slideo-logs', JSON.stringify(logs));
    } catch (e) {
      // Ignore storage errors
    }
  }

  debug(message: string, context: LogContext = {}): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context: LogContext = {}): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context: LogContext = {}, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  error(message: string, context: LogContext = {}, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  critical(message: string, context: LogContext = {}, error?: Error): void {
    this.log(LogLevel.CRITICAL, message, context, error);
  }

  // Utility methods for common logging patterns
  timer<T>(operation: string, context: LogContext = {}): {
    end: (additionalContext?: LogContext) => void;
    logger: SlideoLogger;
  } {
    const startTime = Date.now();
    const timerContext = { ...context, operation };
    const timerLogger = this.withContext(timerContext);
    
    timerLogger.debug(`Starting ${operation}`);
    
    return {
      end: (additionalContext: LogContext = {}) => {
        const duration = Date.now() - startTime;
        timerLogger.debug(`Completed ${operation}`, { 
          ...additionalContext, 
          duration 
        });
      },
      logger: timerLogger
    };
  }
}

// WebSocket specific logging utilities
export class WebSocketLogger {
  private logger: SlideoLogger;

  constructor(baseLogger: SlideoLogger) {
    this.logger = baseLogger.withContext({ subsystem: 'websocket' });
  }

  logConnection(clientId: string, event: 'connecting' | 'connected' | 'disconnected' | 'error', details: LogContext = {}): void {
    this.logger.info(`WebSocket ${event}`, { clientId, event, ...details });
  }

  logMessage(
    clientId: string, 
    messageType: string, 
    messageId: string, 
    direction: 'sent' | 'received',
    details: LogContext = {}
  ): void {
    this.logger.debug(`WebSocket message ${direction}: ${messageType}`, {
      clientId,
      messageType,
      messageId,
      direction,
      ...details
    });
  }

  logProgress(
    clientId: string,
    step: string,
    progress: number,
    message: string,
    details: LogContext = {}
  ): void {
    this.logger.info(`Progress update: ${step} - ${progress}%`, {
      clientId,
      step,
      progress,
      message,
      ...details
    });
  }

  logError(clientId: string, error: string, details: LogContext = {}): void {
    this.logger.error(`WebSocket error: ${error}`, { clientId, ...details });
  }
}

// Service-specific loggers
export function createServiceLogger(serviceName: string, baseLogger?: SlideoLogger): SlideoLogger {
  const logger = baseLogger || getLogger();
  return logger.withContext({ service: serviceName });
}

export function createComponentLogger(componentName: string, baseLogger?: SlideoLogger): SlideoLogger {
  const logger = baseLogger || getLogger();
  return logger.withContext({ component: componentName });
}

export function createWebSocketLogger(baseLogger?: SlideoLogger): WebSocketLogger {
  const logger = baseLogger || getLogger();
  return new WebSocketLogger(logger);
}

// Default logger instance
let defaultLogger: SlideoLogger | null = null;

export function getLogger(minLevel: LogLevel = LogLevel.INFO): SlideoLogger {
  if (!defaultLogger) {
    defaultLogger = new SlideoLogger(minLevel);
  }
  return defaultLogger;
}

// Debugging utilities
export function getLogs(): LogEntry[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = sessionStorage.getItem('slideo-logs');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function clearLogs(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('slideo-logs');
  }
}

export function downloadLogs(): void {
  if (typeof window === 'undefined') return;
  
  const logs = getLogs();
  const logsText = logs.map(entry => {
    const contextStr = Object.keys(entry.context).length > 0 
      ? ` ${JSON.stringify(entry.context)}`
      : '';
    
    return `[${entry.timestamp}] [${LogLevel[entry.level]}] ${entry.message}${contextStr}`;
  }).join('\n');
  
  const blob = new Blob([logsText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `slideo-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}