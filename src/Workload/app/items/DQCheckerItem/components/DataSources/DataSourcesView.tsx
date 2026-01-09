/**
 * DataSourcesView Component
 *
 * Main view for managing data sources.
 * Uses DataContext for OneLake JSON storage.
 *
 * Uses Fabric platform notifications via WorkloadClientContext
 * for consistent UX across the workload.
 */

import React, { useCallback } from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import { DataSourceList } from './DataSourceList';
import { DataSource, DataSourceFormData } from '../../types/dataSource.types';
import { useSources } from '../../context';
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

  // Data from context (already loaded and cached)
  const { sources, createSource, updateSource, deleteSource, isLoading, error } = useSources();

  // Show error if loading failed
  if (error) {
    log.error('Data loading error', { error });
  }

  // Cast sources to DataSource[] (structurally equivalent types)
  const dataSources = sources as unknown as DataSource[];

  // Create handler - convert DataSourceFormData to SourceInput
  const handleCreate = useCallback(
    async (data: DataSourceFormData) => {
      log.info('Creating data source', { name: data.source_name });
      try {
        const result = await createSource({
          source_name: data.source_name,
          source_type: data.source_type,
          server_name: data.server_name,
          database_name: data.database_name,
          keyvault_uri: data.keyvault_uri,
          client_id: data.client_id,
          secret_name: data.secret_name,
          description: data.description,
          is_active: data.is_active,
        });
        log.info('Data source created', { id: result.source_id, name: result.source_name });
        await showSuccess('Connection Created', `"${result.source_name}" has been created successfully.`);
      } catch (err) {
        log.error('Failed to create data source', { error: err instanceof Error ? err.message : String(err) });
        const message = err instanceof Error ? err.message : 'Failed to create connection';
        await showError('Create Failed', message);
        throw err;
      }
    },
    [createSource, showSuccess, showError, log]
  );

  // Update handler - convert DataSourceFormData to SourceUpdate
  const handleUpdate = useCallback(
    async (sourceId: string, data: DataSourceFormData) => {
      log.info('Updating data source', { id: sourceId, name: data.source_name });
      try {
        const result = await updateSource(sourceId, {
          source_name: data.source_name,
          source_type: data.source_type,
          server_name: data.server_name,
          database_name: data.database_name,
          keyvault_uri: data.keyvault_uri,
          client_id: data.client_id,
          secret_name: data.secret_name,
          description: data.description,
          is_active: data.is_active,
        });
        log.info('Data source updated', { id: result.source_id, name: result.source_name });
        await showSuccess('Connection Updated', `"${result.source_name}" has been updated successfully.`);
      } catch (err) {
        log.error('Failed to update data source', { id: sourceId, error: err instanceof Error ? err.message : String(err) });
        const message = err instanceof Error ? err.message : 'Failed to update connection';
        await showError('Update Failed', message);
        throw err;
      }
    },
    [updateSource, showSuccess, showError, log]
  );

  // Delete handler
  const handleDelete = useCallback(
    async (sourceId: string) => {
      log.info('Deleting data source', { id: sourceId });
      try {
        await deleteSource(sourceId);
        log.info('Data source deleted', { id: sourceId });
        await showSuccess('Connection Deleted', 'The connection has been removed.');
      } catch (err) {
        log.error('Failed to delete data source', { id: sourceId, error: err instanceof Error ? err.message : String(err) });
        const message = err instanceof Error ? err.message : 'Failed to delete connection';
        await showError('Delete Failed', message);
        throw err;
      }
    },
    [deleteSource, showSuccess, showError, log]
  );

  // Toggle status handler
  const handleToggleStatus = useCallback(
    async (sourceId: string, currentStatus: boolean) => {
      log.info('Toggling data source status', { id: sourceId, currentStatus });
      try {
        await updateSource(sourceId, { is_active: !currentStatus });
        const action = currentStatus ? 'disabled' : 'enabled';
        log.info('Data source status toggled', { id: sourceId, newStatus: !currentStatus });
        await showSuccess('Status Updated', `Connection has been ${action}.`);
      } catch (err) {
        log.error('Failed to toggle status', { id: sourceId, error: err instanceof Error ? err.message : String(err) });
        const message = err instanceof Error ? err.message : 'Failed to toggle status';
        await showError('Status Update Failed', message);
      }
    },
    [updateSource, showSuccess, showError, log]
  );

  return (
    <div className={styles.container}>
      <DataSourceList
        dataSources={dataSources}
        isLoading={isLoading}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
      />
    </div>
  );
};
