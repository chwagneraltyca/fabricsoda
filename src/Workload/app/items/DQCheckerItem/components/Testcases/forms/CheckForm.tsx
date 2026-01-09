/**
 * CheckForm - Unified check configuration form
 *
 * Single form component used for ALL check types in both QuickCheckPanel and TestcaseWizard.
 * Dynamically renders metric-specific fields based on the selected metric type.
 */

import React, { useState, useEffect } from 'react';
import {
  Field,
  Input,
  Dropdown,
  Option,
  Button,
  makeStyles,
  tokens,
  Divider,
  Switch,
  Textarea,
} from '@fluentui/react-components';
import { Save16Regular, Dismiss16Regular } from '@fluentui/react-icons';
import {
  Check,
  CheckInput,
  MetricType,
  DQDimension,
  SeverityLevel,
  CheckConfig,
  FreshnessConfig,
  SchemaConfig,
  ReferenceConfig,
  ScalarConfig,
  CustomSqlConfig,
  getMetricOption,
  dimensionOptions,
  severityOptions,
  defaultCheckInput,
} from '../../../types/check.types';
import { ThresholdFields } from './ThresholdFields';
import { v4 as uuidv4 } from 'uuid';

const useStyles = makeStyles({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
  },
  row: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
  },
  field: {
    flex: 1,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalM,
  },
  sectionTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    marginTop: tokens.spacingVerticalS,
  },
  configSection: {
    backgroundColor: tokens.colorNeutralBackground3,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
  },
});

export interface CheckFormProps {
  metric: MetricType;
  check?: Check | null;  // null = new check, object = edit existing
  onSave: (check: Check) => void;
  onCancel?: () => void;
  /** Source context for column dropdown */
  sourceId?: string;
  schemaName?: string;
  tableName?: string;
}

export const CheckForm: React.FC<CheckFormProps> = ({
  metric,
  check,
  onSave,
  onCancel,
  // sourceId, schemaName, tableName reserved for future column dropdown
}) => {
  const styles = useStyles();
  const metricOption = getMetricOption(metric);

  // Form state
  const [formData, setFormData] = useState<CheckInput>(() => {
    if (check) {
      return { ...check };
    }
    return {
      ...defaultCheckInput,
      metric,
      check_name: metricOption?.label || metric,
    };
  });

  // Validity type state (for invalid_count/invalid_percent metrics)
  const [validityType, setValidityType] = useState<'format' | 'values' | 'regex'>(() => {
    const filterCondition = formData.filter_condition || '';
    if (filterCondition.startsWith('valid format:')) return 'format';
    if (filterCondition.startsWith('valid values:')) return 'values';
    if (filterCondition.startsWith('valid regex:')) return 'regex';
    return 'format';
  });

  // Update metric when prop changes
  useEffect(() => {
    if (!check) {
      setFormData(prev => ({
        ...prev,
        metric,
        check_name: metricOption?.label || metric,
        column_name: metricOption?.hasColumn ? prev.column_name : undefined,
      }));
    }
  }, [metric, check, metricOption]);

  const updateField = <K extends keyof CheckInput>(field: K, value: CheckInput[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateConfig = <T extends CheckConfig>(updates: Partial<T>) => {
    setFormData(prev => ({
      ...prev,
      config: { ...(prev.config || {}), ...updates } as T,
    }));
  };

  const handleSave = () => {
    const newCheck: Check = {
      check_id: check?.check_id || `chk-${uuidv4()}`,
      check_name: formData.check_name || metricOption?.label || metric,
      column_name: metricOption?.hasColumn ? formData.column_name : undefined,
      metric: formData.metric,
      config: formData.config || {},
      fail_comparison: formData.fail_comparison,
      fail_threshold: formData.fail_threshold,
      warn_comparison: formData.warn_comparison,
      warn_threshold: formData.warn_threshold,
      filter_condition: formData.filter_condition,
      dimension: formData.dimension || 'completeness',
      severity: formData.severity || 'medium',
      owner: formData.owner,
      tags: formData.tags,
      is_enabled: formData.is_enabled ?? true,
    };
    onSave(newCheck);
  };

  // Render metric-specific config section
  const renderConfigSection = () => {
    switch (metric) {
      case 'freshness':
        return renderFreshnessConfig();
      case 'schema':
        return renderSchemaConfig();
      case 'custom_sql':
        return renderCustomSqlConfig();
      case 'scalar_comparison':
        return renderScalarConfig();
      case 'reference':
        return renderReferenceConfig();
      case 'invalid_count':
      case 'invalid_percent':
        return renderValidityConfig();
      case 'missing_count':
      case 'missing_percent':
        return renderMissingConfig();
      default:
        return null;
    }
  };

  // Freshness config
  const renderFreshnessConfig = () => {
    const config = (formData.config || {}) as Partial<FreshnessConfig>;
    return (
      <div className={styles.configSection}>
        <Field label="Timestamp Column" required>
          <Input
            value={config.freshness_column || ''}
            onChange={(_, data) => updateConfig<FreshnessConfig>({ freshness_column: data.value })}
            placeholder="e.g., updated_at"
          />
        </Field>
        <div className={styles.row}>
          <Field label="Max Age" className={styles.field}>
            <Input
              type="number"
              value={config.threshold_value?.toString() || ''}
              onChange={(_, data) =>
                updateConfig<FreshnessConfig>({
                  threshold_value: data.value ? parseInt(data.value) : undefined,
                })
              }
              placeholder="e.g., 24"
            />
          </Field>
          <Field label="Unit" className={styles.field}>
            <Dropdown
              value={config.threshold_unit || 'hours'}
              selectedOptions={[config.threshold_unit || 'hours']}
              onOptionSelect={(_, data) =>
                updateConfig<FreshnessConfig>({
                  threshold_unit: data.optionValue as 'minutes' | 'hours' | 'days',
                })
              }
            >
              <Option value="minutes">Minutes</Option>
              <Option value="hours">Hours</Option>
              <Option value="days">Days</Option>
            </Dropdown>
          </Field>
        </div>
      </div>
    );
  };

  // Schema config
  const renderSchemaConfig = () => {
    const config = (formData.config || {}) as Partial<SchemaConfig>;
    return (
      <div className={styles.configSection}>
        <Field label="Required Columns" hint="Comma-separated list">
          <Input
            value={config.required_columns?.join(', ') || ''}
            onChange={(_, data) =>
              updateConfig<SchemaConfig>({
                required_columns: data.value
                  ? data.value.split(',').map(s => s.trim()).filter(Boolean)
                  : [],
              })
            }
            placeholder="e.g., id, created_at, status"
          />
        </Field>
        <Field label="Forbidden Columns" hint="Comma-separated list">
          <Input
            value={config.forbidden_columns?.join(', ') || ''}
            onChange={(_, data) =>
              updateConfig<SchemaConfig>({
                forbidden_columns: data.value
                  ? data.value.split(',').map(s => s.trim()).filter(Boolean)
                  : [],
              })
            }
            placeholder="e.g., password, ssn"
          />
        </Field>
      </div>
    );
  };

  // Custom SQL config
  const renderCustomSqlConfig = () => {
    const config = (formData.config || {}) as Partial<CustomSqlConfig>;
    return (
      <div className={styles.configSection}>
        <Field label="SQL Query" required hint="Query should return a single numeric value">
          <Textarea
            value={config.custom_sql_query || ''}
            onChange={(_, data) =>
              updateConfig<CustomSqlConfig>({ custom_sql_query: data.value })
            }
            placeholder="SELECT COUNT(*) FROM ..."
            rows={4}
          />
        </Field>
      </div>
    );
  };

  // Scalar comparison config
  const renderScalarConfig = () => {
    const config = (formData.config || {}) as Partial<ScalarConfig>;
    return (
      <div className={styles.configSection}>
        <Field label="Query A" required>
          <Textarea
            value={config.query_a || ''}
            onChange={(_, data) => updateConfig<ScalarConfig>({ query_a: data.value })}
            placeholder="SELECT COUNT(*) FROM source_table"
            rows={3}
          />
        </Field>
        <Field label="Query B" required>
          <Textarea
            value={config.query_b || ''}
            onChange={(_, data) => updateConfig<ScalarConfig>({ query_b: data.value })}
            placeholder="SELECT COUNT(*) FROM target_table"
            rows={3}
          />
        </Field>
        <div className={styles.row}>
          <Field label="Tolerance %" className={styles.field}>
            <Input
              type="number"
              value={config.tolerance_value?.toString() || ''}
              onChange={(_, data) =>
                updateConfig<ScalarConfig>({
                  tolerance_value: data.value ? parseFloat(data.value) : undefined,
                  tolerance_type: 'percent',
                })
              }
              placeholder="e.g., 1"
            />
          </Field>
        </div>
      </div>
    );
  };

  // Reference (FK) config
  const renderReferenceConfig = () => {
    const config = (formData.config || {}) as Partial<ReferenceConfig>;
    return (
      <div className={styles.configSection}>
        <Field label="Reference Table" required>
          <Input
            value={config.reference_table || ''}
            onChange={(_, data) =>
              updateConfig<ReferenceConfig>({ reference_table: data.value })
            }
            placeholder="e.g., customers"
          />
        </Field>
        <Field label="Reference Column" required>
          <Input
            value={config.reference_column || ''}
            onChange={(_, data) =>
              updateConfig<ReferenceConfig>({ reference_column: data.value })
            }
            placeholder="e.g., id"
          />
        </Field>
      </div>
    );
  };

  // Validity rule config (for invalid_count)
  const renderValidityConfig = () => {
    // filter_condition can be: "valid format: email", "valid values: [...]", "valid regex: pattern"
    const filterCondition = formData.filter_condition || '';

    const formatOptions = ['email', 'uuid', 'phone_number', 'ip_address', 'date', 'credit_card'];

    const getFilterValue = () => {
      if (filterCondition.startsWith('valid format:')) {
        return filterCondition.replace('valid format:', '').trim();
      }
      if (filterCondition.startsWith('valid values:')) {
        return filterCondition.replace('valid values:', '').trim();
      }
      if (filterCondition.startsWith('valid regex:')) {
        return filterCondition.replace('valid regex:', '').trim();
      }
      return '';
    };

    const updateValidityRule = (type: 'format' | 'values' | 'regex', value: string) => {
      const prefix = type === 'format' ? 'valid format:' : type === 'values' ? 'valid values:' : 'valid regex:';
      updateField('filter_condition', `${prefix} ${value}`);
    };

    return (
      <div className={styles.configSection}>
        <Field label="Validation Type">
          <Dropdown
            value={validityType}
            selectedOptions={[validityType]}
            onOptionSelect={(_, data) => {
              const newType = data.optionValue as 'format' | 'values' | 'regex';
              setValidityType(newType);
              updateValidityRule(newType, '');
            }}
          >
            <Option value="format">Format</Option>
            <Option value="values">Value List</Option>
            <Option value="regex">Regex Pattern</Option>
          </Dropdown>
        </Field>

        {validityType === 'format' && (
          <Field label="Format Type">
            <Dropdown
              value={getFilterValue() || formatOptions[0]}
              selectedOptions={[getFilterValue() || formatOptions[0]]}
              onOptionSelect={(_, data) => {
                if (data.optionValue) {
                  updateValidityRule('format', data.optionValue);
                }
              }}
            >
              {formatOptions.map(f => (
                <Option key={f} value={f}>
                  {f}
                </Option>
              ))}
            </Dropdown>
          </Field>
        )}

        {validityType === 'values' && (
          <Field label="Valid Values" hint="Comma-separated list">
            <Input
              value={getFilterValue().replace(/[\[\]]/g, '')}
              onChange={(_, data) => {
                const values = data.value ? `[${data.value}]` : '';
                updateValidityRule('values', values);
              }}
              placeholder="e.g., active, pending, closed"
            />
          </Field>
        )}

        {validityType === 'regex' && (
          <Field label="Regex Pattern">
            <Input
              value={getFilterValue()}
              onChange={(_, data) => updateValidityRule('regex', data.value)}
              placeholder="e.g., ^[A-Z]{2}[0-9]{4}$"
            />
          </Field>
        )}
      </div>
    );
  };

  // Missing values config
  const renderMissingConfig = () => {
    return (
      <div className={styles.configSection}>
        <Field label="Additional Missing Values" hint="Comma-separated (e.g., N/A, NULL, -)">
          <Input
            value={formData.filter_condition || ''}
            onChange={(_, data) => updateField('filter_condition', data.value)}
            placeholder="N/A, NULL, -, empty"
          />
        </Field>
      </div>
    );
  };

  return (
    <div className={styles.form}>
      {/* Check name */}
      <Field label="Check Name" required>
        <Input
          value={formData.check_name || ''}
          onChange={(_, data) => updateField('check_name', data.value)}
          placeholder="Descriptive name for this check"
        />
      </Field>

      {/* Column field (if metric requires column) */}
      {metricOption?.hasColumn && (
        <Field label="Column" required>
          <Input
            value={formData.column_name || ''}
            onChange={(_, data) => updateField('column_name', data.value)}
            placeholder="Column name to check"
          />
        </Field>
      )}

      {/* Metric-specific config */}
      {renderConfigSection()}

      <Divider />

      {/* Thresholds */}
      <ThresholdFields
        failComparison={formData.fail_comparison}
        failThreshold={formData.fail_threshold}
        warnComparison={formData.warn_comparison}
        warnThreshold={formData.warn_threshold}
        onFailComparisonChange={(v) => updateField('fail_comparison', v)}
        onFailThresholdChange={(v) => updateField('fail_threshold', v)}
        onWarnComparisonChange={(v) => updateField('warn_comparison', v)}
        onWarnThresholdChange={(v) => updateField('warn_threshold', v)}
      />

      <Divider />

      {/* Metadata */}
      <div className={styles.row}>
        <Field label="Dimension" className={styles.field}>
          <Dropdown
            value={formData.dimension || 'completeness'}
            selectedOptions={[formData.dimension || 'completeness']}
            onOptionSelect={(_, data) => {
              if (data.optionValue) {
                updateField('dimension', data.optionValue as DQDimension);
              }
            }}
          >
            {dimensionOptions.map(opt => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Severity" className={styles.field}>
          <Dropdown
            value={formData.severity || 'medium'}
            selectedOptions={[formData.severity || 'medium']}
            onOptionSelect={(_, data) => {
              if (data.optionValue) {
                updateField('severity', data.optionValue as SeverityLevel);
              }
            }}
          >
            {severityOptions.map(opt => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </div>

      {/* Enable/disable */}
      <Field>
        <Switch
          checked={formData.is_enabled ?? true}
          onChange={(_, data) => updateField('is_enabled', data.checked)}
          label="Enabled"
        />
      </Field>

      {/* Actions */}
      <div className={styles.actions}>
        {onCancel && (
          <Button appearance="secondary" icon={<Dismiss16Regular />} onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button appearance="primary" icon={<Save16Regular />} onClick={handleSave}>
          {check ? 'Update Check' : 'Add Check'}
        </Button>
      </div>
    </div>
  );
};

export default CheckForm;
