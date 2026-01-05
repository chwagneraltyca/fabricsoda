/**
 * DQCheckerItemSettings
 *
 * Preferences page component displayed in Fabric's Settings dialog.
 * Allows users to configure default values for data quality checks.
 * Migrated from Legacy/flask_app/blueprints/settings.py preferences.
 *
 * Settings are stored in the item definition and persisted via Fabric.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
    Field,
    Input,
    Dropdown,
    Option,
    Button,
    Text,
    Spinner,
    MessageBar,
    MessageBarBody,
    Divider,
    makeStyles,
    tokens,
} from '@fluentui/react-components';
import {
    Settings24Regular,
    Save24Regular,
    ArrowReset24Regular,
    Person24Regular,
    Tag24Regular,
    DataBarVertical24Regular,
    Warning24Regular,
    Database24Regular,
    PlugConnected24Regular,
    Checkmark24Regular,
    Dismiss24Regular,
} from '@fluentui/react-icons';
import { FabricAuthenticationService } from '../../clients/FabricAuthenticationService';
import { FABRIC_BASE_SCOPES } from '../../clients/FabricPlatformScopes';
import { getWorkloadItem, saveWorkloadItem, ItemWithDefinition } from '../../controller/ItemCRUDController';
import { PageProps } from '../../App';
import { useDebugLog } from '../../context';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalL,
        padding: tokens.spacingHorizontalL,
        maxWidth: '600px',
    },
    section: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        marginBottom: tokens.spacingVerticalXS,
    },
    fieldGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
    },
    buttonRow: {
        display: 'flex',
        gap: tokens.spacingHorizontalM,
        marginTop: tokens.spacingVerticalM,
    },
    description: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
    },
    loadingContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
    },
    connectionCard: {
        backgroundColor: tokens.colorNeutralBackground1,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        borderRadius: tokens.borderRadiusMedium,
        padding: tokens.spacingVerticalL,
        boxShadow: tokens.shadow4,
    },
    connectionStatus: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        marginTop: tokens.spacingVerticalM,
        padding: tokens.spacingVerticalS,
        borderRadius: tokens.borderRadiusMedium,
    },
    connectionSuccess: {
        backgroundColor: tokens.colorPaletteGreenBackground1,
        color: tokens.colorPaletteGreenForeground1,
    },
    connectionError: {
        backgroundColor: tokens.colorPaletteRedBackground1,
        color: tokens.colorPaletteRedForeground1,
    },
    connectionPending: {
        backgroundColor: tokens.colorNeutralBackground3,
        color: tokens.colorNeutralForeground2,
    },
    testButtonRow: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalM,
        marginTop: tokens.spacingVerticalM,
    },
});

// DQ Dimension options (from legacy app)
const DQ_DIMENSIONS = [
    { value: 'completeness', label: 'Completeness' },
    { value: 'accuracy', label: 'Accuracy' },
    { value: 'consistency', label: 'Consistency' },
    { value: 'validity', label: 'Validity' },
    { value: 'uniqueness', label: 'Uniqueness' },
    { value: 'timeliness', label: 'Timeliness' },
];

// Severity level options (from legacy app)
const SEVERITY_LEVELS = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
];

// Default settings
const DEFAULT_SETTINGS: DQCheckerSettings = {
    graphqlEndpoint: '',
    defaultOwner: '',
    defaultSeverity: 'medium',
    defaultDimension: 'completeness',
    defaultTags: '',
};

// Settings interface
export interface DQCheckerSettings {
    graphqlEndpoint: string;
    defaultOwner: string;
    defaultSeverity: string;
    defaultDimension: string;
    defaultTags: string;
}

// Connection test status
type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

interface ConnectionTestResult {
    status: ConnectionStatus;
    message: string;
    lastTested?: Date;
}

// Use PageProps (same pattern as Data Lineage) - workloadClient is REQUIRED
export const DQCheckerItemSettings: React.FC<PageProps> = ({
    workloadClient,
}) => {
    const styles = useStyles();
    const log = useDebugLog('DQCheckerItemSettings');
    const { itemObjectId } = useParams<{ itemObjectId: string }>();

    // State - following Data Lineage pattern for Fabric persistence
    const [item, setItem] = useState<ItemWithDefinition<DQCheckerSettings> | null>(null);
    const [settings, setSettings] = useState<DQCheckerSettings>(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [connectionTest, setConnectionTest] = useState<ConnectionTestResult>({
        status: 'idle',
        message: 'Not tested',
    });

    // Load settings from Fabric item definition (same pattern as Data Lineage)
    const loadSettings = useCallback(async () => {
        log.info('loadSettings called', { itemObjectId });

        if (!itemObjectId) {
            log.error('No itemObjectId in URL');
            setMessage({ type: 'error', text: 'No item ID in URL. Please reopen Settings from item editor.' });
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            // Load from Fabric backend via ItemCRUDController
            log.info('Calling getWorkloadItem', { itemObjectId });
            const loadedItem = await getWorkloadItem<DQCheckerSettings>(
                workloadClient,
                itemObjectId,
                DEFAULT_SETTINGS  // fallback if no saved definition
            );
            log.info('Loaded item', { id: loadedItem.id, hasDefinition: !!loadedItem.definition });

            if (!loadedItem.id) {
                log.error('Item loaded but has no ID - fetch may have failed');
                setMessage({ type: 'error', text: 'Failed to load item. Check console for details.' });
                setIsLoading(false);
                return;
            }

            setItem(loadedItem);
            if (loadedItem.definition) {
                // Merge with defaults to handle new fields
                setSettings({ ...DEFAULT_SETTINGS, ...loadedItem.definition });
            }
        } catch (error) {
            log.error('Failed to load settings from Fabric', { error: error instanceof Error ? error.message : String(error) });
            // Keep default settings on error
            setMessage({ type: 'error', text: 'Failed to load settings from Fabric' });
        } finally {
            setIsLoading(false);
        }
    }, [workloadClient, itemObjectId, log]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    // Save settings to Fabric item definition (same pattern as Data Lineage)
    const handleSave = async () => {
        log.info('handleSave called', { itemId: item?.id, hasItem: !!item });

        if (!item) {
            log.error('Cannot save: item is null');
            setMessage({ type: 'error', text: 'Cannot save: item not loaded. Try reloading the page.' });
            return;
        }

        if (!item.id) {
            log.error('Cannot save: item has no ID', { item });
            setMessage({ type: 'error', text: 'Cannot save: item has no ID. Item may not have loaded correctly.' });
            return;
        }

        setIsSaving(true);
        setMessage(null);
        try {
            log.info('Calling saveWorkloadItem', { itemId: item.id, settings });
            // Save to Fabric backend via ItemCRUDController
            await saveWorkloadItem<DQCheckerSettings>(workloadClient, {
                ...item,
                definition: settings,
            });

            // Small delay to ensure Fabric has committed the change (eventual consistency)
            await new Promise(resolve => setTimeout(resolve, 500));

            log.info('Settings saved successfully');
            setMessage({ type: 'success', text: 'Settings saved to Fabric successfully' });
            setIsDirty(false);
        } catch (error) {
            log.error('Failed to save settings to Fabric', { error: error instanceof Error ? error.message : String(error) });
            const errorMsg = error instanceof Error ? error.message : String(error);
            setMessage({ type: 'error', text: `Failed to save: ${errorMsg}` });
        } finally {
            setIsSaving(false);
        }
    };

    // Reset to defaults
    const handleReset = () => {
        setSettings(DEFAULT_SETTINGS);
        setIsDirty(true);
        setMessage(null);
    };

    // Update a single setting
    const updateSetting = <K extends keyof DQCheckerSettings>(
        key: K,
        value: DQCheckerSettings[K]
    ) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setIsDirty(true);
        setMessage(null);
        // Reset connection test if endpoint changes
        if (key === 'graphqlEndpoint') {
            setConnectionTest({ status: 'idle', message: 'Not tested' });
        }
    };

    // Test GraphQL connection with Fabric authentication
    // Pattern from working data lineage project: fabric-datalineage/LineageService.ts
    // Simplified: no intermediate status messages, just testing state + final result
    const handleTestConnection = async () => {
        if (!settings.graphqlEndpoint) {
            setConnectionTest({
                status: 'error',
                message: 'Please enter a GraphQL endpoint URL',
            });
            return;
        }

        if (!workloadClient) {
            setConnectionTest({
                status: 'error',
                message: 'Workload client not available. Cannot authenticate.',
            });
            return;
        }

        // Simple testing state - no intermediate messages (like Data Lineage)
        setConnectionTest({ status: 'testing', message: '' });

        try {
            // Acquire token using Fabric authentication (same pattern as LineageService)
            const authService = new FabricAuthenticationService(workloadClient);
            const tokenResult = await authService.acquireAccessToken(FABRIC_BASE_SCOPES.POWERBI_API);

            // Query to verify dq_sources table exists (DQ Checker specific)
            const testQuery = `
                query TestConnection {
                    dq_sources(first: 1) {
                        items {
                            source_id
                            source_name
                        }
                    }
                }
            `;

            const response = await fetch(settings.graphqlEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenResult.token}`,
                },
                body: JSON.stringify({ query: testQuery }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                setConnectionTest({
                    status: 'error',
                    message: `GraphQL request failed (${response.status}): ${errorText.substring(0, 100)}`,
                    lastTested: new Date(),
                });
                return;
            }

            interface GraphQLError { message: string }
            interface GraphQLResult {
                data?: { dq_sources?: { items?: Array<{ source_id: number; source_name: string }> } };
                errors?: GraphQLError[];
            }
            const result: GraphQLResult = await response.json();

            if (result.errors && result.errors.length > 0) {
                // GraphQL returned errors - check if it's just missing table
                const errorMsg = result.errors.map((e) => e.message).join('; ');
                if (errorMsg.includes('does not exist')) {
                    setConnectionTest({
                        status: 'error',
                        message: `Connected but dq_sources table not found. Run the schema DDL first.`,
                        lastTested: new Date(),
                    });
                } else {
                    setConnectionTest({
                        status: 'error',
                        message: `GraphQL error: ${errorMsg}`,
                        lastTested: new Date(),
                    });
                }
                return;
            }

            // Success!
            const sources = result.data?.dq_sources?.items || [];
            setConnectionTest({
                status: 'success',
                message: `Connected! Found ${sources.length} data source(s).`,
                lastTested: new Date(),
            });

        } catch (error: unknown) {
            // Handle fetch/auth errors (network, CORS, token, etc.)
            const errorMessage = error instanceof Error ? error.message : String(error);
            setConnectionTest({
                status: 'error',
                message: `Connection failed: ${errorMessage}`,
                lastTested: new Date(),
            });
        }
    };

    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <Spinner label="Loading preferences..." />
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <Settings24Regular />
                    <Text weight="semibold" size={400}>Default Values</Text>
                </div>
                <Text className={styles.description}>
                    Set default values that will be pre-filled when creating new data quality checks.
                </Text>
            </div>

            {/* Message Bar */}
            {message && (
                <MessageBar intent={message.type === 'success' ? 'success' : 'error'}>
                    <MessageBarBody>{message.text}</MessageBarBody>
                </MessageBar>
            )}

            <Divider />

            {/* Database Connection Settings */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <Database24Regular />
                    <Text weight="semibold">Database Connection</Text>
                </div>
                <div className={styles.connectionCard}>
                    <div className={styles.fieldGroup}>
                        <Field
                            label="GraphQL Endpoint URL"
                            hint="The Fabric GraphQL API endpoint for your SQL database"
                            required
                        >
                            <Input
                                type="url"
                                value={settings.graphqlEndpoint}
                                onChange={(_, data) => updateSetting('graphqlEndpoint', data.value)}
                                placeholder="https://api.fabric.microsoft.com/v1/workspaces/.../graphql"
                            />
                        </Field>
                    </div>

                    <div className={styles.testButtonRow}>
                        <Button
                            appearance="secondary"
                            icon={connectionTest.status === 'testing' ? <Spinner size="tiny" /> : <PlugConnected24Regular />}
                            onClick={handleTestConnection}
                            disabled={connectionTest.status === 'testing' || !settings.graphqlEndpoint}
                        >
                            {connectionTest.status === 'testing' ? 'Testing...' : 'Test Connection'}
                        </Button>
                    </div>

                    {/* Only show result card after test completes (not during testing) */}
                    {(connectionTest.status === 'success' || connectionTest.status === 'error') && (
                        <div
                            className={`${styles.connectionStatus} ${
                                connectionTest.status === 'success'
                                    ? styles.connectionSuccess
                                    : styles.connectionError
                            }`}
                        >
                            {connectionTest.status === 'success' ? (
                                <Checkmark24Regular />
                            ) : (
                                <Dismiss24Regular />
                            )}
                            <Text size={200}>{connectionTest.message}</Text>
                        </div>
                    )}
                </div>
            </div>

            <Divider />

            {/* Owner Settings */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <Person24Regular />
                    <Text weight="semibold">Owner</Text>
                </div>
                <div className={styles.fieldGroup}>
                    <Field
                        label="Default Owner"
                        hint="Email address of the default check owner"
                    >
                        <Input
                            type="email"
                            value={settings.defaultOwner}
                            onChange={(_, data) => updateSetting('defaultOwner', data.value)}
                            placeholder="owner@company.com"
                        />
                    </Field>
                </div>
            </div>

            <Divider />

            {/* Severity Settings */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <Warning24Regular />
                    <Text weight="semibold">Severity</Text>
                </div>
                <div className={styles.fieldGroup}>
                    <Field
                        label="Default Severity Level"
                        hint="Default severity for new checks"
                    >
                        <Dropdown
                            value={SEVERITY_LEVELS.find(s => s.value === settings.defaultSeverity)?.label || 'Medium'}
                            selectedOptions={[settings.defaultSeverity]}
                            onOptionSelect={(_, data) => updateSetting('defaultSeverity', data.optionValue as string)}
                        >
                            {SEVERITY_LEVELS.map(level => (
                                <Option key={level.value} value={level.value}>
                                    {level.label}
                                </Option>
                            ))}
                        </Dropdown>
                    </Field>
                </div>
            </div>

            <Divider />

            {/* DQ Dimension Settings */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <DataBarVertical24Regular />
                    <Text weight="semibold">Data Quality Dimension</Text>
                </div>
                <div className={styles.fieldGroup}>
                    <Field
                        label="Default Dimension"
                        hint="Default DQ dimension for new checks"
                    >
                        <Dropdown
                            value={DQ_DIMENSIONS.find(d => d.value === settings.defaultDimension)?.label || 'Completeness'}
                            selectedOptions={[settings.defaultDimension]}
                            onOptionSelect={(_, data) => updateSetting('defaultDimension', data.optionValue as string)}
                        >
                            {DQ_DIMENSIONS.map(dim => (
                                <Option key={dim.value} value={dim.value}>
                                    {dim.label}
                                </Option>
                            ))}
                        </Dropdown>
                    </Field>
                </div>
            </div>

            <Divider />

            {/* Tags Settings */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <Tag24Regular />
                    <Text weight="semibold">Tags</Text>
                </div>
                <div className={styles.fieldGroup}>
                    <Field
                        label="Default Tags"
                        hint="Comma-separated list of default tags"
                    >
                        <Input
                            value={settings.defaultTags}
                            onChange={(_, data) => updateSetting('defaultTags', data.value)}
                            placeholder="production, daily, critical"
                        />
                    </Field>
                </div>
            </div>

            <Divider />

            {/* Action Buttons */}
            <div className={styles.buttonRow}>
                <Button
                    appearance="primary"
                    icon={<Save24Regular />}
                    onClick={handleSave}
                    disabled={isSaving || !isDirty}
                >
                    {isSaving ? 'Saving...' : 'Save Preferences'}
                </Button>
                <Button
                    appearance="secondary"
                    icon={<ArrowReset24Regular />}
                    onClick={handleReset}
                    disabled={isSaving}
                >
                    Reset to Defaults
                </Button>
            </div>
        </div>
    );
};

export default DQCheckerItemSettings;
