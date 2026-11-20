import { useRef, useState, type Ref } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { decimalInput, decimalText, money, parseMoney, parseQty, qty } from '@/core/format';
import { Icon } from './icons';
import { PressableScale } from './motion';
import { TextField, type TextInputRef } from './TextField';
import { Txt } from './Text';
import { C, fonts, radius, toneColors } from './theme';

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

/** Ô nhập tiền: hiện dấu phẩy ngăn hàng nghìn, bàn phím số. */
export function MoneyField({
  label,
  value,
  onChange,
  error,
  placeholder = '0',
  suffix = '₫',
  editable = true,
  bold,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  error?: string;
  placeholder?: string;
  suffix?: string;
  editable?: boolean;
  /** Số tiền in đậm (khoản cần chú ý như tiền mặt cần thu). */
  bold?: boolean;
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
      style={bold && value ? { fontFamily: fonts.bold } : undefined}
      right={
        <Txt variant="body" weight={bold ? 'semibold' : undefined} color={C.muted}>
          {suffix}
        </Txt>
      }
    />
  );
}

/** Chữ số lượng đang gõ: chỉ giữ số và 1 dấu chấm thập phân (phẩy cũng thành chấm). */
const cleanQty = decimalInput;

/** Ô nhập số lượng (cho phép số lẻ với dấu chấm, vd 2.5). */
export function QtyField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(decimalText(value));
  return (
    <TextField
      label={label}
      value={text}
      onChangeText={(t) => {
        const clean = cleanQty(t);
        setText(clean);
        onChange(parseQty(clean));
      }}
      keyboardType="decimal-pad"
      placeholder="0"
      selectTextOnFocus
    />
  );
}

/**
 * Nút − số lượng +.
 *  - Bấm vào số ở giữa để gõ số lượng (ghi ngay khi số hợp lệ; gõ dở / không
 *    hợp lệ thì rời ô sẽ trả về số cũ). `editable={false}`: chỉ hiện số.
 *  - Ở mức thấp nhất, nút − thành nút xóa (thùng rác đỏ): gọi `onRemove` nếu
 *    có (nơi gọi tự hỏi lại), không thì đưa về 0 khi `min` là 0. Nhờ vậy không
 *    cần nút xóa riêng nằm sát nút −, dễ bấm nhầm.
 *  - Nút nhìn 40pt, vùng chạm khoảng 44–48pt (chuẩn tối thiểu iOS / Android).
 */
export function QtyStepper({
  value,
  onChange,
  onRemove,
  min = 0,
  max,
  size = 'medium',
  label,
  editable = true,
}: {
  value: number;
  onChange: (n: number) => void;
  /** Bấm nút − khi đã ở mức thấp nhất (`min`): xóa dòng này. */
  onRemove?: () => void;
  min?: number;
  /** Không cho tăng quá số này. */
  max?: number;
  size?: 'small' | 'medium';
  label: string;
  editable?: boolean;
}) {
  const h = size === 'small' ? 40 : 44;
  // Nút − đang là nút xóa: đã ở mức thấp nhất mà có onRemove, hoặc còn ≤ 1 mà được về 0.
  const removing = onRemove ? value <= min : min === 0 && value > 0 && value <= 1;
  const canMinus = removing || value > min;
  const canPlus = max === undefined || value < max;
  // Chữ đang gõ; null = không gõ (hiện số của giỏ).
  const [text, setText] = useState<string | null>(null);
  const input = useRef<TextInputRef>(null);
  const shown = text ?? qty(value);
  const step = (n: number) => {
    // Đang gõ mà bấm − / +: thôi gõ, lấy số mới.
    if (text !== null) {
      setText(null);
      input.current?.blur();
    }
    onChange(n);
  };
  return (
    <View style={[styles.stepper, { height: h }]} accessibilityLabel={`${label}: ${qty(value)}`}>
      <PressableScale
        onPress={() => (removing && onRemove ? onRemove() : step(Math.max(min, value - 1)))}
        disabled={!canMinus}
        accessibilityLabel={removing ? `Xóa ${label}` : `Giảm ${label}`}
        haptic="selection"
        // Vùng chạm nới ra phía ngoài, không lấn sang ô số ở giữa.
        hitSlop={MINUS_SLOP}
        scaleTo={0.85}
        style={[styles.stepBtn, { width: h, height: h }]}>
        {removing ? (
          <Icon name="trash" size={19} color={toneColors.danger.fg} strokeWidth={2.1} />
        ) : (
          <Icon name="minus" size={20} color={canMinus ? C.brand : C.faint} strokeWidth={2.4} />
        )}
      </PressableScale>
      {editable ? (
        <TextInput
          ref={input}
          value={shown}
          onFocus={() => setText(decimalText(value))}
          onBlur={() => setText(null)}
          onChangeText={(t) => {
            const clean = cleanQty(t);
            setText(clean);
            const n = parseQty(clean);
            if (n > 0 && n >= min && (max === undefined || n <= max)) onChange(n);
          }}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          maxLength={9}
          accessibilityLabel={`Số lượng ${label}`}
          accessibilityHint="Bấm để nhập số lượng"
          // Bề rộng theo số đang hiện: ô nhập không tự co theo chữ (web mặc định rất rộng).
          style={[styles.qtyInput, { height: h - 8, width: Math.max(44, shown.length * 9 + 14) }]}
        />
      ) : (
        <Txt variant="body" weight="semibold" numeric align="center" style={{ minWidth: 36 }}>
          {qty(value)}
        </Txt>
      )}
      <PressableScale
        onPress={() => step(max === undefined ? value + 1 : Math.min(max, value + 1))}
        disabled={!canPlus}
        accessibilityLabel={`Tăng ${label}`}
        haptic="selection"
        hitSlop={PLUS_SLOP}
        scaleTo={0.85}
        style={[styles.stepBtn, { width: h, height: h }]}>
        <Icon name="plus" size={20} color={canPlus ? C.brand : C.faint} strokeWidth={2.4} />
      </PressableScale>
    </View>
  );
}

const MINUS_SLOP = { top: 4, bottom: 4, left: 4, right: 0 } as const;
const PLUS_SLOP = { top: 4, bottom: 4, left: 0, right: 4 } as const;

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
  // Ô số gõ được: nền trắng để biết bấm vào sửa được.
  qtyInput: {
    minWidth: 44,
    paddingHorizontal: 4,
    paddingVertical: 0,
    borderRadius: 8,
    backgroundColor: C.card,
    fontSize: 15,
    fontFamily: fonts.semibold,
    fontVariant: ['tabular-nums'],
    color: C.text,
    textAlign: 'center',
  },
});
