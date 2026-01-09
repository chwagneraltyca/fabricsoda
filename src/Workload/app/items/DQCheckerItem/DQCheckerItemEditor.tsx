/**
 * DQCheckerItemEditor
 *
 * Main editor component for the DQ Checker workload item.
 * Uses the base ItemEditor component with a single main view.
 *
 * The main view contains tab navigation for:
 * - Data Sources: Manage database connections
 * - Checks: Manage DQ checks (TODO)
 * - Results: View check results (TODO)
 *
 * Data Pattern (OneLake JSON):
 * - Load all entities on mount via DataProvider
 * - Cache in memory for instant access
 * - Write-through to OneLake on mutations
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { WorkloadClientAPI, ItemTag } from '@ms-fabric/workload-client';
import {
  Spinner,
  makeStyles,
  tokens,
  Tab,
  TabList,
  SelectTabEvent,
  SelectTabData,
} from '@fluentui/react-components';
import {
  ItemEditor,
  RegisteredView,
  ViewContext,
  Ribbon,
  RibbonAction,
} from '../../components/ItemEditor';
import { DataSourcesView } from './components/DataSources';
import { TestcasesView } from './components/Testcases';
import { DataProvider } from './context';
import { getWorkloadItem } from '../../controller/ItemCRUDController';
import { WorkloadClientProvider, DebugLoggerProvider, useDebugLog, useDebugLogContext } from '../../context';
import { DQCheckerSettings } from './DQCheckerItemSettings';
import {
  Database24Regular,
  TaskListSquareLtr24Regular,
  ChartMultiple24Regular,
  ArrowSync24Regular,
  Settings24Regular,
  Question24Regular,
} from '@fluentui/react-icons';
import { callOpenSettings } from '../../controller/SettingsController';
import { DQCheckerItemHelp } from './DQCheckerItemHelp';

// Default settings (must match DQCheckerItemSettings.tsx)
const DEFAULT_SETTINGS: DQCheckerSettings = {
  defaultOwner: '',
  defaultSeverity: 'medium',
  defaultDimension: 'completeness',
  defaultTags: '',
};

const useStyles = makeStyles({
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    minHeight: '400px',
  },

  errorContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    minHeight: '400px',
    color: tokens.colorPaletteRedForeground1,
    fontSize: tokens.fontSizeBase400,
  },

  mainView: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },

  tabBar: {
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },

  tabContent: {
    flex: 1,
    overflow: 'auto',
    padding: tokens.spacingHorizontalL,
  },

  placeholder: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    minHeight: '300px',
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase400,
  },
});

interface DQCheckerItemEditorProps {
  workloadClient: WorkloadClientAPI;
}

// Tab definitions
type TabId = 'data-sources' | 'checks' | 'results';

interface TabDefinition {
  id: TabId;
  label: string;
  icon: React.ReactElement;
}

const tabs: TabDefinition[] = [
  { id: 'data-sources', label: 'Data Sources', icon: <Database24Regular /> },
  { id: 'checks', label: 'Checks', icon: <TaskListSquareLtr24Regular /> },
  { id: 'results', label: 'Results', icon: <ChartMultiple24Regular /> },
];

// Placeholder component for unimplemented tabs
const PlaceholderContent: React.FC<{ tabName: string }> = ({ tabName }) => {
  const styles = useStyles();
  return (
    <div className={styles.placeholder}>
      {tabName} - Coming soon
    </div>
  );
};

// Main view component with tab navigation
const MainView: React.FC = () => {
  const styles = useStyles();
  const [activeTab, setActiveTab] = useState<TabId>('data-sources');
  const log = useDebugLog('MainView');

  // Log tab changes for debugging
  const handleTabSelect = (_: SelectTabEvent, data: SelectTabData) => {
    log.info('Tab changed', { from: activeTab, to: data.value });
    setActiveTab(data.value as TabId);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'data-sources':
        return <DataSourcesView />;
      case 'checks':
        return <TestcasesView />;
      case 'results':
        return <PlaceholderContent tabName="Results" />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.mainView}>
      {/* Tab Navigation */}
      <div className={styles.tabBar}>
        <TabList selectedValue={activeTab} onTabSelect={handleTabSelect}>
          {tabs.map(tab => (
            <Tab key={tab.id} value={tab.id} icon={tab.icon}>
              {tab.label}
            </Tab>
          ))}
        </TabList>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {renderTabContent()}
      </div>
    </div>
  );
};

// Inner content component that has access to debug logger context
interface EditorContentProps {
  workloadClient: WorkloadClientAPI;
  itemObjectId: string | undefined;
  onOpenHelp: () => void;
}

const EditorContent: React.FC<EditorContentProps> = ({
  workloadClient,
  itemObjectId,
  onOpenHelp,
}) => {
  const log = useDebugLog('EditorContent');
  const { flush, sessionId, logPath } = useDebugLogContext();

  // Log session info on mount
  useEffect(() => {
    log.info('DQ Checker Editor initialized', {
      itemId: itemObjectId,
      sessionId,
      logPath
    });
  }, [log, itemObjectId, sessionId, logPath]);

  // Handle refresh with debug logging
  const handleRefresh = useCallback(async () => {
    log.info('Refresh triggered by user', { sessionId });
    log.info('Flushing debug logs before page reload...');
    await flush();
    // Small delay to ensure flush completes
    setTimeout(() => {
      window.location.reload();
    }, 300);
  }, [log, flush, sessionId]);

  // Handle opening settings dialog
  const handleOpenSettings = async () => {
    if (!itemObjectId) return;

    log.info('Opening settings dialog', { itemId: itemObjectId });
    const item = {
      id: itemObjectId,
      workspaceId: '',
      type: `${process.env.WORKLOAD_NAME}.DQChecker`,
      displayName: 'DQ Checker',
      description: '',
      folderId: '',
      tags: [] as ItemTag[],
    };

    try {
      await callOpenSettings(workloadClient, item, 'customItemSettings');
    } catch (error) {
      log.error('Failed to open settings', { error: error instanceof Error ? error.message : String(error) });
    }
  };

  // Define views
  const views: RegisteredView[] = [
    {
      name: 'main',
      component: <MainView />,
    },
  ];

  // Ribbon actions for Home tab
  const homeActions: RibbonAction[] = [
    {
      key: 'refresh',
      icon: ArrowSync24Regular,
      label: 'Refresh',
      tooltip: 'Refresh data (logs will be flushed)',
      onClick: handleRefresh,
    },
    {
      key: 'settings',
      icon: Settings24Regular,
      label: 'Settings',
      tooltip: 'Open preferences',
      onClick: handleOpenSettings,
    },
    {
      key: 'help',
      icon: Question24Regular,
      label: 'Help',
      tooltip: 'Open help guide',
      onClick: onOpenHelp,
    },
  ];

  // Ribbon render function
  const renderRibbon = (context: ViewContext) => (
    <Ribbon
      homeToolbarActions={homeActions}
      viewContext={context}
    />
  );

  return (
    <ItemEditor
      ribbon={renderRibbon}
      views={views}
      initialView="main"
    />
  );
};


export const DQCheckerItemEditor: React.FC<DQCheckerItemEditorProps> = ({
  workloadClient,
}) => {
  const styles = useStyles();
  // itemObjectId is used for item-specific data loading and settings
  const { itemObjectId } = useParams<{ itemObjectId: string }>();

  // Initialization state
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Item definition state (contains default values for checks)
  // Note: settings stored for future use (passing defaults to child components)
  const [_settings, setSettings] = useState<DQCheckerSettings>(DEFAULT_SETTINGS);

  // Workspace ID for OneLake debug logging
  const [workspaceId, setWorkspaceId] = useState<string>('');

  // Help dialog state
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Load item definition from Fabric (same pattern as Data Lineage)
  const loadItemDefinition = useCallback(async () => {
    if (!itemObjectId) {
      console.warn('[DQCheckerItemEditor] No itemObjectId, using default settings');
      return DEFAULT_SETTINGS;
    }

    try {
      const loadedItem = await getWorkloadItem<DQCheckerSettings>(
        workloadClient,
        itemObjectId,
        DEFAULT_SETTINGS
      );

      // Capture workspace ID for debug logging
      if (loadedItem.workspaceId) {
        setWorkspaceId(loadedItem.workspaceId);
      }

      // Merge with defaults to ensure all fields have values
      const mergedSettings = { ...DEFAULT_SETTINGS, ...loadedItem.definition };
      setSettings(mergedSettings);
      return mergedSettings;
    } catch (error) {
      console.warn('[DQCheckerItemEditor] Failed to load item definition, using defaults:', error);
      return DEFAULT_SETTINGS;
    }
  }, [workloadClient, itemObjectId]);

  // Initialize the editor (load settings, capture workspace ID)
  useEffect(() => {
    const initialize = async () => {
      try {
        // Load item definition to get settings and workspace ID
        await loadItemDefinition();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize DQCheckerItem:', error);
        setInitError(error instanceof Error ? error.message : 'Initialization failed');
      }
    };

    initialize();
  }, [loadItemDefinition]);

  // Show loading while initializing
  if (!isInitialized && !initError) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner label="Initializing DQ Checker..." />
      </div>
    );
  }

  // Show error if initialization failed
  if (initError) {
    return (
      <div className={styles.errorContainer}>
        Error: {initError}
      </div>
    );
  }

  // Item reference for OneLake operations
  const itemReference = {
    id: itemObjectId || '',
    workspaceId: workspaceId,
  };

  return (
    <WorkloadClientProvider workloadClient={workloadClient}>
      <DebugLoggerProvider
        workloadClient={workloadClient}
        workspaceId={workspaceId}
        itemId={itemObjectId || ''}
      >
        <DataProvider
          workloadClient={workloadClient}
          itemReference={itemReference}
        >
          <EditorContent
            workloadClient={workloadClient}
            itemObjectId={itemObjectId}
            onOpenHelp={() => setIsHelpOpen(true)}
          />
        </DataProvider>
        {/* Help Dialog */}
        <DQCheckerItemHelp
          open={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
        />
      </DebugLoggerProvider>
    </WorkloadClientProvider>
  );
};

export default DQCheckerItemEditor;
