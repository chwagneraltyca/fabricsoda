/**
 * Central Context Exports
 *
 * All app-wide context providers and hooks should be exported from here.
 *
 * NOTIFICATIONS:
 * Use useNotifications() for all user-facing notifications.
 * See WorkloadClientContext.tsx for full documentation.
 *
 * DEBUG LOGGING (DEVELOPMENT ONLY):
 * Use useDebugLog() to write debug logs to OneLake instead of console.
 * See DebugLoggerContext.tsx for full documentation.
 * Remove DebugLoggerProvider when development is complete.
 */

export {
  WorkloadClientProvider,
  useWorkloadClient,
  useNotifications,
} from './WorkloadClientContext';

export {
  DebugLoggerProvider,
  useDebugLog,
  useDebugLogContext,
} from './DebugLoggerContext';

export {
  QueryClientProvider,
  getQueryClient,
} from './QueryClientContext';
