import { Platform } from 'react-native';

/**
 * GADO Blackbox Logger
 * Captures everything from network requests to global errors.
 */

const IS_DEBUG = __DEV__ || true; // Force true for now to capture production issues

class Logger {
  private logs: any[] = [];

  private log(level: 'INFO' | 'WARN' | 'ERROR' | 'NETWORK', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, data };
    
    if (IS_DEBUG) {
      const color = level === 'ERROR' ? '\x1b[31m' : level === 'NETWORK' ? '\x1b[36m' : '\x1b[32m';
      console.log(`${color}[GADO:${level}] ${message}\x1b[0m`, data || '');
    }

    this.logs.push(logEntry);
    if (this.logs.length > 500) this.logs.shift(); // Keep last 500 logs
  }

  info(msg: string, data?: any) { this.log('INFO', msg, data); }
  warn(msg: string, data?: any) { this.log('WARN', msg, data); }
  error(msg: string, data?: any) { this.log('ERROR', msg, data); }
  network(msg: string, data?: any) { this.log('NETWORK', msg, data); }

  getHistory() { return this.logs; }
}

export const GADOLogger = new Logger();

// --- GLOBAL INTERCEPTORS ---

// 1. Intercept Global Errors
if (typeof ErrorUtils !== 'undefined') {
  const originalHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    GADOLogger.error(`GLOBAL_ERROR: ${error.message}`, { error, isFatal });
    originalHandler(error, isFatal);
  });
}

// 2. Intercept Fetch API
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const [url, config] = args;
  const method = config?.method || 'GET';
  const requestId = Math.random().toString(36).substring(7);

  GADOLogger.network(`>> [${requestId}] ${method} ${url}`, { 
    headers: config?.headers,
    body: config?.body ? JSON.parse(config.body as string) : null 
  });

  const startTime = performance.now();
  try {
    const response = await originalFetch(...args);
    const duration = (performance.now() - startTime).toFixed(2);
    
    // Clone to read body without consuming it
    const clone = response.clone();
    let body;
    try {
      body = await clone.json();
    } catch {
      body = 'non-json-response';
    }

    GADOLogger.network(`<< [${requestId}] ${response.status} (${duration}ms)`, { body });
    return response;
  } catch (err: any) {
    GADOLogger.error(`!! [${requestId}] FETCH_FAILED: ${err.message}`, { error: err });
    throw err;
  }
};
