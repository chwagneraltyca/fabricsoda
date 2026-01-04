/**
 * DQCheckerItemHelp
 *
 * Help dialog component for DQ Checker workload.
 * Displays quick-start guide and feature overview.
 * Opened via ribbon button - follows MS Fabric SDK dialog pattern.
 */

import React from 'react';
import {
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Text,
    Divider,
    Accordion,
    AccordionItem,
    AccordionHeader,
    AccordionPanel,
    Link,
    makeStyles,
    tokens,
} from '@fluentui/react-components';
import {
    Dismiss24Regular,
    Database24Regular,
    Checkmark24Regular,
    DataBarVertical24Regular,
    Play24Regular,
    Settings24Regular,
    DocumentText24Regular,
    Question24Regular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
    dialog: {
        maxWidth: '600px',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalM,
        marginBottom: tokens.spacingVerticalM,
    },
    headerIcon: {
        color: tokens.colorBrandForeground1,
    },
    section: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
        marginBottom: tokens.spacingVerticalM,
    },
    sectionTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
    },
    content: {
        color: tokens.colorNeutralForeground2,
        lineHeight: tokens.lineHeightBase300,
    },
    accordionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
    },
    footer: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: tokens.spacingVerticalM,
    },
    footerLinks: {
        display: 'flex',
        gap: tokens.spacingHorizontalM,
    },
    footerMeta: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
    },
});

interface DQCheckerItemHelpProps {
    open: boolean;
    onClose: () => void;
}

export const DQCheckerItemHelp: React.FC<DQCheckerItemHelpProps> = ({
    open,
    onClose,
}) => {
    const styles = useStyles();

    return (
        <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
            <DialogSurface className={styles.dialog}>
                <DialogBody>
                    <DialogTitle
                        action={
                            <Button
                                appearance="subtle"
                                aria-label="Close"
                                icon={<Dismiss24Regular />}
                                onClick={onClose}
                            />
                        }
                    >
                        <div className={styles.header}>
                            <Question24Regular className={styles.headerIcon} />
                            <Text size={500} weight="semibold">DQ Checker Help</Text>
                        </div>
                    </DialogTitle>

                    <DialogContent>
                        {/* Overview */}
                        <div className={styles.section}>
                            <Text className={styles.content}>
                                DQ Checker validates data quality in your Fabric Data Warehouses
                                using Soda Core. Define checks, group them into test cases,
                                and run scans to ensure data meets your quality standards.
                            </Text>
                        </div>

                        <Divider />

                        {/* Quick Start Accordion */}
                        <Accordion collapsible defaultOpenItems={['data-sources']}>
                            {/* Data Sources */}
                            <AccordionItem value="data-sources">
                                <AccordionHeader>
                                    <div className={styles.accordionHeader}>
                                        <Database24Regular />
                                        <Text weight="semibold">1. Connect Data Sources</Text>
                                    </div>
                                </AccordionHeader>
                                <AccordionPanel>
                                    <Text className={styles.content}>
                                        Go to the <strong>Data Sources</strong> tab and add your Fabric
                                        Data Warehouse connection. DQ Checker will discover schemas,
                                        tables, and columns automatically.
                                    </Text>
                                </AccordionPanel>
                            </AccordionItem>

                            {/* Checks */}
                            <AccordionItem value="checks">
                                <AccordionHeader>
                                    <div className={styles.accordionHeader}>
                                        <Checkmark24Regular />
                                        <Text weight="semibold">2. Define Quality Checks</Text>
                                    </div>
                                </AccordionHeader>
                                <AccordionPanel>
                                    <Text className={styles.content}>
                                        Use the <strong>Checks</strong> tab to create data quality checks.
                                        Choose from 22+ templates: row counts, null checks, range validation,
                                        foreign key checks, freshness, schema validation, and custom SQL.
                                    </Text>
                                </AccordionPanel>
                            </AccordionItem>

                            {/* Results */}
                            <AccordionItem value="results">
                                <AccordionHeader>
                                    <div className={styles.accordionHeader}>
                                        <DataBarVertical24Regular />
                                        <Text weight="semibold">3. View Results</Text>
                                    </div>
                                </AccordionHeader>
                                <AccordionPanel>
                                    <Text className={styles.content}>
                                        After running a scan, view results in the <strong>Results</strong> tab.
                                        See pass/fail status, metrics, and trends over time.
                                        Drill into failed checks to understand issues.
                                    </Text>
                                </AccordionPanel>
                            </AccordionItem>

                            {/* Execution */}
                            <AccordionItem value="execution">
                                <AccordionHeader>
                                    <div className={styles.accordionHeader}>
                                        <Play24Regular />
                                        <Text weight="semibold">4. Run Scans</Text>
                                    </div>
                                </AccordionHeader>
                                <AccordionPanel>
                                    <Text className={styles.content}>
                                        Execute scans using a Fabric Python Notebook. The notebook reads
                                        check definitions, generates SodaCL YAML, runs the scan,
                                        and writes results back to the database.
                                    </Text>
                                </AccordionPanel>
                            </AccordionItem>

                            {/* Settings */}
                            <AccordionItem value="settings">
                                <AccordionHeader>
                                    <div className={styles.accordionHeader}>
                                        <Settings24Regular />
                                        <Text weight="semibold">5. Configure Preferences</Text>
                                    </div>
                                </AccordionHeader>
                                <AccordionPanel>
                                    <Text className={styles.content}>
                                        Click <strong>Settings</strong> in the ribbon to set default values
                                        for owner, severity, DQ dimension, and tags. These defaults
                                        pre-populate when creating new checks.
                                    </Text>
                                </AccordionPanel>
                            </AccordionItem>
                        </Accordion>

                        <Divider />

                        {/* Supported Check Types */}
                        <div className={styles.section}>
                            <div className={styles.sectionTitle}>
                                <DocumentText24Regular />
                                <Text weight="semibold">Supported Check Types (20)</Text>
                            </div>
                            <Text className={styles.content}>
                                <strong>Core:</strong> row_count, missing_count, missing_percent,
                                duplicate_count, duplicate_percent, min, max, avg, sum,
                                invalid_count, invalid_percent, valid_count, avg_length, min_length
                            </Text>
                            <Text className={styles.content}>
                                <strong>Advanced:</strong> freshness, schema, reference, custom_sql,
                                user_defined, scalar_comparison
                            </Text>
                        </div>

                        {/* Footer */}
                        <div className={styles.footer}>
                            <div className={styles.footerLinks}>
                                <Link href="https://docs.soda.io/soda-core/overview.html" target="_blank">
                                    Soda Docs
                                </Link>
                                <Link href="https://learn.microsoft.com/en-us/fabric/" target="_blank">
                                    Fabric Docs
                                </Link>
                            </div>
                            <Text className={styles.footerMeta}>
                                v1.0.0 | Built with Soda Core
                            </Text>
                        </div>
                    </DialogContent>

                    <DialogActions>
                        <Button appearance="primary" onClick={onClose}>
                            Got it
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};

export default DQCheckerItemHelp;
