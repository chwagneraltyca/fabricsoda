/**
 * TestcaseForm Component
 *
 * Unified CRUD wizard form for testcases with embedded checks.
 * Supports creating/editing testcases and managing their checks in one form.
 *
 * Data Model:
 * - Testcase: Table scope container with schema.table reference
 * - Checks: 1:N embedded array of DQ checks (10-20 per testcase)
 *
 * Storage: Files/config/data/testcases/{uuid}.json
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Input,
  Textarea,
  Field,
  Switch,
  Spinner,
  Dropdown,
  Option,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Divider,
  Badge,
  Text,
  Tooltip,
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import {
  Dismiss24Regular,
  Dismiss16Regular,
  TableSimple24Regular,
  Checkmark24Regular,
  Add24Regular,
  Delete20Regular,
  ChevronDown20Regular,
  ChevronUp20Regular,
  Warning20Regular,
} from '@fluentui/react-icons';
import {
  Testcase,
  TestcaseInput,
  defaultTestcaseInput,
  Check,
  CheckInput,
  defaultCheckInput,
  MetricType,
  DQDimension,
  SeverityLevel,
  ComparisonOperator,
  metricTypeOptions,
  dimensionOptions,
  severityOptions,
} from '../../types';
import { Source } from '../../types';
import { useDebugLog } from '../../../../context';

// ============================================================================
// Styles
// ============================================================================

const useStyles = makeStyles({
  dialog: {
    maxWidth: '900px',
    width: '100%',
    maxHeight: '90vh',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
    marginLeft: `-${tokens.spacingHorizontalL}`,
    marginRight: `-${tokens.spacingHorizontalL}`,
    marginTop: `-${tokens.spacingVerticalL}`,
    marginBottom: tokens.spacingVerticalL,
  },

  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },

  headerIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },

  title: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
    margin: 0,
    lineHeight: tokens.lineHeightHero700,
  },

  closeButton: {
    color: tokens.colorNeutralForeground3,
    transition: 'color 0.15s ease-out, background-color 0.15s ease-out',
    '&:hover': {
      color: tokens.colorNeutralForeground1,
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },

  scrollContent: {
    overflowY: 'auto',
    maxHeight: 'calc(90vh - 200px)',
    ...shorthands.padding(0, tokens.spacingHorizontalXS),
  },

  section: {
    marginBottom: tokens.spacingVerticalL,
  },

  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalM,
  },

  sectionIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    backgroundColor: tokens.colorNeutralBackground4,
    color: tokens.colorNeutralForeground2,
    fontSize: '16px',
  },

  sectionTitle: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    margin: 0,
  },

  sectionActions: {
    marginLeft: 'auto',
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: tokens.spacingHorizontalL,
  },

  formGridThree: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: tokens.spacingHorizontalM,
  },

  fullWidth: {
    gridColumn: 'span 2',
  },

  fullWidthThree: {
    gridColumn: 'span 3',
  },

  fieldLabel: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },

  required: {
    color: tokens.colorPaletteRedForeground1,
    marginLeft: '2px',
  },

  input: {
    backgroundColor: tokens.colorNeutralBackground2,
    '&:focus-within': {
      backgroundColor: tokens.colorNeutralBackground1,
    },
  },

  tagsInput: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: tokens.spacingHorizontalXS,
    alignItems: 'center',
    ...shorthands.padding(tokens.spacingVerticalXS),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
  },

  tag: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
  },

  tagInput: {
    flexGrow: 1,
    minWidth: '100px',
    ...shorthands.border('none'),
    backgroundColor: 'transparent',
    ...shorthands.outline('none'),
  },

  switchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    ...shorthands.padding(tokens.spacingVerticalS, 0),
  },

  switchLabel: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
  },

  divider: {
    marginTop: tokens.spacingVerticalL,
    marginBottom: tokens.spacingVerticalL,
  },

  // Checks section
  checksContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },

  checkCard: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
  },

  checkCardExpanded: {
    ...shorthands.border('1px', 'solid', tokens.colorBrandStroke1),
    backgroundColor: tokens.colorNeutralBackground1,
  },

  checkHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    cursor: 'pointer',
  },

  checkInfo: {
    flexGrow: 1,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },

  checkName: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },

  checkMeta: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },

  checkActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
  },

  checkForm: {
    marginTop: tokens.spacingVerticalM,
    ...shorthands.padding(tokens.spacingVerticalM, 0),
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke2),
  },

  emptyChecks: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.padding(tokens.spacingVerticalXL),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'dashed', tokens.colorNeutralStroke1),
    color: tokens.colorNeutralForeground3,
  },

  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalXL,
    paddingTop: tokens.spacingVerticalM,
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke2),
    backgroundColor: tokens.colorNeutralBackground2,
    marginLeft: `-${tokens.spacingHorizontalL}`,
    marginRight: `-${tokens.spacingHorizontalL}`,
    marginBottom: `-${tokens.spacingVerticalL}`,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
  },

  statusBanner: {
    marginBottom: tokens.spacingVerticalM,
  },

  severityCritical: {
    backgroundColor: tokens.colorPaletteRedBackground2,
    color: tokens.colorPaletteRedForeground2,
  },

  severityHigh: {
    backgroundColor: tokens.colorPaletteDarkOrangeBackground2,
    color: tokens.colorPaletteDarkOrangeForeground2,
  },

  severityMedium: {
    backgroundColor: tokens.colorPaletteYellowBackground2,
    color: tokens.colorPaletteYellowForeground2,
  },

  severityLow: {
    backgroundColor: tokens.colorNeutralBackground4,
    color: tokens.colorNeutralForeground2,
  },
});

// ============================================================================
// Types
// ============================================================================

interface TestcaseFormProps {
  /** Testcase to edit (null/undefined for create mode) */
  testcase?: Testcase | null;
  /** Available data sources for dropdown */
  sources: Source[];
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog closes */
  onClose: () => void;
  /** Callback when form is submitted successfully */
  onSubmit: (data: TestcaseInput, testcaseId?: string) => Promise<void>;
}

interface CheckFormState extends CheckInput {
  check_id?: string; // Present when editing existing check
}

// Comparison operator options
const comparisonOptions: { value: ComparisonOperator; label: string }[] = [
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: '=', label: '=' },
  { value: '!=', label: '!=' },
];

// ============================================================================
// Component
// ============================================================================

export const TestcaseForm: React.FC<TestcaseFormProps> = ({
  testcase,
  sources,
  open,
  onClose,
  onSubmit,
}) => {
  const styles = useStyles();
  const log = useDebugLog('TestcaseForm');
  const isEditing = !!testcase;

  // ========== Form State ==========

  const [formData, setFormData] = useState<TestcaseInput>(() =>
    testcase
      ? {
          testcase_name: testcase.testcase_name,
          source_id: testcase.source_id,
          schema_name: testcase.schema_name,
          table_name: testcase.table_name,
          description: testcase.description || '',
          owner: testcase.owner || '',
          tags: testcase.tags || [],
          is_active: testcase.is_active,
        }
      : { ...defaultTestcaseInput }
  );

  // Checks state (embedded in form)
  const [checks, setChecks] = useState<Check[]>(() =>
    testcase?.checks || []
  );

  // Expanded check (for editing)
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null);

  // New check being added
  const [isAddingCheck, setIsAddingCheck] = useState(false);
  const [newCheckForm, setNewCheckForm] = useState<CheckFormState>({ ...defaultCheckInput });

  // Tags input
  const [tagInput, setTagInput] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ========== Reset Form on Open ==========

  React.useEffect(() => {
    if (open) {
      if (testcase) {
        setFormData({
          testcase_name: testcase.testcase_name,
          source_id: testcase.source_id,
          schema_name: testcase.schema_name,
          table_name: testcase.table_name,
          description: testcase.description || '',
          owner: testcase.owner || '',
          tags: testcase.tags || [],
          is_active: testcase.is_active,
        });
        setChecks(testcase.checks || []);
      } else {
        setFormData({ ...defaultTestcaseInput });
        setChecks([]);
      }
      setErrors({});
      setExpandedCheckId(null);
      setIsAddingCheck(false);
      setNewCheckForm({ ...defaultCheckInput });
      setTagInput('');
    }
  }, [open, testcase]);

  // ========== Handlers ==========

  const handleChange = useCallback(
    (field: keyof TestcaseInput, value: string | boolean | string[]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear error for this field
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors]
  );

  // Tag management
  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim();
    if (tag && !formData.tags?.includes(tag)) {
      handleChange('tags', [...(formData.tags || []), tag]);
      setTagInput('');
    }
  }, [tagInput, formData.tags, handleChange]);

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      handleChange('tags', (formData.tags || []).filter((t) => t !== tagToRemove));
    },
    [formData.tags, handleChange]
  );

  const handleTagInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag]
  );

  // ========== Check Handlers ==========

  const generateCheckId = () => `chk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const handleAddCheckStart = useCallback(() => {
    setIsAddingCheck(true);
    setNewCheckForm({ ...defaultCheckInput });
    setExpandedCheckId(null);
  }, []);

  const handleAddCheckCancel = useCallback(() => {
    setIsAddingCheck(false);
    setNewCheckForm({ ...defaultCheckInput });
  }, []);

  const handleAddCheckSave = useCallback(() => {
    if (!newCheckForm.check_name.trim()) {
      setErrors((prev) => ({ ...prev, new_check_name: 'Check name is required' }));
      return;
    }

    const newCheck: Check = {
      check_id: generateCheckId(),
      check_name: newCheckForm.check_name.trim(),
      column_name: newCheckForm.column_name?.trim() || undefined,
      metric: newCheckForm.metric || 'row_count',
      config: newCheckForm.config || {},
      fail_comparison: newCheckForm.fail_comparison,
      fail_threshold: newCheckForm.fail_threshold,
      warn_comparison: newCheckForm.warn_comparison,
      warn_threshold: newCheckForm.warn_threshold,
      filter_condition: newCheckForm.filter_condition?.trim() || undefined,
      dimension: newCheckForm.dimension || 'completeness',
      severity: newCheckForm.severity || 'medium',
      owner: newCheckForm.owner?.trim() || undefined,
      tags: newCheckForm.tags || [],
      is_enabled: newCheckForm.is_enabled !== false,
    };

    setChecks((prev) => [...prev, newCheck]);
    setIsAddingCheck(false);
    setNewCheckForm({ ...defaultCheckInput });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.new_check_name;
      return next;
    });
    log.info('Check added', { checkId: newCheck.check_id, checkName: newCheck.check_name });
  }, [newCheckForm, log]);

  const handleCheckToggle = useCallback((checkId: string) => {
    setExpandedCheckId((prev) => (prev === checkId ? null : checkId));
    setIsAddingCheck(false);
  }, []);

  const handleCheckUpdate = useCallback(
    (checkId: string, updates: Partial<Check>) => {
      setChecks((prev) =>
        prev.map((c) => (c.check_id === checkId ? { ...c, ...updates } : c))
      );
      log.info('Check updated', { checkId, updates: Object.keys(updates) });
    },
    [log]
  );

  const handleCheckDelete = useCallback(
    (checkId: string) => {
      setChecks((prev) => prev.filter((c) => c.check_id !== checkId));
      if (expandedCheckId === checkId) {
        setExpandedCheckId(null);
      }
      log.info('Check deleted', { checkId });
    },
    [expandedCheckId, log]
  );

  const handleCheckToggleEnabled = useCallback(
    (checkId: string) => {
      setChecks((prev) =>
        prev.map((c) =>
          c.check_id === checkId ? { ...c, is_enabled: !c.is_enabled } : c
        )
      );
    },
    []
  );

  // ========== Validation ==========

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // Testcase name validation
    const name = formData.testcase_name.trim();
    if (!name) {
      newErrors.testcase_name = 'Testcase name is required';
    } else if (name.length < 2) {
      newErrors.testcase_name = 'Testcase name must be at least 2 characters';
    }

    // Source validation
    if (!formData.source_id) {
      newErrors.source_id = 'Data source is required';
    }

    // Schema name validation
    const schema = formData.schema_name.trim();
    if (!schema) {
      newErrors.schema_name = 'Schema name is required';
    }

    // Table name validation
    const table = formData.table_name.trim();
    if (!table) {
      newErrors.table_name = 'Table name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // ========== Submit ==========

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validate()) {
        return;
      }

      setIsSubmitting(true);
      log.info('Submitting testcase form', {
        isEditing,
        testcaseName: formData.testcase_name,
        checkCount: checks.length,
      });

      try {
        // Include checks in the input
        const input: TestcaseInput = {
          ...formData,
          checks: checks.map((c) => ({
            check_name: c.check_name,
            column_name: c.column_name,
            metric: c.metric,
            config: c.config,
            fail_comparison: c.fail_comparison,
            fail_threshold: c.fail_threshold,
            warn_comparison: c.warn_comparison,
            warn_threshold: c.warn_threshold,
            filter_condition: c.filter_condition,
            dimension: c.dimension,
            severity: c.severity,
            owner: c.owner,
            tags: c.tags,
            is_enabled: c.is_enabled,
          })),
        };

        await onSubmit(input, testcase?.testcase_id);
        log.info('Testcase form submitted successfully');
        onClose();
      } catch (error) {
        log.error('Testcase form submission error', {
          error: error instanceof Error ? error.message : String(error),
        });
        setErrors({
          _form: error instanceof Error ? error.message : 'An error occurred',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, checks, testcase, validate, onSubmit, onClose, log, isEditing]
  );

  // ========== Computed Values ==========

  const selectedSource = useMemo(
    () => sources.find((s) => s.source_id === formData.source_id),
    [sources, formData.source_id]
  );

  const enabledCheckCount = useMemo(
    () => checks.filter((c) => c.is_enabled).length,
    [checks]
  );

  // ========== Render Helpers ==========

  const getSeverityStyle = (severity: SeverityLevel) => {
    switch (severity) {
      case 'critical':
        return styles.severityCritical;
      case 'high':
        return styles.severityHigh;
      case 'medium':
        return styles.severityMedium;
      case 'low':
        return styles.severityLow;
      default:
        return undefined;
    }
  };

  const renderCheckForm = (
    check: CheckFormState,
    onChange: (updates: Partial<CheckFormState>) => void,
    isNew: boolean = false
  ) => {
    const selectedMetric = metricTypeOptions.find((m) => m.value === check.metric);
    const showColumnField = selectedMetric?.hasColumn ?? false;

    return (
      <div className={styles.checkForm}>
        <div className={styles.formGridThree}>
          {/* Check Name */}
          <Field
            label={
              <>
                <span className={styles.fieldLabel}>Check Name</span>
                <span className={styles.required}>*</span>
              </>
            }
            validationState={isNew && errors.new_check_name ? 'error' : undefined}
            validationMessage={isNew ? errors.new_check_name : undefined}
          >
            <Input
              value={check.check_name}
              onChange={(_, data) => onChange({ check_name: data.value })}
              placeholder="e.g., Not null check"
              disabled={isSubmitting}
              className={styles.input}
              appearance="filled-darker"
            />
          </Field>

          {/* Metric Type */}
          <Field
            label={
              <>
                <span className={styles.fieldLabel}>Metric Type</span>
                <span className={styles.required}>*</span>
              </>
            }
          >
            <Dropdown
              value={selectedMetric?.label || ''}
              selectedOptions={[check.metric || 'row_count']}
              onOptionSelect={(_, data) => onChange({ metric: data.optionValue as MetricType })}
              disabled={isSubmitting}
              appearance="filled-darker"
            >
              {metricTypeOptions.map((option) => (
                <Option key={option.value} value={option.value} text={option.label}>
                  <div>
                    <div>{option.label}</div>
                    <div
                      style={{
                        fontSize: tokens.fontSizeBase200,
                        color: tokens.colorNeutralForeground3,
                      }}
                    >
                      {option.description}
                    </div>
                  </div>
                </Option>
              ))}
            </Dropdown>
          </Field>

          {/* Column Name (conditional) */}
          {showColumnField && (
            <Field label={<span className={styles.fieldLabel}>Column Name</span>}>
              <Input
                value={check.column_name || ''}
                onChange={(_, data) => onChange({ column_name: data.value })}
                placeholder="e.g., customer_id"
                disabled={isSubmitting}
                className={styles.input}
                appearance="filled-darker"
              />
            </Field>
          )}
          {!showColumnField && <div />}

          {/* Fail Threshold */}
          <Field label={<span className={styles.fieldLabel}>Fail Comparison</span>}>
            <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
              <Dropdown
                value={check.fail_comparison || '>'}
                selectedOptions={[check.fail_comparison || '>']}
                onOptionSelect={(_, data) =>
                  onChange({ fail_comparison: data.optionValue as ComparisonOperator })
                }
                disabled={isSubmitting}
                appearance="filled-darker"
                style={{ width: '80px' }}
              >
                {comparisonOptions.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Dropdown>
              <Input
                type="number"
                value={check.fail_threshold?.toString() || '0'}
                onChange={(_, data) =>
                  onChange({ fail_threshold: parseFloat(data.value) || 0 })
                }
                disabled={isSubmitting}
                className={styles.input}
                appearance="filled-darker"
                style={{ flexGrow: 1 }}
              />
            </div>
          </Field>

          {/* Warn Threshold */}
          <Field label={<span className={styles.fieldLabel}>Warn Comparison</span>}>
            <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
              <Dropdown
                value={check.warn_comparison || '>'}
                selectedOptions={[check.warn_comparison || '>']}
                onOptionSelect={(_, data) =>
                  onChange({ warn_comparison: data.optionValue as ComparisonOperator })
                }
                disabled={isSubmitting}
                appearance="filled-darker"
                style={{ width: '80px' }}
              >
                {comparisonOptions.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Dropdown>
              <Input
                type="number"
                value={check.warn_threshold?.toString() || ''}
                onChange={(_, data) =>
                  onChange({
                    warn_threshold: data.value ? parseFloat(data.value) : undefined,
                  })
                }
                disabled={isSubmitting}
                className={styles.input}
                appearance="filled-darker"
                placeholder="Optional"
                style={{ flexGrow: 1 }}
              />
            </div>
          </Field>

          {/* Dimension */}
          <Field label={<span className={styles.fieldLabel}>Dimension</span>}>
            <Dropdown
              value={dimensionOptions.find((d) => d.value === check.dimension)?.label || ''}
              selectedOptions={[check.dimension || 'completeness']}
              onOptionSelect={(_, data) =>
                onChange({ dimension: data.optionValue as DQDimension })
              }
              disabled={isSubmitting}
              appearance="filled-darker"
            >
              {dimensionOptions.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Dropdown>
          </Field>

          {/* Severity */}
          <Field label={<span className={styles.fieldLabel}>Severity</span>}>
            <Dropdown
              value={severityOptions.find((s) => s.value === check.severity)?.label || ''}
              selectedOptions={[check.severity || 'medium']}
              onOptionSelect={(_, data) =>
                onChange({ severity: data.optionValue as SeverityLevel })
              }
              disabled={isSubmitting}
              appearance="filled-darker"
            >
              {severityOptions.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Dropdown>
          </Field>

          {/* Filter Condition */}
          <Field
            label={<span className={styles.fieldLabel}>Filter Condition</span>}
            className={styles.fullWidthThree}
            hint="SQL WHERE clause (optional)"
          >
            <Input
              value={check.filter_condition || ''}
              onChange={(_, data) => onChange({ filter_condition: data.value })}
              placeholder="e.g., status = 'active'"
              disabled={isSubmitting}
              className={styles.input}
              appearance="filled-darker"
            />
          </Field>

          {/* Enabled */}
          <div className={styles.switchRow}>
            <Switch
              checked={check.is_enabled !== false}
              onChange={(_, data) => onChange({ is_enabled: data.checked })}
              disabled={isSubmitting}
            />
            <span className={styles.switchLabel}>Enabled</span>
          </div>
        </div>

        {isNew && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: tokens.spacingHorizontalS,
              marginTop: tokens.spacingVerticalM,
            }}
          >
            <Button appearance="secondary" onClick={handleAddCheckCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button appearance="primary" onClick={handleAddCheckSave} disabled={isSubmitting}>
              Add Check
            </Button>
          </div>
        )}
      </div>
    );
  };

  // ========== Render ==========

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className={styles.dialog}>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <DialogTitle className={styles.header}>
              <div className={styles.headerContent}>
                <div className={styles.headerIcon}>
                  <TableSimple24Regular />
                </div>
                <span className={styles.title}>
                  {isEditing ? 'Edit Testcase' : 'New Testcase'}
                </span>
                {checks.length > 0 && (
                  <Badge appearance="filled" color="informative">
                    {enabledCheckCount}/{checks.length} checks
                  </Badge>
                )}
              </div>
              <Button
                appearance="subtle"
                icon={<Dismiss24Regular />}
                onClick={onClose}
                className={styles.closeButton}
              />
            </DialogTitle>

            <DialogContent className={styles.scrollContent}>
              {/* Form error */}
              {errors._form && (
                <MessageBar intent="error" className={styles.statusBanner}>
                  <MessageBarBody>
                    <MessageBarTitle>Error</MessageBarTitle>
                    {errors._form}
                  </MessageBarBody>
                </MessageBar>
              )}

              {/* Basic Info Section */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionIcon}>
                    <TableSimple24Regular />
                  </div>
                  <h3 className={styles.sectionTitle}>Table Information</h3>
                </div>
                <div className={styles.formGrid}>
                  {/* Testcase Name */}
                  <Field
                    label={
                      <>
                        <span className={styles.fieldLabel}>Testcase Name</span>
                        <span className={styles.required}>*</span>
                      </>
                    }
                    validationState={errors.testcase_name ? 'error' : undefined}
                    validationMessage={errors.testcase_name}
                  >
                    <Input
                      value={formData.testcase_name}
                      onChange={(_, data) => handleChange('testcase_name', data.value)}
                      placeholder="e.g., Orders Table Checks"
                      disabled={isSubmitting}
                      required
                      className={styles.input}
                      appearance="filled-darker"
                    />
                  </Field>

                  {/* Data Source */}
                  <Field
                    label={
                      <>
                        <span className={styles.fieldLabel}>Data Source</span>
                        <span className={styles.required}>*</span>
                      </>
                    }
                    validationState={errors.source_id ? 'error' : undefined}
                    validationMessage={errors.source_id}
                  >
                    <Dropdown
                      value={selectedSource?.source_name || ''}
                      selectedOptions={formData.source_id ? [formData.source_id] : []}
                      onOptionSelect={(_, data) =>
                        handleChange('source_id', data.optionValue as string)
                      }
                      disabled={isSubmitting}
                      appearance="filled-darker"
                      placeholder="Select a data source"
                    >
                      {sources
                        .filter((s) => s.is_active)
                        .map((source) => (
                          <Option
                            key={source.source_id}
                            value={source.source_id}
                            text={source.source_name}
                          >
                            <div>
                              <div>{source.source_name}</div>
                              <div
                                style={{
                                  fontSize: tokens.fontSizeBase200,
                                  color: tokens.colorNeutralForeground3,
                                }}
                              >
                                {source.database_name}
                              </div>
                            </div>
                          </Option>
                        ))}
                    </Dropdown>
                  </Field>

                  {/* Schema Name */}
                  <Field
                    label={
                      <>
                        <span className={styles.fieldLabel}>Schema Name</span>
                        <span className={styles.required}>*</span>
                      </>
                    }
                    validationState={errors.schema_name ? 'error' : undefined}
                    validationMessage={errors.schema_name}
                  >
                    <Input
                      value={formData.schema_name}
                      onChange={(_, data) => handleChange('schema_name', data.value)}
                      placeholder="e.g., dbo"
                      disabled={isSubmitting}
                      required
                      className={styles.input}
                      appearance="filled-darker"
                    />
                  </Field>

                  {/* Table Name */}
                  <Field
                    label={
                      <>
                        <span className={styles.fieldLabel}>Table Name</span>
                        <span className={styles.required}>*</span>
                      </>
                    }
                    validationState={errors.table_name ? 'error' : undefined}
                    validationMessage={errors.table_name}
                  >
                    <Input
                      value={formData.table_name}
                      onChange={(_, data) => handleChange('table_name', data.value)}
                      placeholder="e.g., orders"
                      disabled={isSubmitting}
                      required
                      className={styles.input}
                      appearance="filled-darker"
                    />
                  </Field>

                  {/* Description (full width) */}
                  <Field
                    label={<span className={styles.fieldLabel}>Description</span>}
                    className={styles.fullWidth}
                  >
                    <Textarea
                      value={formData.description || ''}
                      onChange={(_, data) => handleChange('description', data.value)}
                      placeholder="Optional description of this testcase"
                      rows={2}
                      disabled={isSubmitting}
                      className={styles.input}
                      appearance="filled-darker"
                    />
                  </Field>

                  {/* Owner */}
                  <Field label={<span className={styles.fieldLabel}>Owner</span>}>
                    <Input
                      value={formData.owner || ''}
                      onChange={(_, data) => handleChange('owner', data.value)}
                      placeholder="e.g., data-team@company.com"
                      disabled={isSubmitting}
                      className={styles.input}
                      appearance="filled-darker"
                    />
                  </Field>

                  {/* Tags */}
                  <Field label={<span className={styles.fieldLabel}>Tags</span>}>
                    <div className={styles.tagsInput}>
                      {(formData.tags || []).map((tag) => (
                        <Badge
                          key={tag}
                          appearance="filled"
                          color="informative"
                          className={styles.tag}
                        >
                          {tag}
                          <Button
                            appearance="transparent"
                            size="small"
                            icon={<Dismiss16Regular />}
                            onClick={() => handleRemoveTag(tag)}
                            disabled={isSubmitting}
                            style={{ minWidth: 'auto', padding: '2px' }}
                          />
                        </Badge>
                      ))}
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagInputKeyDown}
                        onBlur={handleAddTag}
                        placeholder={formData.tags?.length ? '' : 'Add tags...'}
                        disabled={isSubmitting}
                        className={styles.tagInput}
                      />
                    </div>
                  </Field>
                </div>

                {/* Active Status */}
                <div className={styles.switchRow}>
                  <Switch
                    checked={formData.is_active}
                    onChange={(_, data) => handleChange('is_active', data.checked)}
                    disabled={isSubmitting}
                  />
                  <span className={styles.switchLabel}>Active</span>
                </div>
              </div>

              <Divider className={styles.divider} />

              {/* Checks Section */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionIcon}>
                    <Checkmark24Regular />
                  </div>
                  <h3 className={styles.sectionTitle}>
                    Quality Checks ({checks.length})
                  </h3>
                  <div className={styles.sectionActions}>
                    <Button
                      appearance="primary"
                      size="small"
                      icon={<Add24Regular />}
                      onClick={handleAddCheckStart}
                      disabled={isSubmitting || isAddingCheck}
                    >
                      Add Check
                    </Button>
                  </div>
                </div>

                <div className={styles.checksContainer}>
                  {/* New Check Form */}
                  {isAddingCheck && (
                    <div className={`${styles.checkCard} ${styles.checkCardExpanded}`}>
                      <div className={styles.checkHeader}>
                        <Text weight="semibold">New Check</Text>
                      </div>
                      {renderCheckForm(
                        newCheckForm,
                        (updates) => setNewCheckForm((prev) => ({ ...prev, ...updates })),
                        true
                      )}
                    </div>
                  )}

                  {/* Existing Checks */}
                  {checks.length === 0 && !isAddingCheck ? (
                    <div className={styles.emptyChecks}>
                      <Warning20Regular style={{ marginBottom: tokens.spacingVerticalS }} />
                      <Text>No checks defined yet</Text>
                      <Text size={200}>Click "Add Check" to create your first quality check</Text>
                    </div>
                  ) : (
                    checks.map((check) => {
                      const isExpanded = expandedCheckId === check.check_id;
                      const metricOption = metricTypeOptions.find((m) => m.value === check.metric);

                      return (
                        <div
                          key={check.check_id}
                          className={`${styles.checkCard} ${isExpanded ? styles.checkCardExpanded : ''}`}
                        >
                          <div
                            className={styles.checkHeader}
                            onClick={() => handleCheckToggle(check.check_id)}
                          >
                            {isExpanded ? (
                              <ChevronUp20Regular />
                            ) : (
                              <ChevronDown20Regular />
                            )}
                            <div className={styles.checkInfo}>
                              <span
                                className={styles.checkName}
                                style={{
                                  opacity: check.is_enabled ? 1 : 0.5,
                                  textDecoration: check.is_enabled ? 'none' : 'line-through',
                                }}
                              >
                                {check.check_name}
                              </span>
                              <div className={styles.checkMeta}>
                                <Badge appearance="outline" size="small">
                                  {metricOption?.label || check.metric}
                                </Badge>
                                {check.column_name && (
                                  <Badge appearance="outline" size="small" color="informative">
                                    {check.column_name}
                                  </Badge>
                                )}
                                <Badge
                                  appearance="filled"
                                  size="small"
                                  className={getSeverityStyle(check.severity)}
                                >
                                  {check.severity}
                                </Badge>
                              </div>
                            </div>
                            <div className={styles.checkActions}>
                              <Tooltip content={check.is_enabled ? 'Disable' : 'Enable'} relationship="label">
                                <Switch
                                  checked={check.is_enabled}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleCheckToggleEnabled(check.check_id);
                                  }}
                                  disabled={isSubmitting}
                                />
                              </Tooltip>
                              <Tooltip content="Delete check" relationship="label">
                                <Button
                                  appearance="subtle"
                                  size="small"
                                  icon={<Delete20Regular />}
                                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                    e.stopPropagation();
                                    handleCheckDelete(check.check_id);
                                  }}
                                  disabled={isSubmitting}
                                />
                              </Tooltip>
                            </div>
                          </div>

                          {isExpanded &&
                            renderCheckForm(check, (updates) =>
                              handleCheckUpdate(check.check_id, updates)
                            )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </DialogContent>

            <DialogActions className={styles.actions}>
              <Button appearance="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                type="submit"
                disabled={isSubmitting}
                icon={isSubmitting ? <Spinner size="tiny" /> : undefined}
              >
                {isSubmitting
                  ? isEditing
                    ? 'Updating...'
                    : 'Creating...'
                  : isEditing
                  ? 'Update Testcase'
                  : 'Create Testcase'}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
};

export default TestcaseForm;
