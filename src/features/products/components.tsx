import { StyleSheet, View } from 'react-native';
import { money, qty } from '@/core/format';
import { C, Icon, Pill, PressableScale, radius, toneColors, Txt } from '@/ui';
import { Thumb } from '../sales/components';
import { typeLabel, type ProductRow } from './model';

/** Chip chọn nhiều (bấm lại để bỏ chọn), xuống dòng khi hết chỗ. */
export function ToggleChips<T extends string | number>({
  options,
  selected,
  onToggle,
  label,
}: {
  options: { value: T; label: string }[];
  selected: readonly T[];
  onToggle: (value: T) => void;
  /** Tên nhóm, đọc kèm cho VoiceOver. */
  label: string;
}) {
  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <PressableScale
            key={String(o.value)}
            onPress={() => onToggle(o.value)}
            haptic="selection"
            scaleTo={0.94}
            accessibilityRole="checkbox"
            accessibilityLabel={`${label}: ${o.label}`}
            accessibilityState={{ checked: on }}
            style={[styles.chip, on ? styles.chipOn : null]}>
            {on ? <Icon name="check" size={15} color={C.brand} strokeWidth={2.4} /> : null}
            <Txt variant="label" weight={on ? 'semibold' : 'medium'} color={on ? C.brand : C.text} numberOfLines={1}>
              {o.label}
            </Txt>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Dòng "nhãn … giá trị" trong thẻ thông tin. */
export function KV({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'success' | 'muted' }) {
  const color = tone === 'danger' ? toneColors.danger.fg : tone === 'success' ? toneColors.success.fg : tone === 'muted' ? C.muted : C.text;
  return (
    <View style={styles.kv}>
      <Txt variant="label" color={C.muted} style={{ flexShrink: 0, maxWidth: '45%' }}>
        {label}
      </Txt>
      <Txt variant="body" weight="medium" color={color} align="right" numeric style={{ flex: 1 }}>
        {value}
      </Txt>
    </View>
  );
}

/** Ô số nhỏ (lưới tồn kho). */
export function StatCell({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'warning' | 'info' | 'success' }) {
  return (
    <View style={styles.cell}>
      <Txt variant="caption" color={C.muted} numberOfLines={1}>
        {label}
      </Txt>
      <Txt variant="body" weight="bold" numeric numberOfLines={1} color={tone ? toneColors[tone].fg : C.text}>
        {value}
      </Txt>
    </View>
  );
}

/** "42 gói" / "Hết hàng". */
export const stockText = (onHand: number | null, unit: string | null) =>
  onHand === null ? 'Chưa có tồn' : `${qty(onHand)}${unit ? ` ${unit}` : ''}`;

/** Thẻ 1 hàng hóa trong danh sách. */
export function ProductCard({
  row,
  showSale,
  showCost,
  onPress,
}: {
  row: ProductRow;
  showSale: boolean;
  showCost: boolean;
  onPress: () => void;
}) {
  const out = row.onHand !== null && row.onHand <= 0;
  const stock = stockText(row.onHand, row.unit);
  const tags: { label: string; tone: 'neutral' | 'brand' | 'danger' | 'warning' }[] = [];
  if (row.type !== 2) tags.push({ label: typeLabel(row.type, true), tone: 'brand' });
  if (row.category) tags.push({ label: row.category, tone: 'neutral' });
  if (row.damaged > 0) tags.push({ label: `Bục rách ${qty(row.damaged)}`, tone: 'danger' });
  if (row.nearExpiry > 0) tags.push({ label: `Cận date ${qty(row.nearExpiry)}`, tone: 'warning' });
  const a11y = [
    row.name,
    row.code,
    row.isActive ? null : 'ngừng hoạt động',
    showSale ? `giá ${money(row.basePrice)} đồng` : null,
    row.type === 3 ? null : `tồn ${stock}`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <PressableScale onPress={onPress} accessibilityLabel={a11y} scaleTo={0.985} style={[styles.card, row.isActive ? null : { opacity: 0.62 }]}>
      <Thumb uri={row.image} size={60} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.top}>
          <Txt variant="caption" color={C.muted} numeric numberOfLines={1} style={{ flexShrink: 1 }}>
            {row.code}
          </Txt>
          {row.isActive ? null : <Pill label="Ngừng" tone="danger" />}
        </View>
        <Txt variant="body" weight="semibold" numberOfLines={2}>
          {row.name}
        </Txt>
        {tags.length ? (
          <View style={styles.tags}>
            {tags.map((t) => (
              <Pill key={t.label} label={t.label} tone={t.tone} />
            ))}
          </View>
        ) : null}
        <View style={styles.bottom}>
          <View style={{ flex: 1, gap: 1 }}>
            {row.type === 3 ? null : (
              <Txt variant="caption" weight={out ? 'semibold' : 'regular'} color={out ? toneColors.danger.fg : C.muted} numeric numberOfLines={1}>
                Tồn {stock}
              </Txt>
            )}
            {showCost && row.cost !== null ? (
              <Txt variant="caption" color={C.muted} numeric numberOfLines={1}>
                Vốn {money(row.cost)}
              </Txt>
            ) : null}
          </View>
          {showSale ? (
            <Txt variant="heading" weight="bold" numeric color={C.brandDark}>
              {money(row.basePrice)}
            </Txt>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1.2,
    borderColor: '#CFD8E0',
    backgroundColor: C.card,
    maxWidth: '100%',
  },
  chipOn: { borderColor: C.brand, backgroundColor: C.brandSoft },
  kv: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 9 },
  cell: { width: '33.33%', paddingVertical: 8, paddingRight: 8, gap: 2 },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 2 },
});
