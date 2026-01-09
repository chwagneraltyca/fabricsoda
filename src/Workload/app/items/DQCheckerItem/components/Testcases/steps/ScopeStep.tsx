/**
 * ScopeStep - Wizard Step 1: Testcase scope configuration
 *
 * Configure source, schema, table, and testcase metadata.
 */

import React from 'react';
import {
  Field,
  Input,
  Dropdown,
  Option,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useWizard } from '../WizardContext';
import { useSources } from '../../../context';

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    maxWidth: '600px',
  },
  row: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
  },
  field: {
    flex: 1,
  },
  sectionTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase400,
    marginTop: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground1,
  },
});

export const ScopeStep: React.FC = () => {
  const styles = useStyles();
  const { state, updateScope } = useWizard();
  const { sources } = useSources();

  const selectedSource = sources.find(s => s.source_id === state.sourceId);

  return (
    <div className={styles.container}>
      {/* Required fields */}
      <Field label="Testcase Name" required>
        <Input
          value={state.testcaseName}
          onChange={(_, data) => updateScope({ testcaseName: data.value })}
          placeholder="e.g., Customer Data Quality Checks"
        />
      </Field>

      <Field label="Source" required>
        <Dropdown
          placeholder="Select data source"
          value={selectedSource?.source_name || ''}
          selectedOptions={state.sourceId ? [state.sourceId] : []}
          onOptionSelect={(_, data) => {
            if (data.optionValue) {
              updateScope({ sourceId: data.optionValue });
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

      <div className={styles.row}>
        <Field label="Schema" required className={styles.field}>
          <Input
            value={state.schemaName}
            onChange={(_, data) => updateScope({ schemaName: data.value })}
            placeholder="e.g., dbo"
          />
        </Field>
        <Field label="Table" required className={styles.field}>
          <Input
            value={state.tableName}
            onChange={(_, data) => updateScope({ tableName: data.value })}
            placeholder="e.g., customers"
          />
        </Field>
      </div>

      {/* Optional fields */}
      <div className={styles.sectionTitle}>Optional Details</div>

      <Field label="Description">
        <Textarea
          value={state.description}
          onChange={(_, data) => updateScope({ description: data.value })}
          placeholder="Describe the purpose of these checks..."
          rows={3}
        />
      </Field>

      <Field label="Owner">
        <Input
          value={state.owner}
          onChange={(_, data) => updateScope({ owner: data.value })}
          placeholder="e.g., data-team@company.com"
          type="email"
        />
      </Field>

      <Field label="Tags" hint="Comma-separated">
        <Input
          value={state.tags.join(', ')}
          onChange={(_, data) => {
            const tags = data.value
              ? data.value.split(',').map(t => t.trim()).filter(Boolean)
              : [];
            updateScope({ tags });
          }}
          placeholder="e.g., production, customer, critical"
        />
      </Field>
    </div>
  );
};

export default ScopeStep;
