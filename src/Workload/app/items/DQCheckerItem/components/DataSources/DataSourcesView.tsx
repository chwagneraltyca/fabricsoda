/**
 * DataSourcesView Component
 *
 * Main view for managing data sources.
 * Orchestrates the list and handles API interactions.
 *
 * Uses Fabric platform notifications via WorkloadClientContext
 * for consistent UX across the workload.
 *
 * This is the primary view to be used in the DQCheckerItem editor.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { DataSourceList } from './DataSourceList';
import { DataSource, DataSourceFormData } from '../../types/dataSource.types';
import { dataSourceService } from '../../services/dataSourceService';
import { useNotifications, useDebugLog } from '../../../../context';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    height: '100%',
  },
});

export const DataSourcesView: React.FC = () => {
  const styles = useStyles();
  const { showSuccess, showError } = useNotifications();
  const log = useDebugLog('DataSourcesView');

  // Data state
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data sources
  const loadDataSources = useCallback(async () => {
    setIsLoading(true);
    log.info('Loading data sources...');
    try {
      const sources = await dataSourceService.list();
      setDataSources(sources);
      log.info('Data sources loaded', { count: sources.length });
    } catch (error) {
      log.error('Failed to load data sources', { error: error instanceof Error ? error.message : String(error) });
      const message = error instanceof Error ? error.message : 'Failed to load data sources';
      await showError('Error Loading Data', message);
    } finally {
      setIsLoading(false);
    }
  }, [showError, log]);

  // Initial load
  useEffect(() => {
    loadDataSources();
  }, [loadDataSources]);

  // Create handler
  const handleCreate = useCallback(async (data: DataSourceFormData) => {
    log.info('Creating data source', { name: data.source_name });
    try {
      const result = await dataSourceService.create(data);
      log.info('Data source created', { id: result.source_id, name: result.source_name });
      await showSuccess('Connection Created', `"${result.source_name}" has been created successfully.`);
    } catch (error) {
      log.error('Failed to create data source', { error: error instanceof Error ? error.message : String(error) });
      const message = error instanceof Error ? error.message : 'Failed to create connection';
      await showError('Create Failed', message);
      throw error; // Re-throw to let form handle it
    }
  }, [showSuccess, showError, log]);

  // Update handler
  const handleUpdate = useCallback(async (sourceId: number, data: DataSourceFormData) => {
    log.info('Updating data source', { id: sourceId, name: data.source_name });
    try {
      const result = await dataSourceService.update(sourceId, data);
      log.info('Data source updated', { id: result.source_id, name: result.source_name });
      await showSuccess('Connection Updated', `"${result.source_name}" has been updated successfully.`);
    } catch (error) {
      log.error('Failed to update data source', { id: sourceId, error: error instanceof Error ? error.message : String(error) });
      const message = error instanceof Error ? error.message : 'Failed to update connection';
      await showError('Update Failed', message);
      throw error;
    }
  }, [showSuccess, showError, log]);

  // Delete handler
  const handleDelete = useCallback(async (sourceId: number) => {
    log.info('Deleting data source', { id: sourceId });
    try {
      await dataSourceService.delete(sourceId);
      log.info('Data source deleted', { id: sourceId });
      await showSuccess('Connection Deleted', 'The connection has been removed.');
    } catch (error) {
      log.error('Failed to delete data source', { id: sourceId, error: error instanceof Error ? error.message : String(error) });
      const message = error instanceof Error ? error.message : 'Failed to delete connection';
      await showError('Delete Failed', message);
      throw error;
    }
  }, [showSuccess, showError, log]);

  // Toggle status handler
  const handleToggleStatus = useCallback(async (sourceId: number, currentStatus: boolean) => {
    log.info('Toggling data source status', { id: sourceId, currentStatus });
    try {
      await dataSourceService.toggleStatus(sourceId, currentStatus);
      const action = currentStatus ? 'disabled' : 'enabled';
      log.info('Data source status toggled', { id: sourceId, newStatus: !currentStatus });
      await showSuccess('Status Updated', `Connection has been ${action}.`);
    } catch (error) {
      log.error('Failed to toggle status', { id: sourceId, error: error instanceof Error ? error.message : String(error) });
      const message = error instanceof Error ? error.message : 'Failed to toggle status';
      await showError('Status Update Failed', message);
    }
  }, [showSuccess, showError, log]);

  return (
    <div className={styles.container}>
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
