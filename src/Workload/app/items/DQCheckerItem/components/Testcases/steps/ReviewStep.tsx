/**
 * ReviewStep - Wizard Step 3: Review and confirm
 *
 * Shows summary of testcase and all checks, plus generated Soda YAML preview.
 */

import React, { useMemo } from 'react';
import {
  makeStyles,
  tokens,
  Text,
  Badge,
  Divider,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Body1,
  Caption1,
} from '@fluentui/react-components';
import {
  Checkmark16Regular,
  Table16Regular,
  Database16Regular,
} from '@fluentui/react-icons';
import { useWizard } from '../WizardContext';
import { getMetricOption } from '../../../types/check.types';
import { generateSodaYaml } from '../../../services/sodaYamlGenerator';
import { useSources } from '../../../context';

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    overflowY: 'auto',
    height: '100%',
  },
  section: {
    marginBottom: tokens.spacingVerticalL,
  },
  sectionTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase400,
    marginBottom: tokens.spacingVerticalS,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  metadataGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalM,
  },
  metadataItem: {
    display: 'flex',
    flexDirection: 'column',
  },
  metadataLabel: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  metadataValue: {
    fontWeight: tokens.fontWeightSemibold,
  },
  yamlPreview: {
    fontFamily: 'monospace',
    fontSize: tokens.fontSizeBase200,
    backgroundColor: tokens.colorNeutralBackground3,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  checkCount: {
    marginLeft: tokens.spacingHorizontalS,
  },
  severityBadge: {
    textTransform: 'capitalize',
  },
});

export const ReviewStep: React.FC = () => {
  const styles = useStyles();
  const { state } = useWizard();
  const { sources } = useSources();

  const selectedSource = sources.find(s => s.source_id === state.sourceId);

  // Generate YAML preview
  const yamlPreview = useMemo(() => {
    if (state.checks.length === 0) return '# No checks configured';
    return generateSodaYaml(state.checks, state.schemaName, state.tableName);
  }, [state.checks, state.schemaName, state.tableName]);

  const getSeverityColor = (severity: string): 'danger' | 'warning' | 'important' | 'informative' => {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'important';
      default: return 'informative';
    }
  };

  return (
    <div className={styles.container}>
      {/* Testcase Summary */}
      <div className={styles.section}>
        <Text className={styles.sectionTitle}>
          <Database16Regular /> Testcase Summary
        </Text>

        <div className={styles.metadataGrid}>
          <div className={styles.metadataItem}>
            <Caption1 className={styles.metadataLabel}>Name</Caption1>
            <Body1 className={styles.metadataValue}>{state.testcaseName}</Body1>
          </div>
          <div className={styles.metadataItem}>
            <Caption1 className={styles.metadataLabel}>Source</Caption1>
            <Body1 className={styles.metadataValue}>{selectedSource?.source_name || '-'}</Body1>
          </div>
          <div className={styles.metadataItem}>
            <Caption1 className={styles.metadataLabel}>Schema</Caption1>
            <Body1 className={styles.metadataValue}>{state.schemaName}</Body1>
          </div>
          <div className={styles.metadataItem}>
            <Caption1 className={styles.metadataLabel}>Table</Caption1>
            <Body1 className={styles.metadataValue}>{state.tableName}</Body1>
          </div>
          {state.owner && (
            <div className={styles.metadataItem}>
              <Caption1 className={styles.metadataLabel}>Owner</Caption1>
              <Body1 className={styles.metadataValue}>{state.owner}</Body1>
            </div>
          )}
          {state.tags.length > 0 && (
            <div className={styles.metadataItem}>
              <Caption1 className={styles.metadataLabel}>Tags</Caption1>
              <Body1 className={styles.metadataValue}>{state.tags.join(', ')}</Body1>
            </div>
          )}
        </div>

        {state.description && (
          <div className={styles.metadataItem}>
            <Caption1 className={styles.metadataLabel}>Description</Caption1>
            <Body1>{state.description}</Body1>
          </div>
        )}
      </div>

      <Divider />

      {/* Checks Table */}
      <div className={styles.section}>
        <Text className={styles.sectionTitle}>
          <Checkmark16Regular /> Checks
          <Badge appearance="filled" color="brand" className={styles.checkCount}>
            {state.checks.length}
          </Badge>
        </Text>

        {state.checks.length === 0 ? (
          <Text style={{ color: tokens.colorNeutralForeground3 }}>
            No checks configured. Go back to add checks.
          </Text>
        ) : (
          <Table size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Metric</TableHeaderCell>
                <TableHeaderCell>Column</TableHeaderCell>
                <TableHeaderCell>Threshold</TableHeaderCell>
                <TableHeaderCell>Severity</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.checks.map(check => {
                const metricOption = getMetricOption(check.metric);
                return (
                  <TableRow key={check.check_id}>
                    <TableCell>{check.check_name}</TableCell>
                    <TableCell>
                      <Badge appearance="outline" size="small">
                        {metricOption?.label || check.metric}
                      </Badge>
                    </TableCell>
                    <TableCell>{check.column_name || '-'}</TableCell>
                    <TableCell>
                      {check.fail_comparison} {check.fail_threshold}
                    </TableCell>
                    <TableCell>
                      <Badge
                        appearance="tint"
                        color={getSeverityColor(check.severity)}
                        className={styles.severityBadge}
                      >
                        {check.severity}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Divider />

      {/* YAML Preview */}
      <div className={styles.section}>
        <Text className={styles.sectionTitle}>
          <Table16Regular /> Generated Soda YAML (Preview)
        </Text>
        <pre className={styles.yamlPreview}>{yamlPreview}</pre>
      </div>
    </div>
  );
};

export default ReviewStep;
