import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { CalendarGrid, QuickChip, sameDay } from '@/components/CalendarGrid';
import { useT } from '@/i18n';
import { spacing } from '@/theme/themes';

interface DatePickerSheetProps {
  value: Date;
  title?: string;
  onPick: (day: Date) => void;
  onClose: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Jump to a single day: one tap picks it and closes the sheet. */
export function DatePickerSheet({ value, title, onPick, onClose }: DatePickerSheetProps) {
  const { t } = useT();
  const today = new Date();
  const shortcuts = [
    { label: t('common.yesterday'), day: new Date(today.getTime() - DAY_MS) },
    { label: t('common.today'), day: today },
    { label: t('common.tomorrow'), day: new Date(today.getTime() + DAY_MS) },
  ];

  return (
    <BottomSheet visible onClose={onClose}>
      <View style={{ gap: spacing.lg }}>
        <AppText variant="title">{title ?? t('calendar.goToDate')}</AppText>
        <CalendarGrid
          from={value}
          onPick={onPick}
          shortcuts={shortcuts.map((s) => (
            <QuickChip key={s.label} label={s.label} selected={sameDay(value, s.day)} onPress={() => onPick(s.day)} />
          ))}
        />
      </View>
    </BottomSheet>
  );
}
