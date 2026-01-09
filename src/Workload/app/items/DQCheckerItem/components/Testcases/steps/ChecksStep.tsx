/**
 * ChecksStep - Wizard Step 2: Add multiple checks
 *
 * Uses MetricSidebar + CheckForm to add multiple checks to the testcase.
 * Shows list of added checks with edit/delete options.
 */

import React from 'react';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Card,
  Badge,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
} from '@fluentui/react-components';
import {
  Edit16Regular,
  Delete16Regular,
  MoreHorizontal16Regular,
  Add16Regular,
} from '@fluentui/react-icons';
import { MetricSidebar } from '../MetricSidebar';
import { CheckForm } from '../forms/CheckForm';
import { useWizard } from '../WizardContext';
import { Check, getMetricOption } from '../../../types/check.types';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
  },
  sidebar: {
    width: '220px',
    borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
    overflowY: 'auto',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  checksList: {
    padding: tokens.spacingVerticalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    maxHeight: '200px',
    overflowY: 'auto',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  checksHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalS,
  },
  checksTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  checkCard: {
    marginBottom: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalS,
  },
  checkCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  checkInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  formContainer: {
    flex: 1,
    overflowY: 'auto',
  },
  noMetricSelected: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase300,
  },
  emptyChecks: {
    padding: tokens.spacingVerticalM,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
});

export const ChecksStep: React.FC = () => {
  const styles = useStyles();
  const {
    state,
    addCheck,
    updateCheck,
    removeCheck,
    setSelectedMetric,
    setEditingCheck,
  } = useWizard();

  const { checks, selectedMetric, editingCheck } = state;

  const handleCheckSave = (check: Check) => {
    if (editingCheck) {
      updateCheck(editingCheck.check_id, check);
    } else {
      addCheck(check);
    }
    setSelectedMetric(null);
  };

  const handleCheckCancel = () => {
    setEditingCheck(null);
    setSelectedMetric(null);
  };

  const handleEditCheck = (check: Check) => {
    setEditingCheck(check);
    setSelectedMetric(check.metric);
  };

  const handleAddNew = () => {
    setEditingCheck(null);
    // Keep current metric selected or reset
  };

  return (
    <div className={styles.container}>
      {/* Metric sidebar */}
      <MetricSidebar
        selectedMetric={selectedMetric}
        onSelectMetric={(metric) => {
          setEditingCheck(null);
          setSelectedMetric(metric);
        }}
      />

      {/* Main content */}
      <div className={styles.content}>
        {/* Checks list */}
        <div className={styles.checksList}>
          <div className={styles.checksHeader}>
            <Text className={styles.checksTitle}>
              Checks ({checks.length})
            </Text>
            {checks.length > 0 && (
              <Button
                appearance="subtle"
                size="small"
                icon={<Add16Regular />}
                onClick={handleAddNew}
              >
                Add Another
              </Button>
            )}
          </div>

          {checks.length === 0 ? (
            <div className={styles.emptyChecks}>
              Select a check type from the sidebar to add your first check
            </div>
          ) : (
            checks.map(check => {
              const metricOption = getMetricOption(check.metric);
              return (
                <Card key={check.check_id} className={styles.checkCard} size="small">
                  <div className={styles.checkCardHeader}>
                    <div className={styles.checkInfo}>
                      <Badge appearance="outline" size="small">
                        {metricOption?.label || check.metric}
                      </Badge>
                      <Text>{check.check_name}</Text>
                      {check.column_name && (
                        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                          ({check.column_name})
                        </Text>
                      )}
                    </div>

                    <Menu>
                      <MenuTrigger disableButtonEnhancement>
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={<MoreHorizontal16Regular />}
                        />
                      </MenuTrigger>
                      <MenuPopover>
                        <MenuList>
                          <MenuItem
                            icon={<Edit16Regular />}
                            onClick={() => handleEditCheck(check)}
                          >
                            Edit
                          </MenuItem>
                          <MenuItem
                            icon={<Delete16Regular />}
                            onClick={() => removeCheck(check.check_id)}
                          >
                            Delete
                          </MenuItem>
                        </MenuList>
                      </MenuPopover>
                    </Menu>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Check form */}
        <div className={styles.formContainer}>
          {selectedMetric ? (
            <CheckForm
              metric={selectedMetric}
              check={editingCheck}
              onSave={handleCheckSave}
              onCancel={handleCheckCancel}
              sourceId={state.sourceId}
              schemaName={state.schemaName}
              tableName={state.tableName}
            />
          ) : (
            <div className={styles.noMetricSelected}>
              Select a check type from the sidebar
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChecksStep;
