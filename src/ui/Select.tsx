import { useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Modal, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from './Feedback';
import { SheetHeader } from './Header';
import { SearchField } from './Inputs';
import { Icon } from './icons';
import { PressableScale } from './motion';
import { Txt } from './Text';
import { C, radius } from './theme';

export interface SelectOption<T> {
  value: T;
  label: string;
  /** Dòng phụ dưới tên (vd chủ tài khoản). */
  sub?: string | null;
}

/** Nhiều hơn số này thì sheet có ô tìm. */
const SEARCH_AFTER = 8;

/** Bỏ dấu, chữ thường để tìm "tra" ra "Trà". */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

/** Bảng chọn nhanh kiểu iOS (ít lựa chọn, vd sắp xếp); mục đang chọn có dấu ✓. */
export function pickFromSheet<T>(
  title: string,
  items: { value: T; label: string; destructive?: boolean }[],
  current: T | null,
  onPick: (v: T) => void,
) {
  const labels = items.map((it) => (it.value === current ? `✓ ${it.label}` : it.label));
  if (Platform.OS === 'ios') {
    const destructive = items.findIndex((it) => it.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...labels, 'Hủy'],
        cancelButtonIndex: labels.length,
        destructiveButtonIndex: destructive >= 0 ? destructive : undefined,
      },
      (i) => {
        if (i < items.length) onPick(items[i].value);
      },
    );
    return;
  }
  Alert.alert(title, undefined, [
    ...items.map((it, i) => ({ text: labels[i], onPress: () => onPick(it.value), style: it.destructive ? ('destructive' as const) : undefined })),
    { text: 'Hủy', style: 'cancel' as const },
  ]);
}

/** "Trà" · "Trà, Siro" · "Trà, Siro +3". */
export function selectSummary(labels: string[], none: string): string {
  if (labels.length === 0) return none;
  if (labels.length <= 2) return labels.join(', ');
  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
}

function SelectSheet<T>({
  title,
  options,
  selected,
  multiple,
  clearLabel,
  onPick,
  onDone,
  onClose,
}: {
  title: string;
  options: SelectOption<T>[];
  selected: readonly T[];
  multiple: boolean;
  /** Dòng đầu danh sách để bỏ chọn (vd "Tất cả"). */
  clearLabel?: string;
  onPick: (v: T | null) => void;
  onDone?: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const key = fold(q);
  const shown = key ? options.filter((o) => fold(`${o.label} ${o.sub ?? ''}`).includes(key)) : options;
  const rows: (SelectOption<T> | null)[] = clearLabel && !key ? [null, ...shown] : shown;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title={title} onCancel={onClose} actionLabel={multiple ? 'Xong' : undefined} onAction={onDone} />
      {options.length > SEARCH_AFTER ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <SearchField value={q} onChangeText={setQ} placeholder={`Tìm ${title.toLowerCase()}`} />
        </View>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(o, i) => (o ? `v-${String(o.value)}` : `clear-${i}`)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        ListEmptyComponent={<EmptyState icon="search" color="slate" title="Không có kết quả" message="Thử gõ tên khác." />}
        renderItem={({ item }) => {
          const on = item ? selected.includes(item.value) : selected.length === 0;
          const label = item ? item.label : (clearLabel ?? '');
          return (
            <PressableScale
              onPress={() => onPick(item ? item.value : null)}
              haptic="selection"
              accessibilityRole={multiple && item ? 'checkbox' : 'button'}
              accessibilityState={multiple && item ? { checked: on } : { selected: on }}
              accessibilityLabel={[label, item?.sub].filter(Boolean).join(', ')}
              scaleTo={0.985}
              style={[styles.row, on ? styles.rowOn : null]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="body" weight={on ? 'semibold' : 'medium'} numberOfLines={2} numeric>
                  {label}
                </Txt>
                {item?.sub ? (
                  <Txt variant="caption" color={C.muted} numberOfLines={1}>
                    {item.sub}
                  </Txt>
                ) : null}
              </View>
              {multiple && item ? (
                <View style={[styles.box, on ? styles.boxOn : null]}>{on ? <Icon name="check" size={14} color={C.white} strokeWidth={3} /> : null}</View>
              ) : on ? (
                <Icon name="check" size={20} color={C.brand} strokeWidth={2.4} />
              ) : null}
            </PressableScale>
          );
        }}
      />
    </View>
  );
}

interface FieldProps {
  /** Nhãn của ô, cũng là tiêu đề sheet chọn. */
  label: string;
  /** Chữ hiện khi chưa chọn gì. */
  placeholder?: string;
  disabled?: boolean;
  /** `row`: dòng trong thẻ form (nhãn trái, giá trị phải). `field`: ô có viền, nhãn phía trên. */
  variant?: 'row' | 'field';
}

export function SelectTrigger({
  label,
  text,
  sub,
  empty,
  variant,
  disabled,
  onPress,
}: {
  label: string;
  text: string;
  sub?: string | null;
  empty: boolean;
  variant: 'row' | 'field';
  disabled?: boolean;
  onPress: () => void;
}) {
  if (variant === 'field') {
    return (
      <View style={{ gap: 6 }}>
        <Txt variant="label" weight="semibold">
          {label}
        </Txt>
        <PressableScale
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${empty ? 'chưa chọn' : text}`}
          scaleTo={0.985}
          style={[styles.field, disabled ? { opacity: 0.6 } : null]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="body" weight={empty ? 'regular' : 'semibold'} color={empty ? C.faint : C.text} numberOfLines={1} numeric>
              {text}
            </Txt>
            {sub ? (
              <Txt variant="caption" color={C.muted} numberOfLines={1}>
                {sub}
              </Txt>
            ) : null}
          </View>
          <Icon name="chevron-down" size={18} color={C.muted} />
        </PressableScale>
      </View>
    );
  }
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${text}`}
      scaleTo={0.985}
      style={[styles.inline, disabled ? { opacity: 0.6 } : null]}>
      <Txt variant="body" color={C.muted} style={{ flexShrink: 0 }}>
        {label}
      </Txt>
      <Txt variant="body" weight={empty ? 'regular' : 'semibold'} color={empty ? C.faint : C.brand} align="right" numberOfLines={1} style={{ flex: 1 }}>
        {text}
      </Txt>
      <Icon name="chevron-right" size={16} color={C.faint} />
    </PressableScale>
  );
}

/**
 * Ô chọn 1 giá trị: bấm mở sheet danh sách (có ô tìm khi nhiều mục).
 * `clearLabel` thêm dòng đầu để bỏ chọn (vd "Tất cả").
 */
export function Select<T>({
  label,
  options,
  value,
  onChange,
  clearLabel,
  placeholder = 'Chọn',
  disabled,
  variant = 'row',
}: FieldProps & {
  options: SelectOption<T>[];
  value: T | null;
  onChange: (v: T | null) => void;
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = value === null ? undefined : options.find((o) => o.value === value);
  return (
    <>
      <SelectTrigger
        label={label}
        text={current?.label ?? clearLabel ?? placeholder}
        sub={current?.sub}
        empty={!current}
        variant={variant}
        disabled={disabled}
        onPress={() => setOpen(true)}
      />
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        {open ? (
          <SelectSheet
            title={label}
            options={options}
            selected={value === null ? [] : [value]}
            multiple={false}
            clearLabel={clearLabel}
            onPick={(v) => {
              setOpen(false);
              onChange(v);
            }}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </Modal>
    </>
  );
}

/** Ô chọn nhiều giá trị: chọn trong sheet rồi bấm "Xong". Chưa chọn gì = `placeholder` (vd "Tất cả"). */
export function MultiSelect<T>({
  label,
  options,
  value,
  onChange,
  placeholder = 'Tất cả',
  disabled,
  variant = 'row',
}: FieldProps & {
  options: SelectOption<T>[];
  value: readonly T[];
  onChange: (v: T[]) => void;
}) {
  const [draft, setDraft] = useState<T[] | null>(null);
  const labels = options.filter((o) => value.includes(o.value)).map((o) => o.label);
  return (
    <>
      <SelectTrigger
        label={label}
        text={selectSummary(labels, placeholder)}
        empty={labels.length === 0}
        variant={variant}
        disabled={disabled}
        onPress={() => setDraft([...value])}
      />
      <Modal visible={draft !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDraft(null)}>
        {draft ? (
          <SelectSheet
            title={label}
            options={options}
            selected={draft}
            multiple
            clearLabel={placeholder}
            onPick={(v) => {
              if (v === null) setDraft([]);
              else setDraft(draft.includes(v) ? draft.filter((x) => x !== v) : [...draft, v]);
            }}
            onDone={() => {
              onChange(draft);
              setDraft(null);
            }}
            onClose={() => setDraft(null)}
          />
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  rowOn: { borderColor: C.brand, borderWidth: 1.5 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#C3CFD9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: C.brand, borderColor: C.brand },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: radius.control,
    borderWidth: 1.2,
    borderColor: '#D5DEE6',
    backgroundColor: C.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingVertical: 6 },
});
