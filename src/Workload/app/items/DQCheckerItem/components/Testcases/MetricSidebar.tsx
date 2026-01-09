/**
 * MetricSidebar - Categorized metric type selector
 *
 * Displays available check types grouped by category (Completeness, Validity, etc.)
 * with expandable sections. Used in both QuickCheckPanel and TestcaseWizard.
 */

import React, { useState } from 'react';
import {
  Tree,
  TreeItem,
  TreeItemLayout,
  tokens,
  makeStyles,
  Text,
  Tooltip,
} from '@fluentui/react-components';
import {
  ChevronRight16Regular,
  ChevronDown16Regular,
  CheckmarkCircle16Regular,
  DocumentCheckmark16Regular,
  ShieldCheckmark16Regular,
  DataHistogram16Regular,
  Table16Regular,
  Link16Regular,
} from '@fluentui/react-icons';
import {
  MetricType,
  MetricCategory,
  metricCategoryLabels,
  getMetricsByCategory,
} from '../../types/check.types';

const useStyles = makeStyles({
  sidebar: {
    width: '220px',
    minWidth: '220px',
    borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground2,
    padding: tokens.spacingVerticalS,
    overflowY: 'auto',
  },
  categoryItem: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
  },
  metricItem: {
    paddingLeft: tokens.spacingHorizontalL,
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  selectedMetric: {
    backgroundColor: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  metricLabel: {
    fontSize: tokens.fontSizeBase200,
  },
  metricDescription: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
});

// Category icons
const categoryIcons: Record<MetricCategory, React.ReactElement> = {
  completeness: <CheckmarkCircle16Regular />,
  validity: <DocumentCheckmark16Regular />,
  uniqueness: <ShieldCheckmark16Regular />,
  statistics: <DataHistogram16Regular />,
  table_level: <Table16Regular />,
  referential: <Link16Regular />,
};

// Category order for display
const categoryOrder: MetricCategory[] = [
  'completeness',
  'validity',
  'uniqueness',
  'statistics',
  'table_level',
  'referential',
];

export interface MetricSidebarProps {
  selectedMetric: MetricType | null;
  onSelectMetric: (metric: MetricType) => void;
  /** Optional: Filter to show only certain categories */
  showCategories?: MetricCategory[];
}

export const MetricSidebar: React.FC<MetricSidebarProps> = ({
  selectedMetric,
  onSelectMetric,
  showCategories,
}) => {
  const styles = useStyles();
  const [expandedCategories, setExpandedCategories] = useState<Set<MetricCategory>>(
    new Set(categoryOrder)
  );

  const toggleCategory = (category: MetricCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const categoriesToShow = showCategories || categoryOrder;

  return (
    <div className={styles.sidebar}>
      <Tree aria-label="Check types">
        {categoriesToShow.map(category => {
          const metrics = getMetricsByCategory(category);
          const isExpanded = expandedCategories.has(category);

          return (
            <TreeItem
              key={category}
              itemType="branch"
              open={isExpanded}
            >
              <TreeItemLayout
                className={styles.categoryItem}
                iconBefore={categoryIcons[category]}
                expandIcon={isExpanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
                onClick={() => toggleCategory(category)}
              >
                {metricCategoryLabels[category]}
              </TreeItemLayout>

              {isExpanded && metrics.map(metric => (
                <TreeItem
                  key={metric.value}
                  itemType="leaf"
                >
                  <Tooltip
                    content={metric.description}
                    relationship="description"
                    positioning="after"
                  >
                    <TreeItemLayout
                      className={`${styles.metricItem} ${
                        selectedMetric === metric.value ? styles.selectedMetric : ''
                      }`}
                      onClick={() => onSelectMetric(metric.value)}
                    >
                      <Text className={styles.metricLabel}>{metric.label}</Text>
                    </TreeItemLayout>
                  </Tooltip>
                </TreeItem>
              ))}
            </TreeItem>
          );
        })}
      </Tree>
    </div>
  );
};

export default MetricSidebar;
