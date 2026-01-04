/**
 * DQCheckerItemAbout
 *
 * About page component displayed in Fabric's Settings dialog.
 * Shows version info, documentation links, and support resources.
 * This renders in the outer Fabric toolbar, not inside the iframe editor.
 */

import React from 'react';
import {
    Text,
    Link,
    Badge,
    Divider,
    makeStyles,
    tokens,
} from '@fluentui/react-components';
import {
    Info24Regular,
    DocumentText24Regular,
    People24Regular,
    Bug24Regular,
    BookQuestionMark24Regular,
} from '@fluentui/react-icons';

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
        gap: tokens.spacingVerticalS,
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        marginBottom: tokens.spacingVerticalXS,
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
    },
    label: {
        minWidth: '120px',
        color: tokens.colorNeutralForeground3,
    },
    linkList: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
        marginLeft: tokens.spacingHorizontalL,
    },
    linkItem: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
    },
    description: {
        color: tokens.colorNeutralForeground2,
        lineHeight: tokens.lineHeightBase300,
    },
});

// Version info - could be moved to environment variables
const VERSION = '1.0.0';
const BUILD_DATE = '2025-01';

export const DQCheckerItemAbout: React.FC = () => {
    const styles = useStyles();

    return (
        <div className={styles.container}>
            {/* Version Info Section */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <Info24Regular />
                    <Text weight="semibold" size={400}>Version Information</Text>
                </div>
                <div className={styles.row}>
                    <Text className={styles.label}>Version:</Text>
                    <Badge appearance="outline" color="informative">{VERSION}</Badge>
                </div>
                <div className={styles.row}>
                    <Text className={styles.label}>Build:</Text>
                    <Text>{BUILD_DATE}</Text>
                </div>
                <div className={styles.row}>
                    <Text className={styles.label}>Status:</Text>
                    <Badge appearance="filled" color="success">POC</Badge>
                </div>
            </div>

            <Divider />

            {/* About Section */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <BookQuestionMark24Regular />
                    <Text weight="semibold" size={400}>About DQ Checker</Text>
                </div>
                <Text className={styles.description}>
                    DQ Checker is a Microsoft Fabric workload for automated data quality validation.
                    It uses Soda Core to execute quality checks against your Fabric Data Warehouses,
                    supporting 22+ check templates including completeness, accuracy, uniqueness,
                    validity, and freshness checks.
                </Text>
            </div>

            <Divider />

            {/* Documentation Links */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <DocumentText24Regular />
                    <Text weight="semibold" size={400}>Documentation</Text>
                </div>
                <div className={styles.linkList}>
                    <div className={styles.linkItem}>
                        <Link href="https://docs.soda.io/soda-core/overview.html" target="_blank">
                            Soda Core Documentation
                        </Link>
                    </div>
                    <div className={styles.linkItem}>
                        <Link href="https://learn.microsoft.com/en-us/fabric/" target="_blank">
                            Microsoft Fabric Documentation
                        </Link>
                    </div>
                    <div className={styles.linkItem}>
                        <Link href="https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/" target="_blank">
                            Fabric Extensibility Toolkit
                        </Link>
                    </div>
                </div>
            </div>

            <Divider />

            {/* Support Section */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <People24Regular />
                    <Text weight="semibold" size={400}>Support</Text>
                </div>
                <div className={styles.linkList}>
                    <div className={styles.linkItem}>
                        <Bug24Regular />
                        <Link href="https://github.com/your-org/dq-checker/issues" target="_blank">
                            Report an Issue
                        </Link>
                    </div>
                    <div className={styles.linkItem}>
                        <People24Regular />
                        <Link href="https://community.fabric.microsoft.com/" target="_blank">
                            Fabric Community
                        </Link>
                    </div>
                </div>
            </div>

            <Divider />

            {/* Check Templates */}
            <div className={styles.section}>
                <Text weight="semibold" size={400}>Supported Check Types</Text>
                <Text className={styles.description}>
                    row_count, missing_count, missing_percent, duplicate_count, duplicate_percent,
                    min, max, avg, sum, invalid_count, invalid_percent, valid_count, avg_length,
                    min_length, freshness, schema, reference, custom_sql, user_defined, scalar_comparison
                </Text>
            </div>
        </div>
    );
};

export default DQCheckerItemAbout;
