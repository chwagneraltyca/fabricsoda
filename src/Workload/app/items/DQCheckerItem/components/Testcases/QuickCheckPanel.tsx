/**
 * QuickCheckPanel - Quick single-check creation
 *
 * Single-page form for creating a testcase with one check.
 * Uses MetricSidebar for metric selection and CheckForm for configuration.
 * Equivalent to Legacy "/checks/add" flow (~30 seconds to create).
 */

import React, { useState } from 'react';
import {
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Field,
  Input,
  Dropdown,
  Option,
  Button,
  makeStyles,
  tokens,
  Spinner,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { MetricSidebar } from './MetricSidebar';
import { CheckForm } from './forms/CheckForm';
import { MetricType, Check, getMetricOption } from '../../types/check.types';
import { TestcaseInput } from '../../types/testcase.types';
import { useSources } from '../../context';

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
  scopeSection: {
    padding: tokens.spacingVerticalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  scopeRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalS,
  },
  scopeField: {
    flex: 1,
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
});

export interface QuickCheckPanelProps {
  onSave: (testcase: TestcaseInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const QuickCheckPanel: React.FC<QuickCheckPanelProps> = ({
  onSave,
  onCancel,
  isLoading = false,
}) => {
  const styles = useStyles();
  const { sources } = useSources();

  // Scope state
  const [sourceId, setSourceId] = useState<string>('');
  const [schemaName, setSchemaName] = useState<string>('');
  const [tableName, setTableName] = useState<string>('');

  // Metric selection
  const [selectedMetric, setSelectedMetric] = useState<MetricType | null>(null);

  const selectedSource = sources.find(s => s.source_id === sourceId);

  const handleCheckSave = async (newCheck: Check) => {
    // Create testcase with single check
    const testcaseInput: TestcaseInput = {
      testcase_name: `${tableName} - ${newCheck.check_name}`,
      source_id: sourceId,
      schema_name: schemaName,
      table_name: tableName,
      description: `Quick check: ${getMetricOption(newCheck.metric)?.description || ''}`,
      checks: [newCheck],
      is_active: true,
    };

    await onSave(testcaseInput);
  };

  return (
    <>
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              aria-label="Close"
              icon={<Dismiss24Regular />}
              onClick={onCancel}
            />
          }
        >
          Quick Check
        </DrawerHeaderTitle>
      </DrawerHeader>

      <DrawerBody style={{ padding: 0, overflow: 'hidden' }}>
        <div className={styles.container}>
          {/* Metric sidebar */}
          <MetricSidebar
            selectedMetric={selectedMetric}
            onSelectMetric={setSelectedMetric}
          />

          {/* Main content */}
          <div className={styles.content}>
            {/* Scope section */}
            <div className={styles.scopeSection}>
              <div className={styles.scopeRow}>
                <Field label="Source" required className={styles.scopeField}>
                  <Dropdown
                    placeholder="Select source"
                    value={selectedSource?.source_name || ''}
                    selectedOptions={sourceId ? [sourceId] : []}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) {
                        setSourceId(data.optionValue);
                      }
                    }}
                  >
                    {sources.map(source => (
                      <Option key={source.source_id} value={source.source_id}>
                        {source.source_name}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              </div>

              <div className={styles.scopeRow}>
                <Field label="Schema" required className={styles.scopeField}>
                  <Input
                    value={schemaName}
                    onChange={(_, data) => setSchemaName(data.value)}
                    placeholder="e.g., dbo"
                  />
                </Field>
                <Field label="Table" required className={styles.scopeField}>
                  <Input
                    value={tableName}
                    onChange={(_, data) => setTableName(data.value)}
                    placeholder="e.g., customers"
                  />
                </Field>
              </div>
            </div>

            {/* Check form */}
            <div className={styles.formContainer}>
              {selectedMetric ? (
                <CheckForm
                  metric={selectedMetric}
                  check={null}
                  onSave={handleCheckSave}
                  onCancel={onCancel}
                  sourceId={sourceId}
                  schemaName={schemaName}
                  tableName={tableName}
                />
              ) : (
                <div className={styles.noMetricSelected}>
                  Select a check type from the sidebar
                </div>
              )}
            </div>
          </div>
        </div>

        {isLoading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.8)',
          }}>
            <Spinner label="Creating check..." />
          </div>
        )}
      </DrawerBody>
    </>
  );
};

export default QuickCheckPanel;
