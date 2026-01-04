/**
 * DataSourcesView Component
 *
 * Main view for managing data sources.
 * Orchestrates the list and handles API interactions.
 *
 * This is the primary view to be used in the DQCheckerItem editor.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { DataSourceList } from './DataSourceList';
import { DataSource, DataSourceFormData } from '../../types/dataSource.types';
import { dataSourceService } from '../../services/dataSourceService';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    height: '100%',
  },

  messageBar: {
    marginBottom: tokens.spacingVerticalM,
  },
});

interface Notification {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

export const DataSourcesView: React.FC = () => {
  const styles = useStyles();

  // Data state
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Notification state
  const [notification, setNotification] = useState<Notification | null>(null);

  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Load data sources
  const loadDataSources = useCallback(async () => {
    setIsLoading(true);
    try {
      const sources = await dataSourceService.list();
      setDataSources(sources);
    } catch (error) {
      console.error('Failed to load data sources:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to load data sources',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadDataSources();
  }, [loadDataSources]);

  // Create handler
  const handleCreate = useCallback(async (data: DataSourceFormData) => {
    try {
      await dataSourceService.create(data);
      setNotification({
        type: 'success',
        title: 'Success',
        message: 'Connection created successfully',
      });
    } catch (error) {
      console.error('Failed to create data source:', error);
      throw error; // Re-throw to let form handle it
    }
  }, []);

  // Update handler
  const handleUpdate = useCallback(async (sourceId: number, data: DataSourceFormData) => {
    try {
      await dataSourceService.update(sourceId, data);
      setNotification({
        type: 'success',
        title: 'Success',
        message: 'Connection updated successfully',
      });
    } catch (error) {
      console.error('Failed to update data source:', error);
      throw error;
    }
  }, []);

  // Delete handler
  const handleDelete = useCallback(async (sourceId: number) => {
    try {
      await dataSourceService.delete(sourceId);
      setNotification({
        type: 'success',
        title: 'Success',
        message: 'Connection deleted successfully',
      });
    } catch (error) {
      console.error('Failed to delete data source:', error);
      throw error;
    }
  }, []);

  // Toggle status handler
  const handleToggleStatus = useCallback(async (sourceId: number, currentStatus: boolean) => {
    try {
      await dataSourceService.toggleStatus(sourceId, currentStatus);
      setNotification({
        type: 'success',
        title: 'Success',
        message: `Connection ${currentStatus ? 'disabled' : 'enabled'}`,
      });
    } catch (error) {
      console.error('Failed to toggle status:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to toggle status',
      });
    }
  }, []);

  return (
    <div className={styles.container}>
      {/* Notification */}
      {notification && (
        <MessageBar
          intent={notification.type}
          className={styles.messageBar}
        >
          <MessageBarBody>
            <MessageBarTitle>{notification.title}</MessageBarTitle>
            {notification.message}
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Data Source List */}
      <DataSourceList
        dataSources={dataSources}
        isLoading={isLoading}
        onRefresh={loadDataSources}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
      />
    </div>
  );
};
