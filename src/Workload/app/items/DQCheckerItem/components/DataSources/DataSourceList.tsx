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
  DatabaseRegular,
  PlugConnectedRegular,
} from '@fluentui/react-icons';
import { DataSource, DataSourceFormData, sourceTypeOptions } from '../../types/dataSource.types';
import { useDataTableStyles } from '../../../../styles/tokens';
import { DataSourceForm } from './DataSourceForm';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

// Component-specific styles
const useStyles = makeStyles({
  container: {
    maxWidth: '1280px', // max-w-7xl
    marginLeft: 'auto',
    marginRight: 'auto',
    backgroundColor: tokens.colorNeutralBackground2, // Subtle off-white warmth
    minHeight: '100%',
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
  },

  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalXL,
    ...shorthands.padding(tokens.spacingVerticalM, 0),
  },

  headerLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
  },

  headerIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontSize: '24px',
  },

  headerContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },

  pageTitle: {
    fontSize: '28px', // Hero900 equivalent - more impactful
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
    letterSpacing: '-0.02em', // Tighter tracking for headlines
    lineHeight: '1.2',
    margin: 0,
  },

  pageSubtitle: {
    fontSize: tokens.fontSizeBase400, // Increased from Base300
    color: tokens.colorNeutralForeground2, // Darker for better readability
    margin: 0,
    marginTop: tokens.spacingVerticalS,
  },

  filterCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    boxShadow: tokens.shadow2, // Lower elevation than table (was shadow4)
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1), // Lighter border
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    marginBottom: tokens.spacingVerticalL,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    // No hover elevation change - keeps filter visually secondary
  },

  filterCount: {
    marginLeft: 'auto',
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
  },

  tableContainer: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    boxShadow: tokens.shadow4,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    ...shorthands.overflow('hidden'),
    transition: 'box-shadow 0.2s ease-out, transform 0.2s ease-out',
    '&:hover': {
      boxShadow: tokens.shadow8,
      transform: 'translateY(-1px)',
    },
  },

  // Empty state - follows Fabric UX pattern with larger icon
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    ...shorthands.padding('64px', tokens.spacingHorizontalL),
    minHeight: '400px',
    backgroundColor: tokens.colorNeutralBackground2,
  },

  emptyStateIconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '96px', // Increased from 80px
    height: '96px',
    ...shorthands.borderRadius('50%'),
    // Gradient background for warmth (Linear/Notion style)
    background: `linear-gradient(135deg, ${tokens.colorBrandBackground2} 0%, ${tokens.colorNeutralBackground1} 100%)`,
    boxShadow: tokens.shadow8, // Increased from shadow4
    marginBottom: tokens.spacingVerticalXL,
  },

  emptyStateIcon: {
    fontSize: '48px', // Increased from 40px
    color: tokens.colorBrandForeground1,
  },

  emptyStateTitle: {
    fontSize: tokens.fontSizeBase600, // Increased from Base500
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    margin: 0,
    marginBottom: tokens.spacingVerticalM,
  },

  emptyStateDescription: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalXL, // Increased from L
    maxWidth: '360px', // Tighter for better readability
    lineHeight: '1.6', // Slightly increased for readability
    textAlign: 'center' as const,
  },

  actionsCell: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalXS,
  },

  // Badge variants using Fabric tokens
  badgeActive: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    color: tokens.colorPaletteGreenForeground1,
  },

  badgeInactive: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2,
  },

  badgeType: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },

  loadingOverlay: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    ...shorthands.padding(tokens.spacingVerticalXXL),
  },

  // Action button colors - Fabric tokens with semantic colors on hover
  // Per UX Design Proposal: neutral by default, semantic colors on hover
  // Added transitions + scale transform for professional polish (Linear-style)
  actionSuccess: {
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorSubtleBackground, // Subtle tint at rest
    transition: 'all 0.15s cubic-bezier(0.33, 1, 0.68, 1)', // easeOutCubic
    '&:hover': {
      color: tokens.colorPaletteGreenForeground1,
      backgroundColor: tokens.colorPaletteGreenBackground1,
      transform: 'scale(1.05)', // Subtle grow
    },
    '&:active': {
      transform: 'scale(0.98)', // Press feedback
    },
  },

  actionWarning: {
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorSubtleBackground,
    transition: 'all 0.15s cubic-bezier(0.33, 1, 0.68, 1)',
    '&:hover': {
      color: tokens.colorPaletteYellowForeground1,
      backgroundColor: tokens.colorPaletteYellowBackground1,
      transform: 'scale(1.05)',
    },
    '&:active': {
      transform: 'scale(0.98)',
    },
  },

  actionPrimary: {
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorSubtleBackground,
    transition: 'all 0.15s cubic-bezier(0.33, 1, 0.68, 1)',
    '&:hover': {
      color: tokens.colorBrandForeground1,
      backgroundColor: tokens.colorBrandBackground2,
      transform: 'scale(1.05)',
    },
    '&:active': {
      transform: 'scale(0.98)',
    },
  },

  actionDanger: {
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorSubtleBackground,
    transition: 'all 0.15s cubic-bezier(0.33, 1, 0.68, 1)',
    '&:hover': {
      color: tokens.colorPaletteRedForeground1,
      backgroundColor: tokens.colorPaletteRedBackground1,
      transform: 'scale(1.05)',
    },
    '&:active': {
      transform: 'scale(0.98)',
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
          <div className={styles.headerIcon}>
            <PlugConnectedRegular />
          </div>
          <div className={styles.headerContent}>
            <h2 className={styles.pageTitle}>Manage Connections</h2>
            <p className={styles.pageSubtitle}>
              Configure database connections for data quality checks
            </p>
          </div>
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
            <div className={styles.emptyStateIconWrapper}>
              <DatabaseRegular className={styles.emptyStateIcon} />
            </div>
            <h3 className={styles.emptyStateTitle}>No connections yet</h3>
            <p className={styles.emptyStateDescription}>
              Get started by adding a database connection. You'll be able to run data quality checks on your Fabric Warehouse.
            </p>
            <Button
              appearance="primary"
              icon={<Add24Regular />}
              onClick={handleOpenCreate}
            >
              Add Connection
            </Button>
          </div>
        ) : (
          <table className={tableStyles.table}>
            <thead className={tableStyles.thead}>
              <tr>
                <th className={tableStyles.th}>Name</th>
                <th className={tableStyles.th}>Type</th>
                <th className={tableStyles.th}>Server / Database</th>
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
                  <td className={tableStyles.td}>
                    <Badge
                      appearance="filled"
                      className={styles.badgeType}
                    >
                      {sourceTypeOptions.find(o => o.value === source.source_type)?.label || source.source_type}
                    </Badge>
                  </td>
                  <td className={mergeClasses(tableStyles.td, tableStyles.cellSecondary)}>
                    {source.server_name && source.database_name
                      ? `${source.server_name} / ${source.database_name}`
                      : source.description || '-'}
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
