/**
 * Data Context (OneLake JSON)
 *
 * Implements the "load all, cache in memory" pattern for DQ Checker entities.
 * All data is loaded on mount and cached in React state.
 * Mutations update both memory and OneLake (write-through).
 *
 * Scale: ~200 files, ~580KB total - fits comfortably in memory
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { OneLakeStorageClient } from '../../../clients/OneLakeStorageClient';
import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { ItemReference } from '../../../controller/ItemCRUDController';

import {
  Source,
  SourceInput,
  SourceUpdate,
  Testcase,
  TestcaseInput,
  TestcaseUpdate,
  Check,
  CheckInput,
  CheckUpdate,
  Suite,
  SuiteInput,
  SuiteUpdate,
} from '../types';

import { SourceService } from '../services/sourceService';
import { TestcaseService } from '../services/testcaseService';
import { SuiteService } from '../services/suiteService';

// ============================================================================
// Types
// ============================================================================

export interface DataState {
  sources: Source[];
  testcases: Testcase[];
  suites: Suite[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface DataContextValue extends DataState {
  // Refresh data
  refresh: () => Promise<void>;

  // Source operations
  createSource: (input: SourceInput) => Promise<Source>;
  updateSource: (id: string, updates: SourceUpdate) => Promise<Source>;
  deleteSource: (id: string) => Promise<void>;
  getSourceById: (id: string) => Source | undefined;
  getSourceByName: (name: string) => Source | undefined;

  // Testcase operations
  createTestcase: (input: TestcaseInput) => Promise<Testcase>;
  updateTestcase: (id: string, updates: TestcaseUpdate) => Promise<Testcase>;
  deleteTestcase: (id: string) => Promise<void>;
  getTestcaseById: (id: string) => Testcase | undefined;
  getTestcasesBySource: (sourceId: string) => Testcase[];

  // Check operations (embedded in testcases)
  addCheck: (testcaseId: string, input: CheckInput) => Promise<Testcase>;
  updateCheck: (testcaseId: string, checkId: string, updates: CheckUpdate) => Promise<Testcase>;
  removeCheck: (testcaseId: string, checkId: string) => Promise<Testcase>;
  getCheckById: (testcaseId: string, checkId: string) => Check | undefined;

  // Suite operations
  createSuite: (input: SuiteInput) => Promise<Suite>;
  updateSuite: (id: string, updates: SuiteUpdate) => Promise<Suite>;
  deleteSuite: (id: string) => Promise<void>;
  getSuiteById: (id: string) => Suite | undefined;
  addTestcaseToSuite: (suiteId: string, testcaseId: string) => Promise<Suite>;
  removeTestcaseFromSuite: (suiteId: string, testcaseId: string) => Promise<Suite>;

  // Computed values
  totalCheckCount: number;
  activeSourceCount: number;
  activeTestcaseCount: number;
  activeSuiteCount: number;
}

const DataContext = createContext<DataContextValue | null>(null);

// ============================================================================
// Provider Props
// ============================================================================

interface DataProviderProps {
  children: ReactNode;
  workloadClient: WorkloadClientAPI;
  itemReference: ItemReference;
}

// ============================================================================
// Provider Component
// ============================================================================

export function DataProvider({ children, workloadClient, itemReference }: DataProviderProps) {
  // State
  const [sources, setSources] = useState<Source[]>([]);
  const [testcases, setTestcases] = useState<Testcase[]>([]);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Services (memoized)
  const { sourceService, testcaseService, suiteService } = useMemo(() => {
    const storageClient = new OneLakeStorageClient(workloadClient);
    const storage = storageClient.createItemWrapper(itemReference);

    return {
      sourceService: new SourceService(storage),
      testcaseService: new TestcaseService(storage),
      suiteService: new SuiteService(storage),
    };
  }, [workloadClient, itemReference]);

  // ========== Load All Data ==========

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[DataContext] Loading all data from OneLake...');
      const startTime = Date.now();

      // Load all entities in parallel
      const [sourcesData, testcasesData, suitesData] = await Promise.all([
        sourceService.list(),
        testcaseService.list(),
        suiteService.list(),
      ]);

      setSources(sourcesData);
      setTestcases(testcasesData);
      setSuites(suitesData);
      setLastUpdated(new Date());

      const duration = Date.now() - startTime;
      console.log(
        `[DataContext] Loaded ${sourcesData.length} sources, ${testcasesData.length} testcases, ${suitesData.length} suites in ${duration}ms`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      console.error('[DataContext] Load error:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [sourceService, testcaseService, suiteService]);

  // Load on mount
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ========== Source Operations ==========

  const createSource = useCallback(
    async (input: SourceInput): Promise<Source> => {
      const created = await sourceService.create(input);
      setSources((prev) => [...prev, created]);
      return created;
    },
    [sourceService]
  );

  const updateSource = useCallback(
    async (id: string, updates: SourceUpdate): Promise<Source> => {
      const updated = await sourceService.update(id, updates);
      setSources((prev) => prev.map((s) => (s.source_id === id ? updated : s)));
      return updated;
    },
    [sourceService]
  );

  const deleteSource = useCallback(
    async (id: string): Promise<void> => {
      // Check for dependent testcases
      const dependentTestcases = testcases.filter((t) => t.source_id === id);
      if (dependentTestcases.length > 0) {
        throw new Error(
          `Cannot delete source: ${dependentTestcases.length} testcases depend on it. Delete them first.`
        );
      }

      await sourceService.delete(id);
      setSources((prev) => prev.filter((s) => s.source_id !== id));
    },
    [sourceService, testcases]
  );

  const getSourceById = useCallback(
    (id: string): Source | undefined => sources.find((s) => s.source_id === id),
    [sources]
  );

  const getSourceByName = useCallback(
    (name: string): Source | undefined => sources.find((s) => s.source_name === name),
    [sources]
  );

  // ========== Testcase Operations ==========

  const createTestcase = useCallback(
    async (input: TestcaseInput): Promise<Testcase> => {
      const created = await testcaseService.create(input);
      setTestcases((prev) => [...prev, created]);
      return created;
    },
    [testcaseService]
  );

  const updateTestcase = useCallback(
    async (id: string, updates: TestcaseUpdate): Promise<Testcase> => {
      const updated = await testcaseService.update(id, updates);
      setTestcases((prev) => prev.map((t) => (t.testcase_id === id ? updated : t)));
      return updated;
    },
    [testcaseService]
  );

  const deleteTestcase = useCallback(
    async (id: string): Promise<void> => {
      // Remove from all suites first
      await suiteService.removeTestcaseFromAll(id);

      // Delete the testcase
      await testcaseService.delete(id);

      // Update local state
      setTestcases((prev) => prev.filter((t) => t.testcase_id !== id));
      setSuites((prev) =>
        prev.map((s) => ({
          ...s,
          testcase_ids: s.testcase_ids.filter((tid) => tid !== id),
        }))
      );
    },
    [testcaseService, suiteService]
  );

  const getTestcaseById = useCallback(
    (id: string): Testcase | undefined => testcases.find((t) => t.testcase_id === id),
    [testcases]
  );

  const getTestcasesBySource = useCallback(
    (sourceId: string): Testcase[] => testcases.filter((t) => t.source_id === sourceId),
    [testcases]
  );

  // ========== Check Operations ==========

  const addCheck = useCallback(
    async (testcaseId: string, input: CheckInput): Promise<Testcase> => {
      const updated = await testcaseService.addCheck(testcaseId, input);
      setTestcases((prev) => prev.map((t) => (t.testcase_id === testcaseId ? updated : t)));
      return updated;
    },
    [testcaseService]
  );

  const updateCheck = useCallback(
    async (testcaseId: string, checkId: string, updates: CheckUpdate): Promise<Testcase> => {
      const updated = await testcaseService.updateCheck(testcaseId, checkId, updates);
      setTestcases((prev) => prev.map((t) => (t.testcase_id === testcaseId ? updated : t)));
      return updated;
    },
    [testcaseService]
  );

  const removeCheck = useCallback(
    async (testcaseId: string, checkId: string): Promise<Testcase> => {
      const updated = await testcaseService.removeCheck(testcaseId, checkId);
      setTestcases((prev) => prev.map((t) => (t.testcase_id === testcaseId ? updated : t)));
      return updated;
    },
    [testcaseService]
  );

  const getCheckById = useCallback(
    (testcaseId: string, checkId: string): Check | undefined => {
      const testcase = testcases.find((t) => t.testcase_id === testcaseId);
      return testcase?.checks.find((c) => c.check_id === checkId);
    },
    [testcases]
  );

  // ========== Suite Operations ==========

  const createSuite = useCallback(
    async (input: SuiteInput): Promise<Suite> => {
      const created = await suiteService.create(input);
      setSuites((prev) => [...prev, created]);
      return created;
    },
    [suiteService]
  );

  const updateSuite = useCallback(
    async (id: string, updates: SuiteUpdate): Promise<Suite> => {
      const updated = await suiteService.update(id, updates);
      setSuites((prev) => prev.map((s) => (s.suite_id === id ? updated : s)));
      return updated;
    },
    [suiteService]
  );

  const deleteSuite = useCallback(
    async (id: string): Promise<void> => {
      await suiteService.delete(id);
      setSuites((prev) => prev.filter((s) => s.suite_id !== id));
    },
    [suiteService]
  );

  const getSuiteById = useCallback(
    (id: string): Suite | undefined => suites.find((s) => s.suite_id === id),
    [suites]
  );

  const addTestcaseToSuite = useCallback(
    async (suiteId: string, testcaseId: string): Promise<Suite> => {
      const updated = await suiteService.addTestcase(suiteId, testcaseId);
      setSuites((prev) => prev.map((s) => (s.suite_id === suiteId ? updated : s)));
      return updated;
    },
    [suiteService]
  );

  const removeTestcaseFromSuite = useCallback(
    async (suiteId: string, testcaseId: string): Promise<Suite> => {
      const updated = await suiteService.removeTestcase(suiteId, testcaseId);
      setSuites((prev) => prev.map((s) => (s.suite_id === suiteId ? updated : s)));
      return updated;
    },
    [suiteService]
  );

  // ========== Computed Values ==========

  const totalCheckCount = useMemo(
    () => testcases.reduce((sum, t) => sum + t.checks.length, 0),
    [testcases]
  );

  const activeSourceCount = useMemo(
    () => sources.filter((s) => s.is_active).length,
    [sources]
  );

  const activeTestcaseCount = useMemo(
    () => testcases.filter((t) => t.is_active).length,
    [testcases]
  );

  const activeSuiteCount = useMemo(
    () => suites.filter((s) => s.is_active).length,
    [suites]
  );

  // ========== Context Value ==========

  const value: DataContextValue = {
    // State
    sources,
    testcases,
    suites,
    isLoading,
    error,
    lastUpdated,

    // Refresh
    refresh: loadAllData,

    // Source operations
    createSource,
    updateSource,
    deleteSource,
    getSourceById,
    getSourceByName,

    // Testcase operations
    createTestcase,
    updateTestcase,
    deleteTestcase,
    getTestcaseById,
    getTestcasesBySource,

    // Check operations
    addCheck,
    updateCheck,
    removeCheck,
    getCheckById,

    // Suite operations
    createSuite,
    updateSuite,
    deleteSuite,
    getSuiteById,
    addTestcaseToSuite,
    removeTestcaseFromSuite,

    // Computed
    totalCheckCount,
    activeSourceCount,
    activeTestcaseCount,
    activeSuiteCount,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

// Convenience hooks for specific entities
export function useSources() {
  const { sources, createSource, updateSource, deleteSource, getSourceById, getSourceByName, isLoading, error } =
    useData();
  return { sources, createSource, updateSource, deleteSource, getSourceById, getSourceByName, isLoading, error };
}

export function useTestcases() {
  const {
    testcases,
    createTestcase,
    updateTestcase,
    deleteTestcase,
    getTestcaseById,
    getTestcasesBySource,
    isLoading,
    error,
  } = useData();
  return {
    testcases,
    createTestcase,
    updateTestcase,
    deleteTestcase,
    getTestcaseById,
    getTestcasesBySource,
    isLoading,
    error,
  };
}

export function useChecks() {
  const { addCheck, updateCheck, removeCheck, getCheckById, isLoading, error } = useData();
  return { addCheck, updateCheck, removeCheck, getCheckById, isLoading, error };
}

export function useSuites() {
  const {
    suites,
    createSuite,
    updateSuite,
    deleteSuite,
    getSuiteById,
    addTestcaseToSuite,
    removeTestcaseFromSuite,
    isLoading,
    error,
  } = useData();
  return {
    suites,
    createSuite,
    updateSuite,
    deleteSuite,
    getSuiteById,
    addTestcaseToSuite,
    removeTestcaseFromSuite,
    isLoading,
    error,
  };
}
