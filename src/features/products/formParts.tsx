import { useState, type ReactNode } from 'react';
import { StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';
import { parseQty, qty } from '@/core/format';
import { C, fonts, Icon, PressableScale, radius, toneColors, Txt } from '@/ui';

/** Thẻ nhóm trường trong form. */
export function FormCard({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      {title ? (
        <Txt variant="heading" style={{ marginTop: 6 }}>
          {title}
        </Txt>
      ) : null}
      {hint ? (
        <Txt variant="caption" color={C.muted}>
          {hint}
        </Txt>
      ) : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

/** Dòng chọn giá trị (mở sheet chọn). */
export function PickRow({
  label,
  value,
  placeholder = 'Chọn',
  onPress,
  disabled,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value || 'chưa chọn'}`}
      scaleTo={0.985}
      style={styles.row}>
      <Txt variant="body" color={C.muted} style={{ flexShrink: 0 }}>
        {label}
      </Txt>
      <Txt variant="body" weight={value ? 'semibold' : 'regular'} color={value ? C.text : C.faint} align="right" numberOfLines={1} style={{ flex: 1 }}>
        {value || placeholder}
      </Txt>
      {onPress && !disabled ? <Icon name="chevron-right" size={16} color={C.faint} /> : null}
    </PressableScale>
  );
}

export function SwitchRow({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="body">{label}</Txt>
        {sub ? (
          <Txt variant="caption" color={C.muted}>
            {sub}
          </Txt>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.brand }} accessibilityLabel={label} />
    </View>
  );
}

/**
 * Ô nhập số trong thẻ form (nhãn trái, số phải). Cho phép số lẻ với dấu phẩy
 * khi `decimal`. Giá trị đổi từ ngoài (vd "Dùng giá tính") thì hiện lại.
 */
export function NumRow({
  label,
  value,
  onChange,
  decimal,
  money,
  suffix,
  editable = true,
  placeholder = '0',
  right,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  decimal?: boolean;
  /** Định dạng tiền (không có số lẻ). */
  money?: boolean;
  suffix?: string;
  editable?: boolean;
  placeholder?: string;
  right?: ReactNode;
}) {
  const [text, setText] = useState(value ? qty(value) : '');
  const shown = parseQty(text) === value ? text : value ? qty(value) : '';
  return (
    <View style={styles.row}>
      <Txt variant="body" color={C.muted} style={{ flexShrink: 1 }}>
        {label}
      </Txt>
      <TextInput
        value={shown}
        onChangeText={(t) => {
          const clean = decimal && !money ? t.replace(/[^\d,]/g, '').replace(/,(?=.*,)/g, '') : t.replace(/[^\d]/g, '');
          const n = parseQty(clean);
          setText(clean && !clean.endsWith(',') ? (decimal && !money ? clean : qty(n)) : clean);
          onChange(n);
        }}
        editable={editable}
        keyboardType={decimal && !money ? 'decimal-pad' : 'number-pad'}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        selectTextOnFocus
        accessibilityLabel={label}
        style={[styles.num, editable ? null : { color: C.muted }]}
      />
      {suffix ? (
        <Txt variant="body" color={C.muted}>
          {suffix}
        </Txt>
      ) : null}
      {right}
    </View>
  );
}

/** Ô nhập chữ trong thẻ form. */
export function TextRow({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  autoCapitalize,
  maxLength,
  keyboardType,
  textContentType,
  right,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'characters' | 'words';
  maxLength?: number;
  keyboardType?: TextInputProps['keyboardType'];
  textContentType?: TextInputProps['textContentType'];
  /** Nút nhỏ bên phải ô (vd "Tra cứu"). */
  right?: ReactNode;
}) {
  return (
    <View style={[styles.textRow, multiline ? { alignItems: 'stretch', flexDirection: 'column', gap: 6 } : null]}>
      <Txt variant="body" color={C.muted} style={multiline ? null : { width: 92, flexShrink: 0 }}>
        {label}
      </Txt>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        maxLength={maxLength}
        keyboardType={keyboardType}
        textContentType={textContentType}
        accessibilityLabel={label}
        style={[styles.text, multiline ? styles.multiline : null]}
      />
      {right}
    </View>
  );
}

/** Hai nút chọn đơn vị nhỏ (kg / g). */
export function UnitToggle<T extends string>({ options, value, onChange, disabled }: { options: T[]; value: T; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <View style={[styles.toggle, disabled ? { opacity: 0.5 } : null]}>
      {options.map((o) => {
        const on = o === value;
        return (
          <PressableScale
            key={o}
            onPress={() => onChange(o)}
            disabled={disabled}
            haptic="selection"
            scaleTo={0.9}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o}
            style={[styles.toggleItem, on ? styles.toggleOn : null]}>
            <Txt variant="label" weight="semibold" color={on ? C.white : C.muted}>
              {o}
            </Txt>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function Note({ text, tone = 'info' }: { text: string; tone?: 'info' | 'warning' }) {
  return (
    <View style={[styles.note, { backgroundColor: toneColors[tone].bg }]}>
      <Icon name={tone === 'warning' ? 'triangle-alert' : 'info'} size={16} color={toneColors[tone].fg} />
      <Txt variant="caption" color={toneColors[tone].fg} style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    paddingHorizontal: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingVertical: 6 },
  num: {
    flex: 1,
    minWidth: 80,
    textAlign: 'right',
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: C.text,
    paddingVertical: 8,
  },
  textRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingVertical: 8 },
  text: { flex: 1, minWidth: 0, fontSize: 16, fontFamily: fonts.regular, color: C.text, paddingVertical: 6 },
  multiline: { minHeight: 72, textAlignVertical: 'top', paddingTop: 4 },
  toggle: { flexDirection: 'row', borderRadius: radius.pill, backgroundColor: '#EEF2F6', padding: 2 },
  toggleItem: { minWidth: 36, height: 28, paddingHorizontal: 8, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  toggleOn: { backgroundColor: C.brand },
  note: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: 10, alignItems: 'flex-start', marginBottom: 10 },
});
