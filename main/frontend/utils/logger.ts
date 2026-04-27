import { Platform } from 'react-native';

/**
 * GADO Blackbox Logger
 * Captures everything from network requests to global errors.
 */

const IS_DEBUG = __DEV__ || true; // Force true for now to capture production issues
const REMOTE_LOG_PATH = '/internal/client-log';
const MAX_REMOTE_LOGS = 200;
const remoteLogFingerprints = new Set<string>();
const globalScope = globalThis as typeof globalThis & {
  ErrorUtils?: {
    getGlobalHandler?: () => ((error: any, isFatal?: boolean) => void) | undefined;
    setGlobalHandler?: (handler: (error: any, isFatal?: boolean) => void) => void;
  };
};

function getBackendBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl) return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  return '';
}

function getLogEndpoint() {
  const baseUrl = getBackendBaseUrl();
  return baseUrl ? `${baseUrl}${REMOTE_LOG_PATH}` : '';
}

function safeSerialize(data: unknown) {
  if (data == null) return data;
  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return String(data);
  }
}

async function mirrorLogToBackend(level: string, message: string, data?: unknown) {
  const endpoint = getLogEndpoint();
  const fetchImpl = globalScope.fetch;

  if (!endpoint || !fetchImpl) return;

  const fingerprint = `${level}:${message}:${JSON.stringify(safeSerialize(data) ?? null)}`;
  if (remoteLogFingerprints.has(fingerprint)) return;

  remoteLogFingerprints.add(fingerprint);
  if (remoteLogFingerprints.size > MAX_REMOTE_LOGS) {
    const first = remoteLogFingerprints.values().next().value;
    if (first) remoteLogFingerprints.delete(first);
  }

  try {
    await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        data: safeSerialize(data),
        source: Platform.OS,
        href: typeof window !== 'undefined' ? window.location.href : undefined,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      }),
    });
  } catch {
    // Avoid recursive logging if the mirror endpoint itself is down.
  }
}

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

    if (level === 'WARN' || level === 'ERROR') {
      void mirrorLogToBackend(level, message, data);
    }

    if (level === 'NETWORK' && /<< .* ([45]\d\d) /.test(message)) {
      void mirrorLogToBackend('ERROR', `NETWORK_FAILURE ${message}`, data);
    }
  }

  info(msg: string, data?: any) { this.log('INFO', msg, data); }
  warn(msg: string, data?: any) { this.log('WARN', msg, data); }
  error(msg: string, data?: any) { this.log('ERROR', msg, data); }
  network(msg: string, data?: any) { this.log('NETWORK', msg, data); }

  getHistory() { return this.logs; }
}

export const GADOLogger = new Logger();

// --- GLOBAL INTERCEPTORS ---

const originalConsoleError = console.error.bind(console);
console.error = (...args: any[]) => {
  GADOLogger.error(
    args.map((arg) => (typeof arg === 'string' ? arg : String(arg))).join(' '),
    args.length > 1 ? args.slice(1) : undefined
  );
  originalConsoleError(...args);
};

const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args: any[]) => {
  GADOLogger.warn(
    args.map((arg) => (typeof arg === 'string' ? arg : String(arg))).join(' '),
    args.length > 1 ? args.slice(1) : undefined
  );
  originalConsoleWarn(...args);
};

// 1. Intercept Global Errors
if (globalScope.ErrorUtils?.getGlobalHandler && globalScope.ErrorUtils?.setGlobalHandler) {
  const originalHandler = globalScope.ErrorUtils.getGlobalHandler();
  globalScope.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    GADOLogger.error(`GLOBAL_ERROR: ${error.message}`, { error, isFatal });
    originalHandler?.(error, isFatal);
  });
}

// 2. Intercept Fetch API
const originalFetch = globalScope.fetch?.bind(globalScope);

if (originalFetch) {
  globalScope.fetch = async (...args) => {
    const [url, config] = args;
    const urlString = typeof url === 'string' ? url : String(url);
    if (urlString.includes(REMOTE_LOG_PATH)) {
      return originalFetch(...args);
    }
    const method = config?.method || 'GET';
    const requestId = Math.random().toString(36).substring(7);

    GADOLogger.network(`>> [${requestId}] ${method} ${urlString}`, {
      headers: config?.headers,
      body: (() => {
        if (!config?.body || typeof config.body !== 'string') return null;
        try {
          return JSON.parse(config.body);
        } catch {
          return config.body;
        }
      })(),
    });

    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      const response = await originalFetch(...args);
      const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const duration = (endTime - startTime).toFixed(2);

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
}
