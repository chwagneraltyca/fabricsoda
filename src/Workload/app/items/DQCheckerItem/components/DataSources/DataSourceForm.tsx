/**
 * DataSourceForm Component
 *
 * Form for creating/editing data sources.
 * Matches legacy Flask form styling using FluentUI v9 components.
 *
 * Legacy reference: Legacy/flask_app/templates/data_sources/manage.html (modal form)
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
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import {
  DataSource,
  DataSourceFormData,
  defaultDataSourceFormData,
  dataSourceValidation,
} from '../../types/dataSource.types';
import { dqTypography } from '../../../../styles/tokens';

// Styles matching legacy design with Fabric UX improvements
const useStyles = makeStyles({
  dialog: {
    maxWidth: '672px', // max-w-2xl
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

  title: {
    fontSize: dqTypography.fontSizeXl,
    fontWeight: dqTypography.fontWeightBold,
    color: tokens.colorNeutralForeground1,
    margin: 0,
  },

  closeButton: {
    color: tokens.colorNeutralForeground3,
    '&:hover': {
      color: tokens.colorNeutralForeground1,
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: tokens.spacingHorizontalL,
    marginTop: tokens.spacingVerticalS,
  },

  fullWidth: {
    gridColumn: 'span 2',
  },

  fieldLabel: {
    fontWeight: dqTypography.fontWeightMedium,
    fontSize: dqTypography.fontSizeSm,
    color: tokens.colorNeutralForeground2,
  },

  required: {
    color: tokens.colorPaletteRedForeground1,
    marginLeft: '2px',
  },

  // Input styling with background
  input: {
    backgroundColor: tokens.colorNeutralBackground2,
    '&:focus-within': {
      backgroundColor: tokens.colorNeutralBackground1,
    },
  },

  hint: {
    fontSize: dqTypography.fontSizeXs,
    color: tokens.colorNeutralForeground3,
    marginTop: '4px',
  },

  switchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    ...shorthands.padding(tokens.spacingVerticalS, 0),
  },

  switchLabel: {
    fontSize: dqTypography.fontSizeSm,
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

  errorMessage: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: dqTypography.fontSizeXs,
    marginTop: '4px',
  },

  formError: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    fontSize: dqTypography.fontSizeSm,
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
  onSubmit: (data: DataSourceFormData, sourceId?: number) => Promise<void>;
}

export const DataSourceForm: React.FC<DataSourceFormProps> = ({
  dataSource,
  open,
  onClose,
  onSubmit,
}) => {
  const styles = useStyles();
  const isEditing = !!dataSource;

  // Form state
  const [formData, setFormData] = useState<DataSourceFormData>(() =>
    dataSource
      ? {
          source_name: dataSource.source_name,
          description: dataSource.description || '',
          is_active: dataSource.is_active,
        }
      : { ...defaultDataSourceFormData }
  );

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens with new data
  React.useEffect(() => {
    if (open) {
      if (dataSource) {
        setFormData({
          source_name: dataSource.source_name,
          description: dataSource.description || '',
          is_active: dataSource.is_active,
        });
      } else {
        setFormData({ ...defaultDataSourceFormData });
      }
      setErrors({});
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

    // Description validation
    if (formData.description && formData.description.length > dataSourceValidation.description.maxLength) {
      newErrors.description = `Description must be at most ${dataSourceValidation.description.maxLength} characters`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validate()) {
        return;
      }

      setIsSubmitting(true);
      try {
        await onSubmit(formData, dataSource?.source_id);
        onClose();
      } catch (error) {
        console.error('Form submission error:', error);
        setErrors({
          _form: error instanceof Error ? error.message : 'An error occurred',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, dataSource, validate, onSubmit, onClose]
  );

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className={styles.dialog}>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <DialogTitle className={styles.header}>
              <span className={styles.title}>
                {isEditing ? 'Edit Connection' : 'Add Connection'}
              </span>
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
                <div className={styles.formError}>{errors._form}</div>
              )}

              <div className={styles.formGrid}>
                {/* Source Name (full width) */}
                <Field
                  label={
                    <>
                      <span className={styles.fieldLabel}>Connection Name</span>
                      <span className={styles.required}>*</span>
                    </>
                  }
                  validationState={errors.source_name ? 'error' : undefined}
                  validationMessage={errors.source_name}
                  className={styles.fullWidth}
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
                    placeholder="Optional description of this connection"
                    rows={2}
                    disabled={isSubmitting}
                    className={styles.input}
                    appearance="filled-darker"
                  />
                </Field>

                {/* Active Status */}
                <div className={`${styles.fullWidth} ${styles.switchRow}`}>
                  <Switch
                    checked={formData.is_active}
                    onChange={(_, data) => handleChange('is_active', data.checked)}
                    disabled={isSubmitting}
                  />
                  <span className={styles.switchLabel}>Active</span>
                </div>
              </div>
            </DialogContent>

            <DialogActions className={styles.actions}>
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
