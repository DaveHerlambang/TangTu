import { AppText } from '@/components/AppText';
import { TextField, type TextFieldProps } from '@/components/TextField';
import { CURRENCY_SYMBOL, formatThousands, parseDigits } from '@/utils/format';

interface CurrencyFieldProps extends Omit<TextFieldProps, 'value' | 'onChangeText' | 'keyboardType' | 'leading'> {
  value: number | null;
  onChangeValue: (value: number | null) => void;
}

/** Up to Rp 9.999.999.999 — far beyond any realistic bonus or penalty. */
const MAX_DIGITS = 10;

/**
 * Rupiah amount input. Shows an "Rp" prefix and groups digits Indonesian-style while typing
 * ("5000000" → "5.000.000"), but reports a plain integer to the caller.
 */
export function CurrencyField({ value, onChangeValue, placeholder = '0', ...rest }: CurrencyFieldProps) {
  return (
    <TextField
      {...rest}
      value={value === null ? '' : formatThousands(value)}
      onChangeText={(text) => {
        const digits = text.replace(/\D/g, '').slice(0, MAX_DIGITS);
        onChangeValue(parseDigits(digits));
      }}
      placeholder={placeholder}
      keyboardType="number-pad"
      inputMode="numeric"
      leading={
        <AppText variant="heading" tone="muted">
          {CURRENCY_SYMBOL}
        </AppText>
      }
    />
  );
}
