/**
 * WorkloadClientContext - CENTRAL NOTIFICATION SYSTEM
 *
 * ============================================================================
 * IMPORTANT: This is the ONLY approved way to show notifications in this app.
 * ============================================================================
 *
 * DO NOT use:
 * - Local MessageBar components for success/error feedback
 * - console.log for user-facing messages
 * - alert() or window.confirm()
 * - Custom toast implementations
 *
 * ALWAYS use:
 * - useNotifications() hook for Fabric platform toast notifications
 *
 * This ensures consistent UX across the entire workload following MS Fabric
 * notification patterns (same as Data Lineage reference project).
 *
 * USAGE:
 * ------
 * 1. Wrap your root component with WorkloadClientProvider:
 *
 *    <WorkloadClientProvider workloadClient={workloadClient}>
 *      <App />
 *    </WorkloadClientProvider>
 *
 * 2. In any child component, use the notifications hook:
 *
 *    import { useNotifications } from '../../context';
 *
 *    const MyComponent = () => {
 *      const { showSuccess, showError, showWarning, showInfo } = useNotifications();
 *
 *      const handleSave = async () => {
 *        try {
 *          await saveData();
 *          await showSuccess('Saved', 'Your changes have been saved.');
 *        } catch (error) {
 *          await showError('Save Failed', error.message);
 *        }
 *      };
 *    };
 *
 * NOTIFICATION TYPES:
 * -------------------
 * - showSuccess(title, message) - Green toast for successful operations
 * - showError(title, message)   - Red toast for errors
 * - showWarning(title, message) - Yellow toast for warnings
 * - showInfo(title, message)    - Blue toast for informational messages
 *
 * All notifications use Fabric's NotificationToastDuration.Medium (5 seconds).
 *
 * @see https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/
 */

import React, { createContext, useContext, useCallback, useMemo, ReactNode } from 'react';
import { WorkloadClientAPI, NotificationType, NotificationToastDuration } from '@ms-fabric/workload-client';

// Context type
interface WorkloadClientContextType {
  workloadClient: WorkloadClientAPI;
  // Notification helpers - use these instead of local MessageBar
  showSuccess: (title: string, message: string) => Promise<void>;
  showError: (title: string, message: string) => Promise<void>;
  showWarning: (title: string, message: string) => Promise<void>;
  showInfo: (title: string, message: string) => Promise<void>;
}

// Create context with undefined default
const WorkloadClientContext = createContext<WorkloadClientContextType | undefined>(undefined);

// Provider props
interface WorkloadClientProviderProps {
  workloadClient: WorkloadClientAPI;
  children: ReactNode;
}

/**
 * WorkloadClientProvider
 *
 * Wrap your root component with this provider to enable Fabric notifications
 * and workloadClient access throughout the component tree.
 *
 * @example
 * // In your main editor component:
 * return (
 *   <WorkloadClientProvider workloadClient={workloadClient}>
 *     <ItemEditor ... />
 *   </WorkloadClientProvider>
 * );
 */
export const WorkloadClientProvider: React.FC<WorkloadClientProviderProps> = ({
  workloadClient,
  children,
}) => {
  // Helper function for notifications - wrapped in useCallback for stable reference
  const showNotification = useCallback(async (
    title: string,
    message: string,
    type: NotificationType,
    duration: NotificationToastDuration = NotificationToastDuration.Medium
  ) => {
    try {
      await workloadClient.notification.open({
        notificationType: type,
        title,
        message,
        duration,
      });
    } catch (error) {
      // Fallback to console if notification fails (e.g., during testing)
      console.error('[Notification Error]', error);
      console.log(`[${type}] ${title}: ${message}`);
    }
  }, [workloadClient]);

  // Stable notification helpers using useCallback
  const showSuccess = useCallback(
    (title: string, message: string) => showNotification(title, message, NotificationType.Success),
    [showNotification]
  );

  const showError = useCallback(
    (title: string, message: string) => showNotification(title, message, NotificationType.Error),
    [showNotification]
  );

  const showWarning = useCallback(
    (title: string, message: string) => showNotification(title, message, NotificationType.Warning),
    [showNotification]
  );

  const showInfo = useCallback(
    (title: string, message: string) => showNotification(title, message, NotificationType.Info),
    [showNotification]
  );

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo<WorkloadClientContextType>(() => ({
    workloadClient,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  }), [workloadClient, showSuccess, showError, showWarning, showInfo]);

  return (
    <WorkloadClientContext.Provider value={value}>
      {children}
    </WorkloadClientContext.Provider>
  );
};

/**
 * useWorkloadClient
 *
 * Hook to access workloadClient and notification helpers.
 * Must be used within a WorkloadClientProvider.
 *
 * @returns WorkloadClientContextType with workloadClient and notification methods
 * @throws Error if used outside of WorkloadClientProvider
 */
export const useWorkloadClient = (): WorkloadClientContextType => {
  const context = useContext(WorkloadClientContext);
  if (!context) {
    throw new Error(
      'useWorkloadClient must be used within a WorkloadClientProvider. ' +
      'Wrap your component tree with <WorkloadClientProvider workloadClient={...}>.'
    );
  }
  return context;
};

/**
 * useNotifications - PREFERRED HOOK FOR NOTIFICATIONS
 *
 * Convenience hook for just the notification methods.
 * Use this when you only need to show notifications (most common case).
 *
 * @example
 * const { showSuccess, showError } = useNotifications();
 *
 * // After successful operation
 * await showSuccess('Saved', 'Connection updated successfully.');
 *
 * // After failed operation
 * await showError('Error', 'Failed to save connection.');
 */
export const useNotifications = () => {
  const { showSuccess, showError, showWarning, showInfo } = useWorkloadClient();
  return { showSuccess, showError, showWarning, showInfo };
};
