import { useState, type Ref } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { money, parseMoney, parseQty, qty } from '@/core/format';
import { Icon } from './icons';
import { PressableScale } from './motion';
import { TextField, type TextInputRef } from './TextField';
import { Txt } from './Text';
import { C, fonts, radius } from './theme';

/** Ô tìm kiếm: kính lúp, nút xóa nhanh. */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Tìm kiếm',
  autoFocus,
  style,
  ref,
  ...rest
}: Omit<TextInputProps, 'style'> & {
  value: string;
  onChangeText: (text: string) => void;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<TextInputRef>;
}) {
  return (
    <View style={[styles.search, style]}>
      <Icon name="search" size={19} color={C.muted} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
        style={styles.searchInput}
        accessibilityLabel={placeholder}
        {...rest}
      />
      {value ? (
        <PressableScale onPress={() => onChangeText('')} accessibilityLabel="Xóa nội dung tìm" hitSlop={10} scaleTo={0.85}>
          <Icon name="circle-x" size={19} color={C.faint} />
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Ô nhập tiền: hiện dấu chấm ngăn cách, bàn phím số. */
export function MoneyField({
  label,
  value,
  onChange,
  error,
  placeholder = '0',
  suffix = '₫',
  editable = true,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  error?: string;
  placeholder?: string;
  suffix?: string;
  editable?: boolean;
}) {
  return (
    <TextField
      label={label}
      value={value ? money(value) : ''}
      onChangeText={(t) => onChange(parseMoney(t))}
      keyboardType="number-pad"
      placeholder={placeholder}
      error={error}
      editable={editable}
      selectTextOnFocus
      right={
        <Txt variant="body" color={C.muted}>
          {suffix}
        </Txt>
      }
    />
  );
}

/** Ô nhập số lượng (cho phép số lẻ với dấu phẩy, vd 2,5). */
export function QtyField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(value ? qty(value) : '');
  return (
    <TextField
      label={label}
      value={text}
      onChangeText={(t) => {
        const clean = t.replace(/[^\d,]/g, '').replace(/,(?=.*,)/g, '');
        setText(clean);
        onChange(parseQty(clean));
      }}
      keyboardType="decimal-pad"
      placeholder="0"
      selectTextOnFocus
    />
  );
}

/** Nút − số lượng +. */
export function QtyStepper({
  value,
  onChange,
  min = 0,
  max,
  size = 'medium',
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  /** Không cho tăng quá số này. */
  max?: number;
  size?: 'small' | 'medium';
  label: string;
}) {
  const h = size === 'small' ? 32 : 38;
  const canMinus = value - 1 >= min;
  const canPlus = max === undefined || value < max;
  return (
    <View style={[styles.stepper, { height: h }]} accessibilityLabel={`${label}: ${qty(value)}`}>
      <PressableScale
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={!canMinus}
        accessibilityLabel={`Giảm ${label}`}
        haptic="selection"
        hitSlop={4}
        scaleTo={0.85}
        style={[styles.stepBtn, { width: h, height: h }]}>
        <Icon name={value <= 1 && min === 0 ? 'trash' : 'minus'} size={17} color={canMinus ? C.brand : C.faint} />
      </PressableScale>
      <Txt variant="body" weight="semibold" numeric align="center" style={{ minWidth: 30 }}>
        {qty(value)}
      </Txt>
      <PressableScale
        onPress={() => onChange(max === undefined ? value + 1 : Math.min(max, value + 1))}
        disabled={!canPlus}
        accessibilityLabel={`Tăng ${label}`}
        haptic="selection"
        hitSlop={4}
        scaleTo={0.85}
        style={[styles.stepBtn, { width: h, height: h }]}>
        <Icon name="plus" size={17} color={canPlus ? C.brand : C.faint} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: radius.control,
    borderWidth: 1.2,
    borderColor: '#D5DEE6',
    backgroundColor: C.card,
  },
  searchInput: { flex: 1, fontSize: 16, fontFamily: fonts.regular, color: C.text, paddingVertical: 10 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.2,
    borderColor: '#CFE3E6',
    backgroundColor: C.brandSoft,
  },
  stepBtn: { alignItems: 'center', justifyContent: 'center' },
});
