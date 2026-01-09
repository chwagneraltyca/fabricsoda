/**
 * ThresholdFields - Shared threshold configuration for all check types
 *
 * Renders fail/warn threshold inputs with comparison operator selection.
 * Used by CheckForm for all metric types.
 */

import React from 'react';
import {
  Field,
  Input,
  Dropdown,
  Option,
  makeStyles,
  tokens,
  Text,
} from '@fluentui/react-components';
import { ComparisonOperator } from '../../../types/check.types';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  thresholdRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },
  comparisonDropdown: {
    minWidth: '80px',
    maxWidth: '80px',
  },
  thresholdInput: {
    flex: 1,
    minWidth: '100px',
  },
  sectionLabel: {
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalXS,
  },
  warnSection: {
    opacity: 0.9,
  },
});

// Comparison operator options
const comparisonOptions: { value: ComparisonOperator; label: string }[] = [
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: '=', label: '=' },
  { value: '!=', label: '!=' },
  { value: 'between', label: 'between' },
];

export interface ThresholdFieldsProps {
  failComparison?: ComparisonOperator;
  failThreshold?: number;
  warnComparison?: ComparisonOperator;
  warnThreshold?: number;
  showWarn?: boolean;
  onFailComparisonChange: (value: ComparisonOperator) => void;
  onFailThresholdChange: (value: number | undefined) => void;
  onWarnComparisonChange?: (value: ComparisonOperator) => void;
  onWarnThresholdChange?: (value: number | undefined) => void;
  /** Optional: Customize threshold label (e.g., "hours" for freshness) */
  thresholdLabel?: string;
}

export const ThresholdFields: React.FC<ThresholdFieldsProps> = ({
  failComparison = '>',
  failThreshold,
  warnComparison = '>',
  warnThreshold,
  showWarn = true,
  onFailComparisonChange,
  onFailThresholdChange,
  onWarnComparisonChange,
  onWarnThresholdChange,
  thresholdLabel = 'Threshold',
}) => {
  const styles = useStyles();

  const handleFailThresholdChange = (_: unknown, data: { value: string }) => {
    const value = data.value === '' ? undefined : parseFloat(data.value);
    onFailThresholdChange(value);
  };

  const handleWarnThresholdChange = (_: unknown, data: { value: string }) => {
    const value = data.value === '' ? undefined : parseFloat(data.value);
    onWarnThresholdChange?.(value);
  };

  return (
    <div className={styles.container}>
      {/* Fail threshold */}
      <div>
        <Text className={styles.sectionLabel}>Fail when</Text>
        <div className={styles.thresholdRow}>
          <Dropdown
            className={styles.comparisonDropdown}
            value={failComparison}
            selectedOptions={[failComparison]}
            onOptionSelect={(_, data) => {
              if (data.optionValue) {
                onFailComparisonChange(data.optionValue as ComparisonOperator);
              }
            }}
          >
            {comparisonOptions.map(opt => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Dropdown>
          <Field className={styles.thresholdInput}>
            <Input
              type="number"
              value={failThreshold?.toString() ?? ''}
              onChange={handleFailThresholdChange}
              placeholder={thresholdLabel}
            />
          </Field>
        </div>
      </div>

      {/* Warn threshold (optional) */}
      {showWarn && (
        <div className={styles.warnSection}>
          <Text className={styles.sectionLabel}>Warn when</Text>
          <div className={styles.thresholdRow}>
            <Dropdown
              className={styles.comparisonDropdown}
              value={warnComparison}
              selectedOptions={[warnComparison]}
              onOptionSelect={(_, data) => {
                if (data.optionValue) {
                  onWarnComparisonChange?.(data.optionValue as ComparisonOperator);
                }
              }}
            >
              {comparisonOptions.map(opt => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Dropdown>
            <Field className={styles.thresholdInput}>
              <Input
                type="number"
                value={warnThreshold?.toString() ?? ''}
                onChange={handleWarnThresholdChange}
                placeholder={thresholdLabel}
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThresholdFields;
