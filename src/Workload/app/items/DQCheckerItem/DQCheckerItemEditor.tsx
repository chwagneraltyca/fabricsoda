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
 * GraphQL Pattern (from Data Lineage reference):
 * - Load item definition to get graphqlEndpoint from settings
 * - Pass endpoint to GraphQL client at initialization
 * - Item definition is stored in Fabric and includes user preferences
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
import { initGraphQLClient } from './services';
import { getWorkloadItem } from '../../controller/ItemCRUDController';
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
  graphqlEndpoint: '',
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

  const handleTabSelect = (_: SelectTabEvent, data: SelectTabData) => {
    setActiveTab(data.value as TabId);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'data-sources':
        return <DataSourcesView />;
      case 'checks':
        return <PlaceholderContent tabName="Checks" />;
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

export const DQCheckerItemEditor: React.FC<DQCheckerItemEditorProps> = ({
  workloadClient,
}) => {
  const styles = useStyles();
  // itemObjectId is used for item-specific data loading and settings
  const { itemObjectId } = useParams<{ itemObjectId: string }>();

  // Initialization state
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Item definition state (contains graphqlEndpoint and other settings)
  // Note: settings stored for future use (passing defaults to child components)
  const [_settings, setSettings] = useState<DQCheckerSettings>(DEFAULT_SETTINGS);

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

      // Merge with defaults to ensure all fields have values
      const mergedSettings = { ...DEFAULT_SETTINGS, ...loadedItem.definition };
      setSettings(mergedSettings);
      return mergedSettings;
    } catch (error) {
      console.warn('[DQCheckerItemEditor] Failed to load item definition, using defaults:', error);
      return DEFAULT_SETTINGS;
    }
  }, [workloadClient, itemObjectId]);

  // Initialize the GraphQL client with endpoint from item definition
  // Pattern from Data Lineage: load definition first, then get endpoint
  useEffect(() => {
    const initialize = async () => {
      try {
        // Step 1: Load item definition to get graphqlEndpoint from settings
        const loadedSettings = await loadItemDefinition();

        // Step 2: Initialize GraphQL client with endpoint from settings
        const endpoint = loadedSettings.graphqlEndpoint;
        if (!endpoint) {
          console.warn('[DQCheckerItemEditor] No graphqlEndpoint configured. Go to Settings to configure.');
        }

        initGraphQLClient(workloadClient, endpoint);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize DQCheckerItem:', error);
        setInitError(error instanceof Error ? error.message : 'Initialization failed');
      }
    };

    initialize();
  }, [workloadClient, loadItemDefinition]);

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

  // Define views (single main view for now)
  const views: RegisteredView[] = [
    {
      name: 'main',
      component: <MainView />,
    },
  ];

  // Handle opening settings dialog in outer Fabric toolbar
  const handleOpenSettings = async () => {
    if (!itemObjectId) return;

    // Create minimal Item object for settings dialog
    const item = {
      id: itemObjectId,
      workspaceId: '', // Will be filled by Fabric
      type: `${process.env.WORKLOAD_NAME}.DQChecker`,
      displayName: 'DQ Checker',
      description: '',
      folderId: '',
      tags: [] as ItemTag[],
    };

    try {
      await callOpenSettings(workloadClient, item, 'customItemSettings');
    } catch (error) {
      console.error('Failed to open settings:', error);
    }
  };

  // Ribbon actions for Home tab
  const homeActions: RibbonAction[] = [
    {
      key: 'refresh',
      icon: ArrowSync24Regular,
      label: 'Refresh',
      tooltip: 'Refresh data',
      onClick: () => {
        // Trigger refresh - this would be connected to the DataSourcesView
        window.location.reload();
      },
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
      onClick: () => setIsHelpOpen(true),
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
    <>
      <ItemEditor
        ribbon={renderRibbon}
        views={views}
        initialView="main"
      />
      {/* Help Dialog */}
      <DQCheckerItemHelp
        open={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </>
  );
};

export default DQCheckerItemEditor;
