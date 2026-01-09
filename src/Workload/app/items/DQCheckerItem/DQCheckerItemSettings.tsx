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
} from '@fluentui/react-icons';
import { getWorkloadItem, saveWorkloadItem, ItemWithDefinition } from '../../controller/ItemCRUDController';
import { PageProps } from '../../App';

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

// Default settings (GraphQL removed - using OneLake JSON now)
const DEFAULT_SETTINGS: DQCheckerSettings = {
    defaultOwner: '',
    defaultSeverity: 'medium',
    defaultDimension: 'completeness',
    defaultTags: '',
};

// Settings interface
export interface DQCheckerSettings {
    defaultOwner: string;
    defaultSeverity: string;
    defaultDimension: string;
    defaultTags: string;
}

// Use PageProps (same pattern as Data Lineage) - workloadClient is REQUIRED
export const DQCheckerItemSettings: React.FC<PageProps> = ({
    workloadClient,
}) => {
    const styles = useStyles();
    const { itemObjectId } = useParams<{ itemObjectId: string }>();

    // State - following Data Lineage pattern for Fabric persistence
    const [item, setItem] = useState<ItemWithDefinition<DQCheckerSettings> | null>(null);
    const [settings, setSettings] = useState<DQCheckerSettings>(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isDirty, setIsDirty] = useState(false);

    // Load settings from Fabric item definition (same pattern as Data Lineage)
    const loadSettings = useCallback(async () => {
        console.log('[Settings] loadSettings called', { itemObjectId, hasWorkloadClient: !!workloadClient });

        if (!workloadClient) {
            console.error('[Settings] No workloadClient provided');
            setMessage({ type: 'error', text: 'Workload client not available. Please reopen Settings.' });
            setIsLoading(false);
            return;
        }

        if (!itemObjectId) {
            console.error('[Settings] No itemObjectId in URL');
            setMessage({ type: 'error', text: 'No item ID in URL. Please reopen Settings from item editor.' });
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            // Load from Fabric backend via ItemCRUDController
            console.log('[Settings] Calling getWorkloadItem', { itemObjectId });
            const loadedItem = await getWorkloadItem<DQCheckerSettings>(
                workloadClient,
                itemObjectId,
                DEFAULT_SETTINGS  // fallback if no saved definition
            );
            console.log('[Settings] Loaded item', { id: loadedItem.id, hasDefinition: !!loadedItem.definition });

            if (!loadedItem.id) {
                console.error('[Settings] Item loaded but has no ID - fetch may have failed');
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
            console.error('[Settings] Failed to load settings from Fabric', error instanceof Error ? error.message : String(error));
            // Keep default settings on error
            setMessage({ type: 'error', text: 'Failed to load settings from Fabric' });
        } finally {
            setIsLoading(false);
        }
    }, [workloadClient, itemObjectId]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    // Save settings to Fabric item definition (same pattern as Data Lineage)
    const handleSave = async () => {
        console.log('[Settings] handleSave called', { itemId: item?.id, hasItem: !!item });

        if (!item) {
            console.error('[Settings] Cannot save: item is null');
            setMessage({ type: 'error', text: 'Cannot save: item not loaded. Try reloading the page.' });
            return;
        }

        if (!item.id) {
            console.error('[Settings] Cannot save: item has no ID', { item });
            setMessage({ type: 'error', text: 'Cannot save: item has no ID. Item may not have loaded correctly.' });
            return;
        }

        setIsSaving(true);
        setMessage(null);
        try {
            console.log('[Settings] Calling saveWorkloadItem', { itemId: item.id, settings });
            // Save to Fabric backend via ItemCRUDController
            await saveWorkloadItem<DQCheckerSettings>(workloadClient, {
                ...item,
                definition: settings,
            });

            // Small delay to ensure Fabric has committed the change (eventual consistency)
            await new Promise(resolve => setTimeout(resolve, 500));

            console.log('[Settings] Settings saved successfully');
            setMessage({ type: 'success', text: 'Settings saved to Fabric successfully' });
            setIsDirty(false);
        } catch (error) {
            console.error('[Settings] Failed to save settings to Fabric', error instanceof Error ? error.message : String(error));
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
    };

    // TODO: Add DWH connection dropdown (select from sources stored in OneLake JSON)
    // This will allow users to select a default target DWH for Soda checks

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
