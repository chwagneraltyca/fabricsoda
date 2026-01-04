/**
 * DataSourceList Component
 *
 * Data table displaying all data sources with actions.
 * Matches legacy Flask table styling using FluentUI v9 components.
 *
 * Legacy reference: Legacy/flask_app/templates/data_sources/manage.html
 */

import React, { useState, useCallback } from 'react';
import {
  Button,
  Tooltip,
  Badge,
  Spinner,
  Checkbox,
  makeStyles,
  tokens,
  shorthands,
  mergeClasses,
} from '@fluentui/react-components';
import {
  Add24Regular,
  Edit24Regular,
  Delete24Regular,
  ArrowSwap24Regular,
  Flash24Regular,
} from '@fluentui/react-icons';
import { DataSource, DataSourceFormData } from '../../types/dataSource.types';
import { dqColors, dqTypography, useDataTableStyles } from '../../../../styles/tokens';
import { DataSourceForm } from './DataSourceForm';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

// Component-specific styles
const useStyles = makeStyles({
  container: {
    maxWidth: '1280px', // max-w-7xl
    marginLeft: 'auto',
    marginRight: 'auto',
  },

  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalL,
  },

  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },

  pageTitle: {
    fontSize: dqTypography.fontSize2xl,
    fontWeight: dqTypography.fontWeightBold,
    color: tokens.colorNeutralForeground1,
    margin: 0,
  },

  pageSubtitle: {
    fontSize: dqTypography.fontSizeMd,
    color: tokens.colorNeutralForeground3,
    margin: 0,
  },

  filterCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    boxShadow: tokens.shadow4,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    marginBottom: tokens.spacingVerticalL,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },

  filterCount: {
    marginLeft: 'auto',
    fontSize: dqTypography.fontSizeSm,
    color: tokens.colorNeutralForeground3,
  },

  tableContainer: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    boxShadow: tokens.shadow4,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    ...shorthands.overflow('hidden'),
  },

  emptyState: {
    textAlign: 'center' as const,
    ...shorthands.padding(tokens.spacingVerticalXXL, tokens.spacingHorizontalL),
    color: tokens.colorNeutralForeground3,
  },

  actionsCell: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalXS,
  },

  // Badge variants matching legacy
  badgeActive: {
    backgroundColor: dqColors.success100,
    color: dqColors.success700,
  },

  badgeInactive: {
    backgroundColor: dqColors.gray100,
    color: dqColors.gray700,
  },

  badgeType: {
    backgroundColor: dqColors.primary100,
    color: dqColors.primary700,
  },

  loadingOverlay: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    ...shorthands.padding(tokens.spacingVerticalXXL),
  },

  // Action button colors (matches legacy btn-link-*)
  actionSuccess: {
    color: dqColors.success600,
    '&:hover': {
      color: dqColors.success700,
      backgroundColor: dqColors.success50,
    },
  },

  actionWarning: {
    color: dqColors.warning600,
    '&:hover': {
      color: dqColors.warning700,
      backgroundColor: dqColors.warning50,
    },
  },

  actionPrimary: {
    color: dqColors.primary600,
    '&:hover': {
      color: dqColors.primary700,
      backgroundColor: dqColors.primary50,
    },
  },

  actionDanger: {
    color: dqColors.danger600,
    '&:hover': {
      color: dqColors.danger700,
      backgroundColor: dqColors.danger50,
    },
  },
});

interface DataSourceListProps {
  /** Array of data sources to display */
  dataSources: DataSource[];
  /** Whether data is loading */
  isLoading: boolean;
  /** Callback to refresh data */
  onRefresh: () => void;
  /** Callback when a data source is created */
  onCreate: (data: DataSourceFormData) => Promise<void>;
  /** Callback when a data source is updated */
  onUpdate: (sourceId: number, data: DataSourceFormData) => Promise<void>;
  /** Callback when a data source is deleted */
  onDelete: (sourceId: number) => Promise<void>;
  /** Callback when active status is toggled */
  onToggleStatus: (sourceId: number, currentStatus: boolean) => Promise<void>;
  /** Optional callback for testing connection (future feature) */
  onTestConnection?: (sourceId: number) => Promise<void>;
}

export const DataSourceList: React.FC<DataSourceListProps> = ({
  dataSources,
  isLoading,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
  onToggleStatus,
  onTestConnection,
}) => {
  const styles = useStyles();
  const tableStyles = useDataTableStyles();

  // Filter state
  const [activeOnly, setActiveOnly] = useState(false);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSource, setDeletingSource] = useState<DataSource | null>(null);

  // Filtered data
  const filteredSources = activeOnly
    ? dataSources.filter(s => s.is_active)
    : dataSources;

  // Open form for create
  const handleOpenCreate = useCallback(() => {
    setEditingSource(null);
    setFormOpen(true);
  }, []);

  // Open form for edit
  const handleOpenEdit = useCallback((source: DataSource) => {
    setEditingSource(source);
    setFormOpen(true);
  }, []);

  // Handle form submission
  const handleFormSubmit = useCallback(
    async (data: DataSourceFormData, sourceId?: number) => {
      if (sourceId) {
        await onUpdate(sourceId, data);
      } else {
        await onCreate(data);
      }
      onRefresh();
    },
    [onCreate, onUpdate, onRefresh]
  );

  // Open delete confirmation
  const handleOpenDelete = useCallback((source: DataSource) => {
    setDeletingSource(source);
    setDeleteDialogOpen(true);
  }, []);

  // Handle delete confirmation
  const handleConfirmDelete = useCallback(async () => {
    if (deletingSource) {
      await onDelete(deletingSource.source_id);
      setDeleteDialogOpen(false);
      setDeletingSource(null);
      onRefresh();
    }
  }, [deletingSource, onDelete, onRefresh]);

  // Handle toggle status
  const handleToggleStatus = useCallback(
    async (source: DataSource) => {
      await onToggleStatus(source.source_id, source.is_active);
      onRefresh();
    },
    [onToggleStatus, onRefresh]
  );

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <h2 className={styles.pageTitle}>Manage Connections</h2>
          <p className={styles.pageSubtitle}>
            Configure database connections for data quality checks
          </p>
        </div>
        <Button
          appearance="primary"
          icon={<Add24Regular />}
          onClick={handleOpenCreate}
        >
          Add Connection
        </Button>
      </div>

      {/* Filters */}
      <div className={styles.filterCard}>
        <Checkbox
          checked={activeOnly}
          onChange={(_, data) => setActiveOnly(!!data.checked)}
          label="Active only"
        />
        <span className={styles.filterCount}>
          Total: <strong>{filteredSources.length}</strong> connection(s)
        </span>
      </div>

      {/* Data Table */}
      <div className={styles.tableContainer}>
        {isLoading ? (
          <div className={styles.loadingOverlay}>
            <Spinner label="Loading connections..." />
          </div>
        ) : filteredSources.length === 0 ? (
          <div className={styles.emptyState}>
            No connections found. Click "Add Connection" to create one.
          </div>
        ) : (
          <table className={tableStyles.table}>
            <thead className={tableStyles.thead}>
              <tr>
                <th className={tableStyles.th}>Name</th>
                <th className={tableStyles.th}>Description</th>
                <th className={tableStyles.th}>Status</th>
                <th className={mergeClasses(tableStyles.th, tableStyles.thRight)}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className={tableStyles.tbody}>
              {filteredSources.map(source => (
                <tr key={source.source_id} className={tableStyles.tr}>
                  <td className={mergeClasses(tableStyles.td, tableStyles.cellPrimary)}>
                    {source.source_name}
                  </td>
                  <td className={mergeClasses(tableStyles.td, tableStyles.cellSecondary)}>
                    {source.description || '-'}
                  </td>
                  <td className={tableStyles.td}>
                    <Badge
                      appearance="filled"
                      className={source.is_active ? styles.badgeActive : styles.badgeInactive}
                    >
                      {source.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className={mergeClasses(tableStyles.td, tableStyles.tdRight)}>
                    <div className={styles.actionsCell}>
                      {/* Test Connection */}
                      {onTestConnection && (
                        <Tooltip content="Test Connection" relationship="label">
                          <Button
                            appearance="subtle"
                            size="small"
                            icon={<Flash24Regular />}
                            className={styles.actionSuccess}
                            onClick={() => onTestConnection(source.source_id)}
                          />
                        </Tooltip>
                      )}

                      {/* Toggle Status */}
                      <Tooltip
                        content={source.is_active ? 'Deactivate' : 'Activate'}
                        relationship="label"
                      >
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={<ArrowSwap24Regular />}
                          className={styles.actionWarning}
                          onClick={() => handleToggleStatus(source)}
                        />
                      </Tooltip>

                      {/* Edit */}
                      <Tooltip content="Edit" relationship="label">
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={<Edit24Regular />}
                          className={styles.actionPrimary}
                          onClick={() => handleOpenEdit(source)}
                        />
                      </Tooltip>

                      {/* Delete */}
                      <Tooltip content="Delete" relationship="label">
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={<Delete24Regular />}
                          className={styles.actionDanger}
                          onClick={() => handleOpenDelete(source)}
                        />
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form Dialog */}
      <DataSourceForm
        dataSource={editingSource}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        sourceName={deletingSource?.source_name || ''}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeletingSource(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
