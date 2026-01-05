/**
 * DebugLoggerContext - DEVELOPMENT DEBUG LOGGING TO ONELAKE
 *
 * ============================================================================
 * TEMPORARY SOLUTION: Writes debug logs to OneLake instead of console.log
 * Remove this when development is complete.
 * ============================================================================
 *
 * WHY:
 * - Console messages in browser are time-consuming to copy/paste
 * - OneLake logs persist and can be reviewed later
 * - Multiple sessions can be compared easily
 * - Logs can be downloaded and searched
 *
 * HOW IT WORKS:
 * 1. Logs are buffered in memory (to avoid excessive API calls)
 * 2. Buffer is flushed to OneLake every 5 seconds or when buffer is full
 * 3. Logs are stored in: Files/debug_logs/YYYY-MM-DD/session_<ID>.jsonl
 * 4. Each line is a JSON object with timestamp, level, component, message, data
 *
 * USAGE:
 * ------
 * import { useDebugLog } from '../../context';
 *
 * const MyComponent = () => {
 *   const log = useDebugLog('MyComponent');
 *
 *   log.debug('Loading data...');
 *   log.info('Data loaded', { count: items.length });
 *   log.warn('Missing field', { field: 'name' });
 *   log.error('Failed to save', { error: err.message });
 *
 *   // Force flush (e.g., before navigation)
 *   await log.flush();
 * };
 *
 * TO DISABLE:
 * Set DEBUG_LOGGING_ENABLED = false below to disable OneLake writes.
 * Logs will still go to console.
 */

import React, { createContext, useContext, useCallback, useRef, useEffect, useMemo, ReactNode } from 'react';
import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { OneLakeStorageClient } from '../clients/OneLakeStorageClient';

// ============================================================================
// CONFIGURATION - Set to false to disable OneLake logging
// ============================================================================
const DEBUG_LOGGING_ENABLED = true;
const BUFFER_FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds
const BUFFER_MAX_SIZE = 50; // Flush when buffer reaches this size
const LOG_FOLDER = 'debug_logs';

// ============================================================================
// Types
// ============================================================================
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
  sessionId: string;
}

interface DebugLogger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
  flush: () => Promise<void>;
}

interface DebugLoggerContextType {
  getLogger: (component: string) => DebugLogger;
  flush: () => Promise<void>;
  isEnabled: boolean;
  sessionId: string;
  logPath: string | null;
}

// ============================================================================
// Context
// ============================================================================
const DebugLoggerContext = createContext<DebugLoggerContextType | undefined>(undefined);

// ============================================================================
// Provider Props
// ============================================================================
interface DebugLoggerProviderProps {
  workloadClient: WorkloadClientAPI;
  workspaceId: string;
  itemId: string;
  children: ReactNode;
}

// ============================================================================
// Helper Functions
// ============================================================================
function generateSessionId(): string {
  const now = new Date();
  const time = now.toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
  const random = Math.random().toString(36).substring(2, 8);
  return `${time}_${random}`;
}

function getDateFolder(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatLogForConsole(entry: LogEntry): string {
  const prefix = `[${entry.level.toUpperCase()}][${entry.component}]`;
  if (entry.data) {
    return `${prefix} ${entry.message} ${JSON.stringify(entry.data)}`;
  }
  return `${prefix} ${entry.message}`;
}

// ============================================================================
// Provider Component
// ============================================================================
export const DebugLoggerProvider: React.FC<DebugLoggerProviderProps> = ({
  workloadClient,
  workspaceId,
  itemId,
  children,
}) => {
  // Refs for mutable state (to avoid stale closures in interval)
  const bufferRef = useRef<LogEntry[]>([]);
  const isFlushingRef = useRef(false);
  const sessionIdRef = useRef(generateSessionId());
  const storageClientRef = useRef<OneLakeStorageClient | null>(null);
  const fileCreatedRef = useRef(false);
  const flushIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Compute log file path
  const logFilePath = useMemo(() => {
    if (!workspaceId || !itemId) return null;
    const dateFolder = getDateFolder();
    return OneLakeStorageClient.getFilePath(
      workspaceId,
      itemId,
      `${LOG_FOLDER}/${dateFolder}/session_${sessionIdRef.current}.jsonl`
    );
  }, [workspaceId, itemId]);

  // Initialize storage client
  useEffect(() => {
    if (DEBUG_LOGGING_ENABLED && workloadClient) {
      storageClientRef.current = new OneLakeStorageClient(workloadClient);
    }
    return () => {
      storageClientRef.current = null;
    };
  }, [workloadClient]);

  // Flush buffer to OneLake
  const flushBuffer = useCallback(async () => {
    if (!DEBUG_LOGGING_ENABLED) return;
    if (isFlushingRef.current) return;
    if (bufferRef.current.length === 0) return;
    if (!storageClientRef.current || !logFilePath) return;

    isFlushingRef.current = true;

    // Take snapshot of buffer and clear it
    const entries = [...bufferRef.current];
    bufferRef.current = [];

    try {
      // Convert entries to JSONL format
      const jsonlContent = entries.map(e => JSON.stringify(e)).join('\n') + '\n';

      if (!fileCreatedRef.current) {
        // Create new file with initial content
        await storageClientRef.current.writeFileAsText(logFilePath, jsonlContent);
        fileCreatedRef.current = true;
        console.log(`[DebugLogger] Log file created: ${logFilePath}`);
      } else {
        // For subsequent writes, we need to read + append (OneLake doesn't support true append)
        // For simplicity, we'll create a new file each time (overwrite pattern)
        // TODO: Implement true append if needed
        const existing = await storageClientRef.current.readFileAsText(logFilePath);
        await storageClientRef.current.writeFileAsText(logFilePath, existing + jsonlContent);
      }
    } catch (error) {
      // Restore entries to buffer on failure
      bufferRef.current = [...entries, ...bufferRef.current];
      console.error('[DebugLogger] Failed to flush to OneLake:', error);
    } finally {
      isFlushingRef.current = false;
    }
  }, [logFilePath]);

  // Set up periodic flush
  useEffect(() => {
    if (!DEBUG_LOGGING_ENABLED) return undefined;

    flushIntervalRef.current = setInterval(() => {
      flushBuffer();
    }, BUFFER_FLUSH_INTERVAL_MS);

    // Flush on unmount
    return () => {
      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
      }
      // Synchronous best-effort flush on unmount
      if (bufferRef.current.length > 0) {
        flushBuffer();
      }
    };
  }, [flushBuffer]);

  // Flush on page unload
  useEffect(() => {
    if (!DEBUG_LOGGING_ENABLED) return undefined;

    const handleBeforeUnload = () => {
      if (bufferRef.current.length > 0 && storageClientRef.current && logFilePath) {
        // Use sendBeacon for reliable delivery on page unload
        // Note: This is a best-effort approach
        const entries = bufferRef.current;
        const jsonlContent = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
        console.log('[DebugLogger] Attempting final flush before unload...');
        // Can't use async here, just log what we would have sent
        console.log('[DebugLogger] Pending entries:', entries.length);
        console.log(jsonlContent);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [logFilePath]);

  // Add entry to buffer
  const addLogEntry = useCallback((level: LogLevel, component: string, message: string, data?: unknown) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data,
      sessionId: sessionIdRef.current,
    };

    // Always log to console too (for immediate visibility)
    const consoleMethod = level === 'error' ? console.error :
                          level === 'warn' ? console.warn :
                          level === 'debug' ? console.debug : console.log;
    consoleMethod(formatLogForConsole(entry));

    // Add to buffer if enabled
    if (DEBUG_LOGGING_ENABLED) {
      bufferRef.current.push(entry);

      // Flush if buffer is full
      if (bufferRef.current.length >= BUFFER_MAX_SIZE) {
        flushBuffer();
      }
    }
  }, [flushBuffer]);

  // Create logger for a specific component
  const getLogger = useCallback((component: string): DebugLogger => ({
    debug: (message: string, data?: unknown) => addLogEntry('debug', component, message, data),
    info: (message: string, data?: unknown) => addLogEntry('info', component, message, data),
    warn: (message: string, data?: unknown) => addLogEntry('warn', component, message, data),
    error: (message: string, data?: unknown) => addLogEntry('error', component, message, data),
    flush: flushBuffer,
  }), [addLogEntry, flushBuffer]);

  // Context value
  const value = useMemo<DebugLoggerContextType>(() => ({
    getLogger,
    flush: flushBuffer,
    isEnabled: DEBUG_LOGGING_ENABLED,
    sessionId: sessionIdRef.current,
    logPath: logFilePath,
  }), [getLogger, flushBuffer, logFilePath]);

  return (
    <DebugLoggerContext.Provider value={value}>
      {children}
    </DebugLoggerContext.Provider>
  );
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * useDebugLogContext
 *
 * Access the full debug logger context.
 * Use this when you need access to sessionId, logPath, or manual flush.
 */
export const useDebugLogContext = (): DebugLoggerContextType => {
  const context = useContext(DebugLoggerContext);
  if (!context) {
    // Return a no-op context if provider is not available
    // This allows components to use logging even before provider is mounted
    return {
      getLogger: (component: string) => ({
        debug: (msg: string, data?: unknown) => console.debug(`[DEBUG][${component}]`, msg, data),
        info: (msg: string, data?: unknown) => console.log(`[INFO][${component}]`, msg, data),
        warn: (msg: string, data?: unknown) => console.warn(`[WARN][${component}]`, msg, data),
        error: (msg: string, data?: unknown) => console.error(`[ERROR][${component}]`, msg, data),
        flush: async () => {},
      }),
      flush: async () => {},
      isEnabled: false,
      sessionId: 'no-context',
      logPath: null,
    };
  }
  return context;
};

/**
 * useDebugLog - PRIMARY HOOK FOR DEBUG LOGGING
 *
 * Get a logger instance for a specific component.
 * Logs will be tagged with the component name for easy filtering.
 *
 * @param component - Name of the component (e.g., 'DataSourcesView', 'GraphQLClient')
 * @returns DebugLogger with debug/info/warn/error/flush methods
 *
 * @example
 * const log = useDebugLog('DataSourcesView');
 * log.info('Loading data sources...');
 * log.debug('Fetched items', { count: 5 });
 * log.error('Failed to load', { error: err.message });
 */
export const useDebugLog = (component: string): DebugLogger => {
  const { getLogger } = useDebugLogContext();
  return useMemo(() => getLogger(component), [getLogger, component]);
};

// ============================================================================
// Utility: View logs in OneLake
// ============================================================================
/**
 * To view debug logs:
 *
 * 1. Open OneLake File Explorer in Fabric
 * 2. Navigate to your item's Files folder
 * 3. Open debug_logs/YYYY-MM-DD/
 * 4. Download session_*.jsonl files
 * 5. Each line is a JSON object:
 *    {"timestamp":"...","level":"info","component":"DataSourcesView","message":"...","data":{...}}
 *
 * Or use PowerShell to download:
 * az storage blob download --account-name onelake --container $workspaceId --name "$itemId/Files/debug_logs/2024-01-15/session_xxx.jsonl" --file local.jsonl
 */
