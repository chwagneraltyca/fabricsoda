/**
 * DeleteConfirmDialog Component
 *
 * Confirmation dialog for deleting data sources.
 * Matches legacy Flask modal styling.
 *
 * Legacy reference: Legacy/flask_app/templates/data_sources/manage.html (delete modal)
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Spinner,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Warning24Regular } from '@fluentui/react-icons';
import { dqColors, dqTypography } from '../../../../styles/tokens';

const useStyles = makeStyles({
  dialog: {
    maxWidth: '448px', // max-w-md
    width: '100%',
  },

  content: {
    textAlign: 'center' as const,
  },

  iconContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: tokens.spacingVerticalM,
  },

  warningIcon: {
    width: '56px',
    height: '56px',
    color: dqColors.danger600,
  },

  title: {
    fontSize: dqTypography.fontSizeLg,
    fontWeight: dqTypography.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: tokens.spacingVerticalXS,
  },

  message: {
    fontSize: dqTypography.fontSizeSm,
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalM,
  },

  sourceName: {
    fontWeight: dqTypography.fontWeightMedium,
    color: tokens.colorNeutralForeground1,
  },

  warning: {
    fontSize: dqTypography.fontSizeXs,
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic' as const,
  },

  actions: {
    display: 'flex',
    justifyContent: 'center',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalL,
  },

  deleteButton: {
    backgroundColor: dqColors.danger600,
    color: 'white',
    '&:hover': {
      backgroundColor: dqColors.danger700,
    },
  },
});

interface DeleteConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Name of the source being deleted */
  sourceName: string;
  /** Callback when dialog closes */
  onClose: () => void;
  /** Callback when delete is confirmed */
  onConfirm: () => Promise<void>;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  sourceName,
  onClose,
  onConfirm,
}) => {
  const styles = useStyles();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = useCallback(async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  }, [onConfirm]);

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className={styles.dialog}>
        <DialogBody>
          <DialogContent className={styles.content}>
            <div className={styles.iconContainer}>
              <Warning24Regular className={styles.warningIcon} />
            </div>
            <DialogTitle className={styles.title}>Delete Connection?</DialogTitle>
            <p className={styles.message}>
              Are you sure you want to delete "<span className={styles.sourceName}>{sourceName}</span>"?
            </p>
            <p className={styles.warning}>
              This action cannot be undone.
            </p>
          </DialogContent>

          <DialogActions className={styles.actions}>
            <Button
              appearance="secondary"
              onClick={onClose}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              appearance="primary"
              className={styles.deleteButton}
              onClick={handleConfirm}
              disabled={isDeleting}
              icon={isDeleting ? <Spinner size="tiny" /> : undefined}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
