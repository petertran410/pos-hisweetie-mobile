import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isoDate } from '@/core/format';
import { dayText, isRange, monthGrid, pickDay, rangeLabel, type DateRange, type RangeDraft } from '@/core/period';
import { IconButton } from './Button';
import { ChipGroup } from './Cards';
import { SheetHeader } from './Header';
import { PressableScale } from './motion';
import { SelectTrigger } from './Select';
import { Txt } from './Text';
import { C, radius } from './theme';

export interface PeriodOption<K extends string> {
  value: K;
  label: string;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** Chữ hiện cho bộ lọc thời gian: tên kỳ có sẵn hoặc "05/10 – 12/10". */
export function periodText<K extends string>(options: PeriodOption<K>[], value: K | DateRange, now = new Date()): string {
  return isRange(value) ? rangeLabel(value, now) : (options.find((o) => o.value === value)?.label ?? '');
}

function Calendar({ draft, onPick, today }: { draft: RangeDraft; onPick: (day: string) => void; today: string }) {
  const anchor = draft.to ?? draft.from ?? today;
  const [month, setMonth] = useState(() => ({ y: Number(anchor.slice(0, 4)), m: Number(anchor.slice(5, 7)) - 1 }));
  const weeks = monthGrid(month.y, month.m);
  const shift = (n: number) => setMonth((cur) => {
    const d = new Date(cur.y, cur.m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const end = draft.to ?? draft.from;

  return (
    <View style={styles.calendar}>
      <View style={styles.calHead}>
        <IconButton icon="chevron-left" label="Tháng trước" onPress={() => shift(-1)} />
        <Txt variant="heading" align="center" style={{ flex: 1 }}>
          Tháng {month.m + 1}, {month.y}
        </Txt>
        <IconButton icon="chevron-right" label="Tháng sau" onPress={() => shift(1)} />
      </View>
      <View style={styles.week}>
        {WEEKDAYS.map((w) => (
          <Txt key={w} variant="caption" weight="semibold" color={C.muted} align="center" style={styles.cell}>
            {w}
          </Txt>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={styles.cell} />;
            const edge = day === draft.from || day === end;
            const inside = !!draft.from && !!end && day > draft.from && day < end;
            return (
              <View key={di} style={[styles.cell, inside ? styles.inside : null]}>
                <PressableScale
                  onPress={() => onPick(day)}
                  haptic="selection"
                  scaleTo={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={dayText(day)}
                  accessibilityState={{ selected: edge || inside }}
                  style={[styles.day, edge ? styles.dayEdge : null, day === today && !edge ? styles.today : null]}>
                  <Txt
                    variant="body"
                    weight={edge || day === today ? 'semibold' : 'regular'}
                    color={edge ? C.white : inside ? C.brand : C.text}
                    numeric>
                    {Number(day.slice(8, 10))}
                  </Txt>
                </PressableScale>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function DayBox({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <View style={[styles.dayBox, active ? styles.dayBoxOn : null]}>
      <Txt variant="caption" color={C.muted}>
        {label}
      </Txt>
      <Txt variant="body" weight="semibold" color={value ? C.text : C.faint} numeric>
        {value || 'Chọn ngày'}
      </Txt>
    </View>
  );
}

/**
 * Sheet chọn thời gian: chip chọn nhanh (bấm là áp dụng) và lịch để chọn
 * khoảng ngày bất kỳ (bấm ngày bắt đầu rồi ngày kết thúc, rồi "Áp dụng").
 */
export function PeriodSheet<K extends string>({
  title,
  options,
  value,
  initialRange,
  onChange,
  onClose,
}: {
  title: string;
  options: PeriodOption<K>[];
  value: K | DateRange;
  /** Khoảng ngày của kỳ đang chọn, để lịch mở sẵn đúng chỗ. */
  initialRange?: DateRange | null;
  onChange: (v: K | DateRange) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const today = isoDate(new Date());
  const start = isRange(value) ? value : (initialRange ?? null);
  const [draft, setDraft] = useState<RangeDraft>({ from: start?.from ?? null, to: start?.to ?? null });
  const ready = !!draft.from;
  const apply = () => {
    if (!draft.from) return;
    onChange({ from: draft.from, to: draft.to ?? draft.from });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title={title} onCancel={onClose} actionLabel="Áp dụng" onAction={apply} actionDisabled={!ready} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <View style={{ gap: 8 }}>
          <Txt variant="label" weight="semibold" color={C.muted}>
            Chọn nhanh
          </Txt>
          <ChipGroup options={options} value={isRange(value) ? null : value} onChange={(k) => onChange(k)} />
        </View>

        <View style={{ gap: 10 }}>
          <Txt variant="label" weight="semibold" color={C.muted}>
            Hoặc chọn từ ngày đến ngày
          </Txt>
          <View style={styles.boxes}>
            <DayBox label="Từ ngày" value={dayText(draft.from)} active={!draft.from || !!draft.to} />
            <DayBox label="Đến ngày" value={dayText(draft.to)} active={!!draft.from && !draft.to} />
          </View>
          <Calendar draft={draft} onPick={(day) => setDraft((d) => pickDay(d, day))} today={today} />
          <Txt variant="caption" color={C.muted}>
            Bấm ngày bắt đầu rồi ngày kết thúc. Chỉ chọn 1 ngày thì xem riêng ngày đó.
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}

/** Dòng bộ lọc thời gian (trong thẻ form): bấm mở sheet chọn kỳ hoặc khoảng ngày. */
export function PeriodField<K extends string>({
  label,
  options,
  value,
  onChange,
  initialRange,
  variant = 'row',
}: {
  label: string;
  options: PeriodOption<K>[];
  value: K | DateRange;
  onChange: (v: K | DateRange) => void;
  initialRange?: DateRange | null;
  /** `row`: dòng trong thẻ form. `pill`: nút gọn ở đầu thẻ (vd bộ lọc của từng khối báo cáo). */
  variant?: 'row' | 'pill';
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* "Toàn thời gian" (không lọc) hiện chữ nhạt như ô chưa chọn. */}
      <SelectTrigger
        label={label}
        text={periodText(options, value)}
        empty={value === 'all'}
        variant={variant}
        onPress={() => setOpen(true)}
      />
      <PeriodModal
        visible={open}
        title={label}
        options={options}
        value={value}
        initialRange={initialRange}
        onChange={(v) => {
          setOpen(false);
          onChange(v);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/** PeriodSheet trong Modal dạng sheet (dùng khi nút mở do màn tự vẽ). */
export function PeriodModal<K extends string>({
  visible,
  ...rest
}: {
  visible: boolean;
  title: string;
  options: PeriodOption<K>[];
  value: K | DateRange;
  initialRange?: DateRange | null;
  onChange: (v: K | DateRange) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={rest.onClose}>
      {visible ? <PeriodSheet {...rest} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 22 },
  boxes: { flexDirection: 'row', gap: 10 },
  dayBox: {
    flex: 1,
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.control,
    borderWidth: 1.2,
    borderColor: '#D5DEE6',
    backgroundColor: C.card,
  },
  dayBoxOn: { borderColor: C.brand, borderWidth: 1.6 },
  calendar: {
    padding: 10,
    borderRadius: radius.card,
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  calHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  inside: { backgroundColor: C.brandSoft },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayEdge: { backgroundColor: C.brand },
  today: { borderWidth: 1.2, borderColor: C.brand },
});
