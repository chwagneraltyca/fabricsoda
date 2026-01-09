/**
 * TestcasesView Component
 *
 * Main view for managing testcases.
 * Uses DataContext for OneLake JSON storage.
 *
 * Uses Fabric platform notifications via WorkloadClientContext
 * for consistent UX across the workload.
 */

import React, { useCallback } from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import { TestcaseList } from './TestcaseList';
import { TestcaseInput } from '../../types';
import { useTestcases, useSources } from '../../context';
import { useNotifications, useDebugLog } from '../../../../context';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    height: '100%',
  },
});

export const TestcasesView: React.FC = () => {
  const styles = useStyles();
  const { showSuccess, showError } = useNotifications();
  const log = useDebugLog('TestcasesView');

  // Data from context (already loaded and cached)
  const { testcases, createTestcase, updateTestcase, deleteTestcase, isLoading, error } = useTestcases();
  const { sources } = useSources();

  // Show error if loading failed
  if (error) {
    log.error('Data loading error', { error });
  }

  // Create handler
  const handleCreate = useCallback(
    async (data: TestcaseInput) => {
      log.info('Creating testcase', { name: data.testcase_name, table: `${data.schema_name}.${data.table_name}` });
      try {
        const result = await createTestcase(data);
        log.info('Testcase created', { id: result.testcase_id, name: result.testcase_name });
        await showSuccess('Testcase Created', `"${result.testcase_name}" has been created successfully.`);
      } catch (err) {
        log.error('Failed to create testcase', { error: err instanceof Error ? err.message : String(err) });
        const message = err instanceof Error ? err.message : 'Failed to create testcase';
        await showError('Create Failed', message);
        throw err;
      }
    },
    [createTestcase, showSuccess, showError, log]
  );

  // Update handler
  const handleUpdate = useCallback(
    async (testcaseId: string, data: TestcaseInput) => {
      log.info('Updating testcase', { id: testcaseId, name: data.testcase_name });
      try {
        // Convert TestcaseInput to TestcaseUpdate (full checks array)
        const result = await updateTestcase(testcaseId, {
          testcase_name: data.testcase_name,
          source_id: data.source_id,
          schema_name: data.schema_name,
          table_name: data.table_name,
          description: data.description,
          owner: data.owner,
          tags: data.tags,
          is_active: data.is_active,
          checks: data.checks?.map(c => ({
            check_id: `chk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            check_name: c.check_name,
            column_name: c.column_name,
            metric: c.metric || 'row_count',
            config: c.config || {},
            fail_comparison: c.fail_comparison,
            fail_threshold: c.fail_threshold,
            warn_comparison: c.warn_comparison,
            warn_threshold: c.warn_threshold,
            filter_condition: c.filter_condition,
            dimension: c.dimension || 'completeness',
            severity: c.severity || 'medium',
            owner: c.owner,
            tags: c.tags || [],
            is_enabled: c.is_enabled !== false,
          })),
        });
        log.info('Testcase updated', { id: result.testcase_id, name: result.testcase_name });
        await showSuccess('Testcase Updated', `"${result.testcase_name}" has been updated successfully.`);
      } catch (err) {
        log.error('Failed to update testcase', { id: testcaseId, error: err instanceof Error ? err.message : String(err) });
        const message = err instanceof Error ? err.message : 'Failed to update testcase';
        await showError('Update Failed', message);
        throw err;
      }
    },
    [updateTestcase, showSuccess, showError, log]
  );

  // Delete handler
  const handleDelete = useCallback(
    async (testcaseId: string) => {
      log.info('Deleting testcase', { id: testcaseId });
      try {
        await deleteTestcase(testcaseId);
        log.info('Testcase deleted', { id: testcaseId });
        await showSuccess('Testcase Deleted', 'The testcase has been removed.');
      } catch (err) {
        log.error('Failed to delete testcase', { id: testcaseId, error: err instanceof Error ? err.message : String(err) });
        const message = err instanceof Error ? err.message : 'Failed to delete testcase';
        await showError('Delete Failed', message);
        throw err;
      }
    },
    [deleteTestcase, showSuccess, showError, log]
  );

  // Toggle status handler
  const handleToggleStatus = useCallback(
    async (testcaseId: string, currentStatus: boolean) => {
      log.info('Toggling testcase status', { id: testcaseId, currentStatus });
      try {
        await updateTestcase(testcaseId, { is_active: !currentStatus });
        const action = currentStatus ? 'disabled' : 'enabled';
        log.info('Testcase status toggled', { id: testcaseId, newStatus: !currentStatus });
        await showSuccess('Status Updated', `Testcase has been ${action}.`);
      } catch (err) {
        log.error('Failed to toggle status', { id: testcaseId, error: err instanceof Error ? err.message : String(err) });
        const message = err instanceof Error ? err.message : 'Failed to toggle status';
        await showError('Status Update Failed', message);
      }
    },
    [updateTestcase, showSuccess, showError, log]
  );

  return (
    <div className={styles.container}>
      <TestcaseList
        testcases={testcases}
        sources={sources}
        isLoading={isLoading}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
      />
    </div>
  );
};
