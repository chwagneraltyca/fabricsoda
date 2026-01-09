/**
 * DataSourceForm Component
 *
 * Form for creating/editing data sources with full connection fields.
 * Updated for OneLake JSON storage (Jan 2026).
 *
 * Fields:
 * - source_name (required)
 * - source_type (required) - fabric_warehouse, fabric_sqldb, spark_sql, azure_sql
 * - server_name (required) - Fabric SQL endpoint
 * - database_name (required) - Artifact/database name
 * - keyvault_uri (optional) - Per-source Key Vault URI
 * - client_id (optional) - Service Principal client ID
 * - secret_name (optional) - Key Vault secret name
 * - description (optional)
 * - is_active (required)
 */

import React, { useState, useCallback } from 'react';
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
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import {
  Dismiss24Regular,
  Database24Regular,
  Key24Regular,
  Server24Regular,
  PlugConnected24Regular,
} from '@fluentui/react-icons';
import {
  DataSource,
  DataSourceFormData,
  defaultDataSourceFormData,
  dataSourceValidation,
} from '../../types/dataSource.types';
import {
  SourceType,
  sourceTypeOptions,
  ConnectionStatus,
} from '../../types/source.types';
import { useDebugLog } from '../../../../context';

// Styles matching legacy design with Fabric UX improvements
const useStyles = makeStyles({
  dialog: {
    maxWidth: '720px',
    width: '100%',
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

  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: tokens.spacingHorizontalL,
  },

  fullWidth: {
    gridColumn: 'span 2',
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

  hint: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalXXS,
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

  testConnectionBtn: {
    marginRight: 'auto',
  },

  divider: {
    marginTop: tokens.spacingVerticalL,
    marginBottom: tokens.spacingVerticalL,
  },

  // Connection status banners
  statusBanner: {
    marginBottom: tokens.spacingVerticalM,
  },
});

interface DataSourceFormProps {
  /** Data source to edit (null for create mode) */
  dataSource?: DataSource | null;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog closes */
  onClose: () => void;
  /** Callback when form is submitted successfully */
  onSubmit: (data: DataSourceFormData, sourceId?: string) => Promise<void>;
  /** Optional callback for testing connection */
  onTestConnection?: (data: DataSourceFormData) => Promise<{ success: boolean; message: string }>;
}

export const DataSourceForm: React.FC<DataSourceFormProps> = ({
  dataSource,
  open,
  onClose,
  onSubmit,
  onTestConnection,
}) => {
  const styles = useStyles();
  const log = useDebugLog('DataSourceForm');
  const isEditing = !!dataSource;

  // Form state
  const [formData, setFormData] = useState<DataSourceFormData>(() =>
    dataSource
      ? {
          source_name: dataSource.source_name,
          source_type: dataSource.source_type,
          server_name: dataSource.server_name,
          database_name: dataSource.database_name,
          keyvault_uri: dataSource.keyvault_uri || '',
          client_id: dataSource.client_id || '',
          secret_name: dataSource.secret_name || '',
          description: dataSource.description || '',
          is_active: dataSource.is_active,
        }
      : { ...defaultDataSourceFormData }
  );

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Connection test state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionMessage, setConnectionMessage] = useState<string>('');

  // Reset form when dialog opens with new data
  React.useEffect(() => {
    if (open) {
      if (dataSource) {
        setFormData({
          source_name: dataSource.source_name,
          source_type: dataSource.source_type,
          server_name: dataSource.server_name,
          database_name: dataSource.database_name,
          keyvault_uri: dataSource.keyvault_uri || '',
          client_id: dataSource.client_id || '',
          secret_name: dataSource.secret_name || '',
          description: dataSource.description || '',
          is_active: dataSource.is_active,
        });
      } else {
        setFormData({ ...defaultDataSourceFormData });
      }
      setErrors({});
      setConnectionStatus('idle');
      setConnectionMessage('');
    }
  }, [open, dataSource]);

  // Handle field change
  const handleChange = useCallback(
    (field: keyof DataSourceFormData, value: string | boolean) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      // Clear error for this field
      if (errors[field]) {
        setErrors(prev => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
      // Reset connection status when connection fields change
      if (['server_name', 'database_name', 'keyvault_uri', 'client_id', 'secret_name'].includes(field)) {
        setConnectionStatus('idle');
        setConnectionMessage('');
      }
    },
    [errors]
  );

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // Source name validation
    const name = formData.source_name.trim();
    if (!name) {
      newErrors.source_name = 'Source name is required';
    } else if (name.length < dataSourceValidation.source_name.minLength) {
      newErrors.source_name = `Source name must be at least ${dataSourceValidation.source_name.minLength} character`;
    } else if (name.length > dataSourceValidation.source_name.maxLength) {
      newErrors.source_name = `Source name must be at most ${dataSourceValidation.source_name.maxLength} characters`;
    }

    // Server name validation
    const server = formData.server_name.trim();
    if (!server) {
      newErrors.server_name = 'Server name is required';
    } else if (server.length > dataSourceValidation.server_name.maxLength) {
      newErrors.server_name = `Server name must be at most ${dataSourceValidation.server_name.maxLength} characters`;
    }

    // Database name validation
    const database = formData.database_name.trim();
    if (!database) {
      newErrors.database_name = 'Database name is required';
    } else if (database.length > dataSourceValidation.database_name.maxLength) {
      newErrors.database_name = `Database name must be at most ${dataSourceValidation.database_name.maxLength} characters`;
    }

    // Key Vault URI validation (optional)
    if (formData.keyvault_uri && formData.keyvault_uri.trim()) {
      const kv = formData.keyvault_uri.trim();
      if (!dataSourceValidation.keyvault_uri.pattern?.test(kv)) {
        newErrors.keyvault_uri = dataSourceValidation.keyvault_uri.message || 'Invalid Key Vault URI';
      }
    }

    // Client ID validation (optional)
    if (formData.client_id && formData.client_id.trim()) {
      const clientId = formData.client_id.trim();
      if (!dataSourceValidation.client_id.pattern?.test(clientId)) {
        newErrors.client_id = dataSourceValidation.client_id.message || 'Invalid client ID format';
      }
    }

    // Description validation
    if (formData.description && formData.description.length > dataSourceValidation.description.maxLength) {
      newErrors.description = `Description must be at most ${dataSourceValidation.description.maxLength} characters`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle test connection
  const handleTestConnection = useCallback(async () => {
    if (!onTestConnection) return;

    // Validate required fields first
    const requiredErrors: Record<string, string> = {};
    if (!formData.server_name.trim()) {
      requiredErrors.server_name = 'Server name is required for testing';
    }
    if (!formData.database_name.trim()) {
      requiredErrors.database_name = 'Database name is required for testing';
    }

    if (Object.keys(requiredErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...requiredErrors }));
      return;
    }

    setConnectionStatus('checking');
    setConnectionMessage('Testing connection...');

    try {
      const result = await onTestConnection(formData);
      if (result.success) {
        setConnectionStatus('success');
        setConnectionMessage(result.message || 'Connection successful');
      } else {
        setConnectionStatus('error');
        setConnectionMessage(result.message || 'Connection failed');
      }
    } catch (error) {
      setConnectionStatus('error');
      setConnectionMessage(error instanceof Error ? error.message : 'Connection test failed');
    }
  }, [formData, onTestConnection]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validate()) {
        return;
      }

      setIsSubmitting(true);
      log.info('Submitting form', { isEditing, sourceName: formData.source_name });
      try {
        await onSubmit(formData, dataSource?.source_id);
        log.info('Form submitted successfully');
        onClose();
      } catch (error) {
        log.error('Form submission error', { error: error instanceof Error ? error.message : String(error) });
        setErrors({
          _form: error instanceof Error ? error.message : 'An error occurred',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, dataSource, validate, onSubmit, onClose, log, isEditing]
  );

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className={styles.dialog}>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <DialogTitle className={styles.header}>
              <div className={styles.headerContent}>
                <div className={styles.headerIcon}>
                  <PlugConnected24Regular />
                </div>
                <span className={styles.title}>
                  {isEditing ? 'Edit Connection' : 'Add Connection'}
                </span>
              </div>
              <Button
                appearance="subtle"
                icon={<Dismiss24Regular />}
                onClick={onClose}
                className={styles.closeButton}
              />
            </DialogTitle>

            <DialogContent>
              {/* Form error */}
              {errors._form && (
                <MessageBar intent="error" className={styles.statusBanner}>
                  <MessageBarBody>
                    <MessageBarTitle>Error</MessageBarTitle>
                    {errors._form}
                  </MessageBarBody>
                </MessageBar>
              )}

              {/* Connection status banner */}
              {connectionStatus === 'success' && (
                <MessageBar intent="success" className={styles.statusBanner}>
                  <MessageBarBody>
                    <MessageBarTitle>Connected</MessageBarTitle>
                    {connectionMessage}
                  </MessageBarBody>
                </MessageBar>
              )}
              {connectionStatus === 'error' && (
                <MessageBar intent="error" className={styles.statusBanner}>
                  <MessageBarBody>
                    <MessageBarTitle>Connection Failed</MessageBarTitle>
                    {connectionMessage}
                  </MessageBarBody>
                </MessageBar>
              )}
              {connectionStatus === 'checking' && (
                <MessageBar intent="info" className={styles.statusBanner}>
                  <MessageBarBody>
                    <Spinner size="tiny" style={{ marginRight: tokens.spacingHorizontalS }} />
                    {connectionMessage}
                  </MessageBarBody>
                </MessageBar>
              )}

              {/* Basic Info Section */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionIcon}>
                    <Database24Regular />
                  </div>
                  <h3 className={styles.sectionTitle}>Basic Information</h3>
                </div>
                <div className={styles.formGrid}>
                  {/* Source Name */}
                  <Field
                    label={
                      <>
                        <span className={styles.fieldLabel}>Source Name</span>
                        <span className={styles.required}>*</span>
                      </>
                    }
                    validationState={errors.source_name ? 'error' : undefined}
                    validationMessage={errors.source_name}
                  >
                    <Input
                      value={formData.source_name}
                      onChange={(_, data) => handleChange('source_name', data.value)}
                      placeholder="e.g., Production_DWH"
                      disabled={isSubmitting}
                      required
                      className={styles.input}
                      appearance="filled-darker"
                    />
                  </Field>

                  {/* Source Type */}
                  <Field
                    label={
                      <>
                        <span className={styles.fieldLabel}>Source Type</span>
                        <span className={styles.required}>*</span>
                      </>
                    }
                  >
                    <Dropdown
                      value={sourceTypeOptions.find(o => o.value === formData.source_type)?.label || ''}
                      selectedOptions={[formData.source_type]}
                      onOptionSelect={(_, data) => handleChange('source_type', data.optionValue as SourceType)}
                      disabled={isSubmitting}
                      appearance="filled-darker"
                    >
                      {sourceTypeOptions.map(option => (
                        <Option key={option.value} value={option.value} text={option.label}>
                          <div>
                            <div>{option.label}</div>
                            <div style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                              {option.description}
                            </div>
                          </div>
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>

                  {/* Description (full width) */}
                  <Field
                    label={<span className={styles.fieldLabel}>Description</span>}
                    validationState={errors.description ? 'error' : undefined}
                    validationMessage={errors.description}
                    className={styles.fullWidth}
                  >
                    <Textarea
                      value={formData.description || ''}
                      onChange={(_, data) => handleChange('description', data.value)}
                      placeholder="Optional description of this data source"
                      rows={2}
                      disabled={isSubmitting}
                      className={styles.input}
                      appearance="filled-darker"
                    />
                  </Field>
                </div>
              </div>

              <Divider className={styles.divider} />

              {/* Connection Section */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionIcon}>
                    <Server24Regular />
                  </div>
                  <h3 className={styles.sectionTitle}>Connection Details</h3>
                </div>
                <div className={styles.formGrid}>
                  {/* Server Name */}
                  <Field
                    label={
                      <>
                        <span className={styles.fieldLabel}>Server Name</span>
                        <span className={styles.required}>*</span>
                      </>
                    }
                    validationState={errors.server_name ? 'error' : undefined}
                    validationMessage={errors.server_name}
                    hint="Fabric SQL endpoint (e.g., xxx.datawarehouse.fabric.microsoft.com)"
                  >
                    <Input
                      value={formData.server_name}
                      onChange={(_, data) => handleChange('server_name', data.value)}
                      placeholder="xxx.datawarehouse.fabric.microsoft.com"
                      disabled={isSubmitting}
                      required
                      className={styles.input}
                      appearance="filled-darker"
                    />
                  </Field>

                  {/* Database Name */}
                  <Field
                    label={
                      <>
                        <span className={styles.fieldLabel}>Database Name</span>
                        <span className={styles.required}>*</span>
                      </>
                    }
                    validationState={errors.database_name ? 'error' : undefined}
                    validationMessage={errors.database_name}
                    hint="Fabric artifact or database name"
                  >
                    <Input
                      value={formData.database_name}
                      onChange={(_, data) => handleChange('database_name', data.value)}
                      placeholder="e.g., sample_dwh"
                      disabled={isSubmitting}
                      required
                      className={styles.input}
                      appearance="filled-darker"
                    />
                  </Field>
                </div>
              </div>

              <Divider className={styles.divider} />

              {/* Authentication Section */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionIcon}>
                    <Key24Regular />
                  </div>
                  <h3 className={styles.sectionTitle}>Authentication (Optional)</h3>
                </div>
                <div className={styles.formGrid}>
                  {/* Key Vault URI */}
                  <Field
                    label={<span className={styles.fieldLabel}>Key Vault URI</span>}
                    validationState={errors.keyvault_uri ? 'error' : undefined}
                    validationMessage={errors.keyvault_uri}
                    hint="For per-source Key Vault (leave blank to use default)"
                    className={styles.fullWidth}
                  >
                    <Input
                      value={formData.keyvault_uri || ''}
                      onChange={(_, data) => handleChange('keyvault_uri', data.value)}
                      placeholder="https://your-keyvault.vault.azure.net/"
                      disabled={isSubmitting}
                      className={styles.input}
                      appearance="filled-darker"
                    />
                  </Field>

                  {/* Client ID */}
                  <Field
                    label={<span className={styles.fieldLabel}>Client ID</span>}
                    validationState={errors.client_id ? 'error' : undefined}
                    validationMessage={errors.client_id}
                    hint="Service Principal client ID (GUID)"
                  >
                    <Input
                      value={formData.client_id || ''}
                      onChange={(_, data) => handleChange('client_id', data.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      disabled={isSubmitting}
                      className={styles.input}
                      appearance="filled-darker"
                    />
                  </Field>

                  {/* Secret Name */}
                  <Field
                    label={<span className={styles.fieldLabel}>Secret Name</span>}
                    validationState={errors.secret_name ? 'error' : undefined}
                    validationMessage={errors.secret_name}
                    hint="Key Vault secret name for SP client secret"
                  >
                    <Input
                      value={formData.secret_name || ''}
                      onChange={(_, data) => handleChange('secret_name', data.value)}
                      placeholder="e.g., dq-checker-spn-secret"
                      disabled={isSubmitting}
                      className={styles.input}
                      appearance="filled-darker"
                    />
                  </Field>
                </div>
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
            </DialogContent>

            <DialogActions className={styles.actions}>
              {onTestConnection && (
                <Button
                  appearance="secondary"
                  onClick={handleTestConnection}
                  disabled={isSubmitting || connectionStatus === 'checking'}
                  className={styles.testConnectionBtn}
                  icon={connectionStatus === 'checking' ? <Spinner size="tiny" /> : undefined}
                >
                  Test Connection
                </Button>
              )}
              <Button
                appearance="secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                type="submit"
                disabled={isSubmitting}
                icon={isSubmitting ? <Spinner size="tiny" /> : undefined}
              >
                {isSubmitting
                  ? isEditing ? 'Updating...' : 'Adding...'
                  : isEditing ? 'Update Connection' : 'Add Connection'}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
};
