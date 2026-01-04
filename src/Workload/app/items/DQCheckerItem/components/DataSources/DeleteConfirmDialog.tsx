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
import { WarningRegular } from '@fluentui/react-icons';
import { shorthands } from '@fluentui/react-components';

const useStyles = makeStyles({
  dialog: {
    maxWidth: '448px', // max-w-md
    width: '100%',
  },

  content: {
    textAlign: 'center' as const,
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
  },

  iconContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '72px',
    height: '72px',
    ...shorthands.borderRadius('50%'),
    backgroundColor: tokens.colorPaletteRedBackground1,
    marginLeft: 'auto',
    marginRight: 'auto',
    marginBottom: tokens.spacingVerticalL,
  },

  warningIcon: {
    fontSize: '36px',
    color: tokens.colorPaletteRedForeground1,
  },

  title: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    margin: 0,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
  },

  message: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    margin: 0,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalXS,
  },

  sourceName: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },

  warning: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    margin: 0,
    marginTop: tokens.spacingVerticalXS,
  },

  actions: {
    display: 'flex',
    justifyContent: 'center',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalXL,
    paddingTop: tokens.spacingVerticalM,
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke2),
  },

  deleteButton: {
    backgroundColor: tokens.colorPaletteRedBackground3,
    color: tokens.colorNeutralForegroundOnBrand,
    transition: 'background-color 0.15s ease-out',
    '&:hover': {
      backgroundColor: tokens.colorPaletteRedForeground1,
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
              <WarningRegular className={styles.warningIcon} />
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
