// Test stub for `@expo/ui/jetpack-compose`, aliased in vitest.config.ts so the
// Android (Compose) form variants can be rendered in jsdom without the native
// runtime. Interactive controls render as real DOM elements (button / input /
// checkbox / date input) with their Compose handlers wired to DOM events, so
// tests drive them with fireEvent and query by text / role — mirroring how the
// iOS swift-ui tests assert behaviour.
import React from 'react';

type Node = React.ReactNode;

function flattenText(children: Node): string {
  if (children == null || children === false || children === true) return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(flattenText).join('');
  if (React.isValidElement(children)) return flattenText((children.props as { children?: Node }).children);
  return '';
}

const div =
  (testid?: string) =>
  ({ children }: { children?: Node }) =>
    React.createElement('div', testid ? { 'data-testid': testid } : null, children);

// ── Layout / containers ─────────────────────────────────────────────────────
export const Host = div();
export const Column = div();
export const Row = div();
export const Box = div();
export const FlowRow = div();
export const LazyColumn = div();
export const LazyRow = div();
export const Spacer = () => null;

export const Card = div('card');
export const ElevatedCard = div('card');
export const OutlinedCard = div('card');

export const HorizontalDivider = () => React.createElement('hr');
export const VerticalDivider = () => React.createElement('hr');
export const Divider = () => React.createElement('hr');

// ── Text ────────────────────────────────────────────────────────────────────
export const Text = ({ children, color }: { children?: Node; color?: string }) =>
  React.createElement('span', { style: color ? { color } : undefined }, children);

// ── Icon ─────────────────────────────────────────────────────────────────────
export const Icon = ({ contentDescription }: { contentDescription?: string }) =>
  React.createElement('span', { 'data-testid': 'compose-icon', 'aria-label': contentDescription });

// ── Buttons ──────────────────────────────────────────────────────────────────
function button({
  onClick,
  enabled,
  children,
}: {
  onClick?: () => void;
  enabled?: boolean;
  children?: Node;
}) {
  return React.createElement(
    'button',
    { onClick: () => onClick?.(), disabled: enabled === false, type: 'button' },
    children,
  );
}
export const Button = button;
export const FilledTonalButton = button;
export const OutlinedButton = button;
export const ElevatedButton = button;
export const TextButton = button;
export const IconButton = button;
export const FilledIconButton = button;
export const FilledTonalIconButton = button;
export const OutlinedIconButton = button;
export const FloatingActionButton = button;

// Surface is a passthrough, but acts as a button when given an onClick.
export const Surface = ({ onClick, children }: { onClick?: () => void; children?: Node }) =>
  onClick
    ? React.createElement('button', { type: 'button', onClick: () => onClick() }, children)
    : React.createElement('div', null, children);

// ── ListItem (+ slots) ───────────────────────────────────────────────────────
function makeSlots<T extends React.FC<{ children?: Node }>>(base: T) {
  const slot = ({ children }: { children?: Node }) => React.createElement(React.Fragment, null, children);
  return Object.assign(base, {
    HeadlineContent: slot,
    OverlineContent: slot,
    SupportingContent: slot,
    LeadingContent: slot,
    TrailingContent: slot,
  });
}
export const ListItem = makeSlots(({ children }: { children?: Node }) =>
  React.createElement('div', { 'data-testid': 'list-item' }, children),
);

// ── TextField (+ slots) ──────────────────────────────────────────────────────
type ObservableState<V> = { value: V };

interface TextFieldProps {
  value?: ObservableState<string>;
  autoFocus?: boolean;
  onValueChange?: (v: string) => void;
  isError?: boolean;
  children?: Node;
}
function findSlotText(children: Node, slot: React.FC<{ children?: Node }>): string | undefined {
  let found: string | undefined;
  React.Children.forEach(children, (ch) => {
    if (React.isValidElement(ch) && ch.type === slot)
      found = flattenText((ch.props as { children?: Node }).children);
  });
  return found;
}
function makeTextField() {
  const Placeholder = ({ children }: { children?: Node }) => React.createElement(React.Fragment, null, children);
  const Label = ({ children }: { children?: Node }) => React.createElement(React.Fragment, null, children);
  const passSlot = ({ children }: { children?: Node }) => React.createElement(React.Fragment, null, children);
  const Field = (props: TextFieldProps) =>
    React.createElement('input', {
      'data-testid': 'textfield',
      autoFocus: props.autoFocus,
      placeholder: findSlotText(props.children, Placeholder),
      'aria-label': findSlotText(props.children, Label),
      'aria-invalid': props.isError || undefined,
      defaultValue: props.value?.value ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => props.onValueChange?.(e.target.value),
    });
  return Object.assign(Field, {
    Placeholder,
    Label,
    LeadingIcon: passSlot,
    TrailingIcon: passSlot,
    Prefix: passSlot,
    Suffix: passSlot,
    SupportingText: passSlot,
  });
}
export const TextField = makeTextField();
export const OutlinedTextField = makeTextField();

// ── Switch / Checkbox / RadioButton ──────────────────────────────────────────
export const Switch = ({
  value,
  onCheckedChange,
  enabled,
}: {
  value: boolean;
  onCheckedChange?: (v: boolean) => void;
  enabled?: boolean;
}) =>
  React.createElement('input', {
    type: 'checkbox',
    role: 'switch',
    checked: value,
    disabled: enabled === false,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onCheckedChange?.(e.target.checked),
  });
export const Checkbox = ({
  value,
  onCheckedChange,
}: {
  value: boolean;
  onCheckedChange?: (v: boolean) => void;
}) =>
  React.createElement('input', {
    type: 'checkbox',
    checked: value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onCheckedChange?.(e.target.checked),
  });
export const RadioButton = ({ selected, onClick }: { selected?: boolean; onClick?: () => void }) =>
  React.createElement('input', { type: 'radio', checked: !!selected, onChange: () => onClick?.() });

// ── DatePicker dialogs ───────────────────────────────────────────────────────
type DateProps = { initialDate?: string | null; onDateSelected?: (d: Date) => void };
function dateInput(props: DateProps) {
  return React.createElement('input', {
    type: 'date',
    'data-testid': 'datepicker',
    defaultValue: props.initialDate ? String(props.initialDate).slice(0, 10) : '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      props.onDateSelected?.(new Date(`${e.target.value}T00:00:00`)),
  });
}
export const DateTimePicker = dateInput;
export const DatePickerDialog = dateInput;
export const TimePickerDialog = dateInput;

// ── DropdownMenu (+ slots) ───────────────────────────────────────────────────
const passChildren = ({ children }: { children?: Node }) => React.createElement(React.Fragment, null, children);
export const DropdownMenu = Object.assign(passChildren, {
  Trigger: passChildren,
  Items: passChildren,
  Preview: passChildren,
});
export const DropdownMenuItem = Object.assign(
  ({ onClick, children }: { onClick?: () => void; children?: Node }) =>
    React.createElement('button', { type: 'button', onClick: () => onClick?.() }, children),
  {
    Text: passChildren,
    LeadingIcon: passChildren,
    TrailingIcon: passChildren,
  },
);
export const ExposedDropdownMenuBox = passChildren;

// ── Segmented buttons ────────────────────────────────────────────────────────
export const SingleChoiceSegmentedButtonRow = div('segmented-row');
export const MultiChoiceSegmentedButtonRow = div('segmented-row');
export const SegmentedButton = Object.assign(
  ({
    selected,
    checked,
    onClick,
    onCheckedChange,
    children,
  }: {
    selected?: boolean;
    checked?: boolean;
    onClick?: () => void;
    onCheckedChange?: (v: boolean) => void;
    children?: Node;
  }) =>
    React.createElement(
      'button',
      {
        type: 'button',
        'aria-pressed': !!(selected ?? checked),
        onClick: () => {
          onClick?.();
          onCheckedChange?.(!(checked ?? false));
        },
      },
      children,
    ),
  { Label: passChildren },
);

// ── Chips ────────────────────────────────────────────────────────────────────
const chip = Object.assign(
  ({ onClick, children }: { onClick?: () => void; children?: Node }) =>
    React.createElement('button', { type: 'button', onClick: () => onClick?.() }, children),
  { Label: passChildren, LeadingIcon: passChildren, TrailingIcon: passChildren },
);
export const AssistChip = chip;
export const FilterChip = chip;
export const InputChip = chip;
export const SuggestionChip = chip;

// ── Misc passthroughs ────────────────────────────────────────────────────────
export const ModalBottomSheet = div('bottom-sheet');
export const Progress = () => null;
export const LoadingIndicator = () => null;
export const Snackbar = div();

// ── Hooks ────────────────────────────────────────────────────────────────────
export function useNativeState<V>(initial: V): ObservableState<V> {
  return { value: initial };
}
