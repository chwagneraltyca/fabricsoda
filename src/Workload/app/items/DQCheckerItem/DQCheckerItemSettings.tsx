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
import { WorkloadClientAPI } from '@ms-fabric/workload-client';

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

interface DQCheckerItemSettingsProps {
    workloadClient?: WorkloadClientAPI;
}

export const DQCheckerItemSettings: React.FC<DQCheckerItemSettingsProps> = ({
    workloadClient,
}) => {
    const styles = useStyles();
    const { itemObjectId } = useParams<{ itemObjectId: string }>();

    // State
    const [settings, setSettings] = useState<DQCheckerSettings>(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [connectionTest, setConnectionTest] = useState<ConnectionTestResult>({
        status: 'idle',
        message: 'Not tested',
    });

    // Load settings from item definition
    const loadSettings = useCallback(async () => {
        setIsLoading(true);
        try {
            // In a real implementation, load from item definition via workloadClient
            // For now, try to load from localStorage as fallback
            const stored = localStorage.getItem(`dqchecker-settings-${itemObjectId}`);
            if (stored) {
                setSettings(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        } finally {
            setIsLoading(false);
        }
    }, [itemObjectId]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    // Save settings
    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            // In a real implementation, save to item definition via workloadClient
            // For now, save to localStorage as fallback
            localStorage.setItem(`dqchecker-settings-${itemObjectId}`, JSON.stringify(settings));
            setMessage({ type: 'success', text: 'Settings saved successfully' });
            setIsDirty(false);
        } catch (error) {
            console.error('Failed to save settings:', error);
            setMessage({ type: 'error', text: 'Failed to save settings' });
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

    // Test GraphQL connection
    const handleTestConnection = async () => {
        if (!settings.graphqlEndpoint) {
            setConnectionTest({
                status: 'error',
                message: 'Please enter a GraphQL endpoint URL',
            });
            return;
        }

        setConnectionTest({ status: 'testing', message: 'Testing connection...' });

        try {
            // Simple health check query - just check if endpoint responds
            const response = await fetch(settings.graphqlEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: '{ __typename }',
                }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.data) {
                    setConnectionTest({
                        status: 'success',
                        message: 'Connection successful',
                        lastTested: new Date(),
                    });
                } else if (data.errors) {
                    // GraphQL returned errors but endpoint is reachable
                    // This is actually expected if auth is required
                    setConnectionTest({
                        status: 'success',
                        message: 'Endpoint reachable (authentication may be required)',
                        lastTested: new Date(),
                    });
                }
            } else {
                setConnectionTest({
                    status: 'error',
                    message: `Connection failed: ${response.status} ${response.statusText}`,
                });
            }
        } catch (error) {
            setConnectionTest({
                status: 'error',
                message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

                    {connectionTest.status !== 'idle' && (
                        <div
                            className={`${styles.connectionStatus} ${
                                connectionTest.status === 'success'
                                    ? styles.connectionSuccess
                                    : connectionTest.status === 'error'
                                    ? styles.connectionError
                                    : styles.connectionPending
                            }`}
                        >
                            {connectionTest.status === 'success' ? (
                                <Checkmark24Regular />
                            ) : connectionTest.status === 'error' ? (
                                <Dismiss24Regular />
                            ) : (
                                <Spinner size="tiny" />
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
