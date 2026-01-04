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
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { WorkloadClientAPI } from '@ms-fabric/workload-client';
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
import {
  DatabaseMultiple24Regular,
  TaskListSquareLtr24Regular,
  ChartMultiple24Regular,
  ArrowSync24Regular,
} from '@fluentui/react-icons';

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
  { id: 'data-sources', label: 'Data Sources', icon: <DatabaseMultiple24Regular /> },
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
  const { itemObjectId } = useParams<{ itemObjectId: string }>();

  // Initialization state
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Initialize the GraphQL client on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize GraphQL client with workload client for auth
        initGraphQLClient(workloadClient);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize DQCheckerItem:', error);
        setInitError(error instanceof Error ? error.message : 'Initialization failed');
      }
    };

    initialize();
  }, [workloadClient]);

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

  // Ribbon actions for Home tab
  const homeActions: RibbonAction[] = [
    {
      key: 'refresh',
      icon: <ArrowSync24Regular />,
      label: 'Refresh',
      tooltip: 'Refresh data',
      onClick: () => {
        // Trigger refresh - this would be connected to the DataSourcesView
        window.location.reload();
      },
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

export default DQCheckerItemEditor;
