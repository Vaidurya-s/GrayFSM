// UI Component Library — GrayFSM
//
// Hooks/contexts live in their own files (split out so React Refresh can
// fast-refresh component changes without a full reload). The barrel below
// keeps the public import path stable for callers.
export { CommandPalette } from './CommandPalette';
export type { Command } from './CommandPalette';
export { useCommandPalette } from './use-command-palette';

export { Alert } from './Alert';
export type { AlertProps, AlertVariant } from './Alert';

export { Badge } from './Badge';
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge';

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Card, CardHeader, CardBody, CardFooter } from './Card';
export type { CardProps, CardVariant } from './Card';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Modal } from './Modal';
export type { ModalProps, ModalSize } from './Modal';

export { Spinner } from './Spinner';
export type { SpinnerProps, SpinnerSize } from './Spinner';

export { Tabs, TabPanel } from './Tabs';
export type { TabsProps, TabPanelProps, Tab } from './Tabs';

export { ToastProvider } from './Toast';
export { useToast } from './toast-context';
export type { Toast, ToastType } from './toast-context';

export { Tooltip } from './Tooltip';
export type { TooltipProps, TooltipPlacement } from './Tooltip';

// Datasheet-brutalism primitives (Phase 2 of the redesign).
export { Kicktitle } from './Kicktitle';
export type { KicktitleProps } from './Kicktitle';

export { TypedSection } from './TypedSection';
export type { TypedSectionProps } from './TypedSection';

export { MarginalNote } from './MarginalNote';
export type { MarginalNoteProps } from './MarginalNote';

export { DataBlock } from './DataBlock';
export type { DataBlockProps, DataItem, DataTone } from './DataBlock';

export { RuledTable } from './RuledTable';
export type {
  RuledTableProps,
  RuledColumn,
  RuledColumnAlign,
} from './RuledTable';

export { SpecField } from './SpecField';
export type { SpecFieldProps } from './SpecField';

export { PullFigure } from './PullFigure';
export type { PullFigureProps } from './PullFigure';

export { CommandKey, CommandKeyRow } from './CommandKey';
export type {
  CommandKeyProps,
  CommandKeyButtonProps,
  CommandKeyLinkProps,
  CommandKeyRowProps,
} from './CommandKey';
