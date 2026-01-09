/**
 * TestcaseList Component
 *
 * Data table displaying all testcases with actions.
 * Shows testcase name, table reference, check count, status.
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
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Drawer,
} from '@fluentui/react-components';
import {
  Add24Regular,
  Edit24Regular,
  Delete24Regular,
  ArrowSwap24Regular,
  TableSimple24Regular,
  Checkmark24Regular,
  ChevronDown16Regular,
  Flash20Regular,
  TableMultiple20Regular,
} from '@fluentui/react-icons';
import { Testcase, TestcaseInput, getTableRef, Source } from '../../types';
import { useDataTableStyles } from '../../../../styles/tokens';
import { TestcaseForm } from './TestcaseForm';
import { DeleteConfirmDialog } from '../DataSources/DeleteConfirmDialog';
import { QuickCheckPanel } from './QuickCheckPanel';
import { TestcaseWizard } from './TestcaseWizard';

// Component-specific styles
const useStyles = makeStyles({
  container: {
    maxWidth: '1280px',
    marginLeft: 'auto',
    marginRight: 'auto',
    backgroundColor: tokens.colorNeutralBackground2,
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
    fontSize: '28px',
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
    letterSpacing: '-0.02em',
    lineHeight: '1.2',
    margin: 0,
  },

  pageSubtitle: {
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground2,
    margin: 0,
    marginTop: tokens.spacingVerticalS,
  },

  filterCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    boxShadow: tokens.shadow2,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    marginBottom: tokens.spacingVerticalL,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
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
    width: '96px',
    height: '96px',
    ...shorthands.borderRadius('50%'),
    background: `linear-gradient(135deg, ${tokens.colorBrandBackground2} 0%, ${tokens.colorNeutralBackground1} 100%)`,
    boxShadow: tokens.shadow8,
    marginBottom: tokens.spacingVerticalXL,
  },

  emptyStateIcon: {
    fontSize: '48px',
    color: tokens.colorBrandForeground1,
  },

  emptyStateTitle: {
    fontSize: tokens.fontSizeBase600,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    margin: 0,
    marginBottom: tokens.spacingVerticalM,
  },

  emptyStateDescription: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalXL,
    maxWidth: '360px',
    lineHeight: '1.6',
    textAlign: 'center' as const,
  },

  actionsCell: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalXS,
  },

  badgeActive: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    color: tokens.colorPaletteGreenForeground1,
  },

  badgeInactive: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2,
  },

  badgeChecks: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },

  loadingOverlay: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    ...shorthands.padding(tokens.spacingVerticalXXL),
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

  cellSecondary: {
    color: tokens.colorNeutralForeground2,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
});

interface TestcaseListProps {
  testcases: Testcase[];
  sources: Source[];
  isLoading: boolean;
  onCreate: (data: TestcaseInput) => Promise<void>;
  onUpdate: (testcaseId: string, data: TestcaseInput) => Promise<void>;
  onDelete: (testcaseId: string) => Promise<void>;
  onToggleStatus: (testcaseId: string, currentStatus: boolean) => Promise<void>;
}

export const TestcaseList: React.FC<TestcaseListProps> = ({
  testcases,
  sources,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
  onToggleStatus,
}) => {
  const styles = useStyles();
  const tableStyles = useDataTableStyles();

  // Filter state
  const [activeOnly, setActiveOnly] = useState(false);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingTestcase, setEditingTestcase] = useState<Testcase | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTestcase, setDeletingTestcase] = useState<Testcase | null>(null);

  // New: Quick Check and Table Checks panels
  const [quickCheckOpen, setQuickCheckOpen] = useState(false);
  const [tableChecksOpen, setTableChecksOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Filtered data
  const filteredTestcases = activeOnly
    ? testcases.filter(t => t.is_active)
    : testcases;

  // Get source name for display
  const getSourceName = (sourceId: string) => {
    const source = sources.find(s => s.source_id === sourceId);
    return source?.source_name || 'Unknown';
  };

  // Open form for edit
  const handleOpenEdit = useCallback((testcase: Testcase) => {
    setEditingTestcase(testcase);
    setFormOpen(true);
  }, []);

  // Handle form submission
  const handleFormSubmit = useCallback(
    async (data: TestcaseInput, testcaseId?: string) => {
      if (testcaseId) {
        await onUpdate(testcaseId, data);
      } else {
        await onCreate(data);
      }
    },
    [onCreate, onUpdate]
  );

  // Open delete confirmation
  const handleOpenDelete = useCallback((testcase: Testcase) => {
    setDeletingTestcase(testcase);
    setDeleteDialogOpen(true);
  }, []);

  // Handle delete confirmation
  const handleConfirmDelete = useCallback(async () => {
    if (deletingTestcase) {
      await onDelete(deletingTestcase.testcase_id);
      setDeleteDialogOpen(false);
      setDeletingTestcase(null);
    }
  }, [deletingTestcase, onDelete]);

  // Handle toggle status
  const handleToggleStatus = useCallback(
    async (testcase: Testcase) => {
      await onToggleStatus(testcase.testcase_id, testcase.is_active);
    },
    [onToggleStatus]
  );

  // Handle Quick Check save
  const handleQuickCheckSave = useCallback(
    async (data: TestcaseInput) => {
      setIsSaving(true);
      try {
        await onCreate(data);
        setQuickCheckOpen(false);
      } finally {
        setIsSaving(false);
      }
    },
    [onCreate]
  );

  // Handle Table Checks wizard save
  const handleTableChecksSave = useCallback(
    async (data: TestcaseInput) => {
      setIsSaving(true);
      try {
        await onCreate(data);
        setTableChecksOpen(false);
      } finally {
        setIsSaving(false);
      }
    },
    [onCreate]
  );

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <TableSimple24Regular />
          </div>
          <div className={styles.headerContent}>
            <h2 className={styles.pageTitle}>Manage Testcases</h2>
            <p className={styles.pageSubtitle}>
              Define data quality checks for your tables
            </p>
          </div>
        </div>
        <Menu positioning="below-end">
          <MenuTrigger disableButtonEnhancement>
            <Button
              appearance="primary"
              icon={<Add24Regular />}
              disabled={sources.filter(s => s.is_active).length === 0}
            >
              New <ChevronDown16Regular style={{ marginLeft: '4px' }} />
            </Button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem
                icon={<Flash20Regular />}
                onClick={() => setQuickCheckOpen(true)}
              >
                Quick Check
              </MenuItem>
              <MenuItem
                icon={<TableMultiple20Regular />}
                onClick={() => setTableChecksOpen(true)}
              >
                Table Checks
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>

      {/* Filters */}
      <div className={styles.filterCard}>
        <Checkbox
          checked={activeOnly}
          onChange={(_, data) => setActiveOnly(!!data.checked)}
          label="Active only"
        />
        <span className={styles.filterCount}>
          Total: <strong>{filteredTestcases.length}</strong> testcase(s),{' '}
          <strong>{filteredTestcases.reduce((sum, t) => sum + t.checks.length, 0)}</strong> check(s)
        </span>
      </div>

      {/* Data Table */}
      <div className={styles.tableContainer}>
        {isLoading ? (
          <div className={styles.loadingOverlay}>
            <Spinner label="Loading testcases..." />
          </div>
        ) : sources.filter(s => s.is_active).length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIconWrapper}>
              <TableSimple24Regular className={styles.emptyStateIcon} />
            </div>
            <h3 className={styles.emptyStateTitle}>No active connections</h3>
            <p className={styles.emptyStateDescription}>
              Create a data source connection first before adding testcases. Go to the Data Sources tab to add one.
            </p>
          </div>
        ) : filteredTestcases.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIconWrapper}>
              <Checkmark24Regular className={styles.emptyStateIcon} />
            </div>
            <h3 className={styles.emptyStateTitle}>No testcases yet</h3>
            <p className={styles.emptyStateDescription}>
              Get started by adding a testcase. Each testcase targets a table and contains data quality checks.
            </p>
            <Menu positioning="below">
              <MenuTrigger disableButtonEnhancement>
                <Button
                  appearance="primary"
                  icon={<Add24Regular />}
                >
                  New <ChevronDown16Regular style={{ marginLeft: '4px' }} />
                </Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem
                    icon={<Flash20Regular />}
                    onClick={() => setQuickCheckOpen(true)}
                  >
                    Quick Check
                  </MenuItem>
                  <MenuItem
                    icon={<TableMultiple20Regular />}
                    onClick={() => setTableChecksOpen(true)}
                  >
                    Table Checks
                  </MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        ) : (
          <table className={tableStyles.table}>
            <thead className={tableStyles.thead}>
              <tr>
                <th className={tableStyles.th}>Name</th>
                <th className={tableStyles.th}>Table</th>
                <th className={tableStyles.th}>Source</th>
                <th className={tableStyles.th}>Checks</th>
                <th className={tableStyles.th}>Status</th>
                <th className={mergeClasses(tableStyles.th, tableStyles.thRight)}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className={tableStyles.tbody}>
              {filteredTestcases.map(testcase => (
                <tr key={testcase.testcase_id} className={tableStyles.tr}>
                  <td className={mergeClasses(tableStyles.td, tableStyles.cellPrimary)}>
                    {testcase.testcase_name}
                  </td>
                  <td className={mergeClasses(tableStyles.td, styles.cellSecondary)}>
                    {getTableRef(testcase)}
                  </td>
                  <td className={tableStyles.td}>
                    {getSourceName(testcase.source_id)}
                  </td>
                  <td className={tableStyles.td}>
                    <Badge
                      appearance="filled"
                      className={styles.badgeChecks}
                    >
                      {testcase.checks.filter(c => c.is_enabled).length}/{testcase.checks.length} enabled
                    </Badge>
                  </td>
                  <td className={tableStyles.td}>
                    <Badge
                      appearance="filled"
                      className={testcase.is_active ? styles.badgeActive : styles.badgeInactive}
                    >
                      {testcase.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className={mergeClasses(tableStyles.td, tableStyles.tdRight)}>
                    <div className={styles.actionsCell}>
                      {/* Toggle Status */}
                      <Tooltip
                        content={testcase.is_active ? 'Deactivate' : 'Activate'}
                        relationship="label"
                      >
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={<ArrowSwap24Regular />}
                          className={styles.actionWarning}
                          onClick={() => handleToggleStatus(testcase)}
                        />
                      </Tooltip>

                      {/* Edit */}
                      <Tooltip content="Edit" relationship="label">
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={<Edit24Regular />}
                          className={styles.actionPrimary}
                          onClick={() => handleOpenEdit(testcase)}
                        />
                      </Tooltip>

                      {/* Delete */}
                      <Tooltip content="Delete" relationship="label">
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={<Delete24Regular />}
                          className={styles.actionDanger}
                          onClick={() => handleOpenDelete(testcase)}
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
      <TestcaseForm
        testcase={editingTestcase}
        sources={sources}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        sourceName={deletingTestcase?.testcase_name || ''}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeletingTestcase(null);
        }}
        onConfirm={handleConfirmDelete}
      />

      {/* Quick Check Panel (Drawer) */}
      <Drawer
        open={quickCheckOpen}
        onOpenChange={(_, { open }) => setQuickCheckOpen(open)}
        position="end"
        size="large"
      >
        <QuickCheckPanel
          onSave={handleQuickCheckSave}
          onCancel={() => setQuickCheckOpen(false)}
          isLoading={isSaving}
        />
      </Drawer>

      {/* Table Checks Wizard (Drawer) */}
      <Drawer
        open={tableChecksOpen}
        onOpenChange={(_, { open }) => setTableChecksOpen(open)}
        position="end"
        size="large"
      >
        <TestcaseWizard
          onSave={handleTableChecksSave}
          onCancel={() => setTableChecksOpen(false)}
          isLoading={isSaving}
        />
      </Drawer>
    </div>
  );
};
