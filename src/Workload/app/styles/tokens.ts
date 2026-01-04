/**
 * DQ Checker Design Tokens
 *
 * Centralized styling tokens that match the legacy Flask app's Tailwind design.
 * Use Fabric design tokens where available, with custom tokens for consistency.
 *
 * Legacy colors reference:
 * - Primary: #7C9FF5 (soft blue)
 * - Success: #10B981 / #0D9488 (teal)
 * - Warning: #F59E0B / #D97706 (amber)
 * - Danger: #EF4444 / #E11D48 (rose)
 */

import { tokens, makeStyles, shorthands } from '@fluentui/react-components';

// Legacy-compatible color palette
export const dqColors = {
  // Primary blues
  primary50: '#EFF6FF',
  primary100: '#DBEAFE',
  primary500: '#7C9FF5',
  primary600: '#6B8FE8',
  primary700: '#5A7ED9',

  // Success/passed (teal)
  success50: '#F0FDFA',
  success100: '#CCFBF1',
  success500: '#10B981',
  success600: '#0D9488',
  success700: '#0F766E',

  // Warning (amber)
  warning50: '#FFFBEB',
  warning100: '#FEF3C7',
  warning500: '#F59E0B',
  warning600: '#D97706',
  warning700: '#B45309',

  // Danger/failed (rose)
  danger50: '#FFF1F2',
  danger100: '#FFE4E6',
  danger500: '#EF4444',
  danger600: '#E11D48',
  danger700: '#BE123C',

  // Neutrals (match Tailwind gray)
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
};

// Spacing tokens (match Tailwind defaults)
export const dqSpacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
};

// Typography tokens
export const dqTypography = {
  fontSizeXs: '0.75rem',   // 12px
  fontSizeSm: '0.875rem',  // 14px
  fontSizeMd: '1rem',      // 16px
  fontSizeLg: '1.125rem',  // 18px
  fontSizeXl: '1.25rem',   // 20px
  fontSize2xl: '1.5rem',   // 24px

  fontWeightNormal: 400,
  fontWeightMedium: 500,
  fontWeightSemibold: 600,
  fontWeightBold: 700,

  lineHeightTight: 1.25,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.75,
};

// Shared FluentUI styles that match legacy design
export const useCommonStyles = makeStyles({
  // Card styles (matches legacy .card)
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    boxShadow: tokens.shadow4,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
  },

  cardSpacious: {
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
  },

  // Page header
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalL,
  },

  pageTitle: {
    fontSize: dqTypography.fontSize2xl,
    fontWeight: dqTypography.fontWeightBold,
    color: tokens.colorNeutralForeground1,
    marginBottom: tokens.spacingVerticalXS,
  },

  pageSubtitle: {
    fontSize: dqTypography.fontSizeMd,
    color: tokens.colorNeutralForeground3,
  },

  // Form styles (matches legacy form-label, form-input)
  formLabel: {
    display: 'block',
    fontSize: dqTypography.fontSizeSm,
    fontWeight: dqTypography.fontWeightMedium,
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalXS,
  },

  formHint: {
    fontSize: dqTypography.fontSizeXs,
    color: tokens.colorNeutralForeground3,
    marginTop: '2px',
  },

  formRequired: {
    color: dqColors.danger500,
  },

  // Grid layouts
  gridTwoCols: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: tokens.spacingHorizontalM,
  },

  gridFullWidth: {
    gridColumn: 'span 2',
  },

  // Table styles (matches legacy table)
  tableHeader: {
    backgroundColor: tokens.colorNeutralBackground3,
  },

  tableHeaderCell: {
    fontSize: dqTypography.fontSizeXs,
    fontWeight: dqTypography.fontWeightMedium,
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },

  tableRow: {
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },

  // Badge/status styles
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    ...shorthands.padding('0.25rem', '0.625rem'),
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    fontSize: dqTypography.fontSizeXs,
    fontWeight: dqTypography.fontWeightMedium,
  },

  badgeActive: {
    backgroundColor: dqColors.success100,
    color: dqColors.success700,
  },

  badgeInactive: {
    backgroundColor: dqColors.gray100,
    color: dqColors.gray700,
  },

  badgeType: {
    backgroundColor: dqColors.primary100,
    color: dqColors.primary700,
  },

  // Button styles
  buttonGroup: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    justifyContent: 'flex-end',
  },

  // Empty state
  emptyState: {
    textAlign: 'center' as const,
    ...shorthands.padding(tokens.spacingVerticalXXL, tokens.spacingHorizontalL),
    color: tokens.colorNeutralForeground3,
  },

  // Filter bar
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalL,
  },

  filterCount: {
    marginLeft: 'auto',
    fontSize: dqTypography.fontSizeSm,
    color: tokens.colorNeutralForeground3,
  },
});

// Modal dialog styles
export const useDialogStyles = makeStyles({
  dialog: {
    maxWidth: '672px', // 2xl in Tailwind
    width: '100%',
  },

  dialogHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalL,
  },

  dialogTitle: {
    fontSize: dqTypography.fontSizeXl,
    fontWeight: dqTypography.fontWeightBold,
    color: tokens.colorNeutralForeground1,
  },

  dialogFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalL,
    paddingTop: tokens.spacingVerticalM,
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke2),
  },
});

// Data table styles
export const useDataTableStyles = makeStyles({
  container: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    boxShadow: tokens.shadow4,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    ...shorthands.overflow('hidden'),
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },

  thead: {
    backgroundColor: tokens.colorNeutralBackground3,
  },

  th: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalL),
    textAlign: 'left' as const,
    fontSize: dqTypography.fontSizeXs,
    fontWeight: dqTypography.fontWeightMedium,
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },

  thRight: {
    textAlign: 'right' as const,
  },

  tbody: {
    backgroundColor: tokens.colorNeutralBackground1,
  },

  tr: {
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke2),
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },

  td: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
    fontSize: dqTypography.fontSizeSm,
  },

  tdRight: {
    textAlign: 'right' as const,
  },

  cellPrimary: {
    fontWeight: dqTypography.fontWeightMedium,
    color: tokens.colorNeutralForeground1,
  },

  cellSecondary: {
    color: tokens.colorNeutralForeground3,
  },

  actionsCell: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },
});
