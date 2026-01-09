/**
 * WizardContext - State management for TestcaseWizard
 *
 * Manages wizard step navigation and testcase data across all steps.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Check, MetricType } from '../../types/check.types';
import { TestcaseInput } from '../../types/testcase.types';

export type WizardStep = 'scope' | 'checks' | 'review';

export interface WizardState {
  currentStep: WizardStep;
  // Scope data (Step 1)
  testcaseName: string;
  sourceId: string;
  schemaName: string;
  tableName: string;
  description: string;
  owner: string;
  tags: string[];
  // Checks data (Step 2)
  checks: Check[];
  selectedMetric: MetricType | null;
  editingCheck: Check | null;
}

const initialState: WizardState = {
  currentStep: 'scope',
  testcaseName: '',
  sourceId: '',
  schemaName: '',
  tableName: '',
  description: '',
  owner: '',
  tags: [],
  checks: [],
  selectedMetric: null,
  editingCheck: null,
};

interface WizardContextValue {
  state: WizardState;
  // Navigation
  goToStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  canGoNext: () => boolean;
  canGoPrev: () => boolean;
  // Scope updates
  updateScope: (updates: Partial<Pick<WizardState, 'testcaseName' | 'sourceId' | 'schemaName' | 'tableName' | 'description' | 'owner' | 'tags'>>) => void;
  // Check management
  addCheck: (check: Check) => void;
  updateCheck: (checkId: string, check: Check) => void;
  removeCheck: (checkId: string) => void;
  setSelectedMetric: (metric: MetricType | null) => void;
  setEditingCheck: (check: Check | null) => void;
  // Output
  getTestcaseInput: () => TestcaseInput;
  // Reset
  reset: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

const stepOrder: WizardStep[] = ['scope', 'checks', 'review'];

export const WizardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<WizardState>(initialState);

  const goToStep = useCallback((step: WizardStep) => {
    setState(prev => ({ ...prev, currentStep: step }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => {
      const currentIndex = stepOrder.indexOf(prev.currentStep);
      if (currentIndex < stepOrder.length - 1) {
        return { ...prev, currentStep: stepOrder[currentIndex + 1] };
      }
      return prev;
    });
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => {
      const currentIndex = stepOrder.indexOf(prev.currentStep);
      if (currentIndex > 0) {
        return { ...prev, currentStep: stepOrder[currentIndex - 1] };
      }
      return prev;
    });
  }, []);

  const canGoNext = useCallback(() => {
    const { currentStep, sourceId, schemaName, tableName, testcaseName, checks } = state;
    switch (currentStep) {
      case 'scope':
        return !!(sourceId && schemaName && tableName && testcaseName);
      case 'checks':
        return checks.length > 0;
      case 'review':
        return false; // Last step
      default:
        return false;
    }
  }, [state]);

  const canGoPrev = useCallback(() => {
    return stepOrder.indexOf(state.currentStep) > 0;
  }, [state.currentStep]);

  const updateScope = useCallback((updates: Partial<Pick<WizardState, 'testcaseName' | 'sourceId' | 'schemaName' | 'tableName' | 'description' | 'owner' | 'tags'>>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const addCheck = useCallback((check: Check) => {
    setState(prev => ({
      ...prev,
      checks: [...prev.checks, check],
      editingCheck: null,
    }));
  }, []);

  const updateCheck = useCallback((checkId: string, check: Check) => {
    setState(prev => ({
      ...prev,
      checks: prev.checks.map(c => c.check_id === checkId ? check : c),
      editingCheck: null,
    }));
  }, []);

  const removeCheck = useCallback((checkId: string) => {
    setState(prev => ({
      ...prev,
      checks: prev.checks.filter(c => c.check_id !== checkId),
    }));
  }, []);

  const setSelectedMetric = useCallback((metric: MetricType | null) => {
    setState(prev => ({ ...prev, selectedMetric: metric }));
  }, []);

  const setEditingCheck = useCallback((check: Check | null) => {
    setState(prev => ({
      ...prev,
      editingCheck: check,
      selectedMetric: check?.metric || prev.selectedMetric,
    }));
  }, []);

  const getTestcaseInput = useCallback((): TestcaseInput => {
    return {
      testcase_name: state.testcaseName,
      source_id: state.sourceId,
      schema_name: state.schemaName,
      table_name: state.tableName,
      description: state.description || undefined,
      owner: state.owner || undefined,
      tags: state.tags.length > 0 ? state.tags : undefined,
      checks: state.checks,
      is_active: true,
    };
  }, [state]);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const value: WizardContextValue = {
    state,
    goToStep,
    nextStep,
    prevStep,
    canGoNext,
    canGoPrev,
    updateScope,
    addCheck,
    updateCheck,
    removeCheck,
    setSelectedMetric,
    setEditingCheck,
    getTestcaseInput,
    reset,
  };

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
};

export const useWizard = (): WizardContextValue => {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
};

export default WizardContext;
