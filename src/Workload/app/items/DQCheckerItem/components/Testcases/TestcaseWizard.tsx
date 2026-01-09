/**
 * TestcaseWizard - Multi-check testcase creation wizard
 *
 * 3-step wizard for creating testcases with multiple checks:
 * - Step 1: Scope (source, schema, table, name)
 * - Step 2: Add Checks (MetricSidebar + CheckForm, loop to add multiple)
 * - Step 3: Review (summary + YAML preview)
 *
 * Equivalent to Legacy Contract Wizard.
 */

import React from 'react';
import {
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Button,
  makeStyles,
  tokens,
  Spinner,
  ProgressBar,
  Text,
} from '@fluentui/react-components';
import {
  Dismiss24Regular,
  ArrowLeft16Regular,
  ArrowRight16Regular,
  Checkmark16Regular,
} from '@fluentui/react-icons';
import { WizardProvider, useWizard, WizardStep } from './WizardContext';
import { ScopeStep } from './steps/ScopeStep';
import { ChecksStep } from './steps/ChecksStep';
import { ReviewStep } from './steps/ReviewStep';
import { TestcaseInput } from '../../types/testcase.types';

const useStyles = makeStyles({
  progressContainer: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingVerticalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  progressBar: {
    marginTop: tokens.spacingVerticalXS,
  },
  stepLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: tokens.spacingVerticalXS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  activeStep: {
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  body: {
    padding: 0,
    overflow: 'hidden',
    flex: 1,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    padding: tokens.spacingVerticalM,
  },
  footerRight: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
});

const stepLabels: Record<WizardStep, string> = {
  scope: 'Scope',
  checks: 'Add Checks',
  review: 'Review',
};

const stepOrder: WizardStep[] = ['scope', 'checks', 'review'];

interface WizardContentProps {
  onSave: (testcase: TestcaseInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const WizardContent: React.FC<WizardContentProps> = ({
  onSave,
  onCancel,
  isLoading = false,
}) => {
  const styles = useStyles();
  const {
    state,
    nextStep,
    prevStep,
    canGoNext,
    canGoPrev,
    getTestcaseInput,
    reset,
  } = useWizard();

  const currentStepIndex = stepOrder.indexOf(state.currentStep);
  const progress = (currentStepIndex + 1) / stepOrder.length;

  const handleSave = async () => {
    const testcaseInput = getTestcaseInput();
    await onSave(testcaseInput);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const renderStep = () => {
    switch (state.currentStep) {
      case 'scope':
        return <ScopeStep />;
      case 'checks':
        return <ChecksStep />;
      case 'review':
        return <ReviewStep />;
      default:
        return null;
    }
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
              onClick={handleCancel}
            />
          }
        >
          Table Checks
        </DrawerHeaderTitle>
      </DrawerHeader>

      {/* Progress indicator */}
      <div className={styles.progressContainer}>
        <ProgressBar
          className={styles.progressBar}
          value={progress}
          thickness="large"
          color="brand"
        />
        <div className={styles.stepLabel}>
          {stepOrder.map((step, index) => (
            <Text
              key={step}
              className={step === state.currentStep ? styles.activeStep : ''}
            >
              {index + 1}. {stepLabels[step]}
            </Text>
          ))}
        </div>
      </div>

      <DrawerBody className={styles.body}>
        {renderStep()}

        {isLoading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.8)',
          }}>
            <Spinner label="Saving testcase..." />
          </div>
        )}
      </DrawerBody>

      <div className={styles.footer}>
        <Button
          appearance="secondary"
          icon={<ArrowLeft16Regular />}
          onClick={prevStep}
          disabled={!canGoPrev() || isLoading}
        >
          Back
        </Button>

        <div className={styles.footerRight}>
          <Button appearance="secondary" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>

          {state.currentStep === 'review' ? (
            <Button
              appearance="primary"
              icon={<Checkmark16Regular />}
              onClick={handleSave}
              disabled={state.checks.length === 0 || isLoading}
            >
              Create Testcase
            </Button>
          ) : (
            <Button
              appearance="primary"
              icon={<ArrowRight16Regular />}
              iconPosition="after"
              onClick={nextStep}
              disabled={!canGoNext()}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

export interface TestcaseWizardProps {
  onSave: (testcase: TestcaseInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const TestcaseWizard: React.FC<TestcaseWizardProps> = (props) => {
  return (
    <WizardProvider>
      <WizardContent {...props} />
    </WizardProvider>
  );
};

export default TestcaseWizard;
