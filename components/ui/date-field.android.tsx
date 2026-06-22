import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Row, Text, FilledTonalButton } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';

import { useThemeColors } from '@/constants/theme';
import { androidMaterial } from '@/constants/android-material';

// A compact, native date/time field for the Android forms. The old inline
// `@expo/ui` DateTimePicker rendered a full month-grid calendar (or a clock)
// permanently in the form — hundreds of dp tall, and the source of the
// "infinity maximum width" Compose crash. This replaces it with the standard
// Android pattern: a labelled row whose trailing chip shows the current value,
// and tapping it opens the native modal date/time dialog
// (`DateTimePickerAndroid`, the AOSP picker). One tappable chip instead of a
// wall of calendar, and the picker chrome is fully native.

function formatDate(d: Date): string {
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Local-noon parse of a 'YYYY-MM-DD' string — avoids the UTC day-shift that
 * `new Date('2026-06-22')` introduces in negative-offset timezones. */
export function ymdToLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function DateField({
  label,
  value,
  mode = 'date',
  onChange,
}: {
  label: string;
  value: Date;
  mode?: 'date' | 'time';
  onChange: (date: Date) => void;
}) {
  const c = useThemeColors();
  const m = androidMaterial(c);

  const open = () => {
    DateTimePickerAndroid.open({
      value,
      mode,
      onChange: (event, selected) => {
        // 'set' fires on confirm; 'dismissed' on cancel — only commit on confirm.
        if (event.type === 'set' && selected) onChange(selected);
      },
    });
  };

  return (
    <Row
      modifiers={[fillMaxWidth()]}
      horizontalArrangement="spaceBetween"
      verticalAlignment="center"
    >
      <Text color={c.text}>{label}</Text>
      <FilledTonalButton onClick={open} colors={m.tonalButton}>
        {/* Text inherits the button's content colour (accent). */}
        <Text>{mode === 'time' ? formatTime(value) : formatDate(value)}</Text>
      </FilledTonalButton>
    </Row>
  );
}
