import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon, type IconName } from './icons';
import { easeOut, PressableScale, Skeleton, useCountUp } from './motion';
import { Card, IconBadge, Pill } from './Surfaces';
import { Txt } from './Text';
import { C, radius, type AccentName, type Tone } from './theme';

/** Thẻ số liệu: biểu tượng màu, nhãn nhỏ, số đậm, mức thay đổi. */
export function StatCard({
  icon,
  color = 'teal',
  label,
  value,
  format = String,
  loading,
  delta,
  deltaTone,
  note,
  onPress,
}: {
  icon: IconName;
  color?: AccentName;
  label: string;
  /** Số thì chạy số khi đổi giá trị; chuỗi thì hiện nguyên. */
  value?: number | string;
  format?: (n: number) => string;
  loading?: boolean;
  delta?: string | null;
  deltaTone?: Tone;
  note?: string;
  onPress?: () => void;
}) {
  const counted = useCountUp(typeof value === 'number' ? value : undefined);
  const text = typeof value === 'number' ? format(Math.round(counted ?? value)) : (value ?? '—');
  return (
    <Card style={styles.stat} onPress={onPress} accessibilityLabel={`${label}: ${text}`}>
      <View style={styles.statTop}>
        <IconBadge name={icon} color={color} size={38} />
        {onPress ? <Icon name="chevron-right" size={18} color={C.faint} /> : null}
      </View>
      <Txt variant="label" color={C.muted} numberOfLines={1}>
        {label}
      </Txt>
      {loading && value === undefined ? (
        <Skeleton width="70%" height={26} style={{ marginVertical: 2 }} />
      ) : (
        <Txt variant="title" numeric numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {text}
        </Txt>
      )}
      {delta || note ? (
        <View style={styles.statBottom}>
          {delta ? <Pill label={delta} tone={deltaTone ?? 'neutral'} /> : null}
          {note ? (
            <Txt variant="caption" color={C.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
              {note}
            </Txt>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

/** Lưới 2 cột cho các thẻ số liệu. */
export function Grid2({ children }: { children: ReactNode[] }) {
  const rows: ReactNode[][] = [];
  children.forEach((child, i) => {
    if (i % 2 === 0) rows.push([child]);
    else rows[rows.length - 1].push(child);
  });
  return (
    <View style={{ gap: 12 }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
          {row}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

/** Thẻ chức năng: biểu tượng, tiêu đề, mô tả, nút mũi tên tròn. */
export function ActionCard({
  icon,
  color = 'teal',
  title,
  subtitle,
  onPress,
  badge,
  right,
}: {
  icon: IconName;
  color?: AccentName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  badge?: string;
  right?: ReactNode;
}) {
  return (
    <Card style={styles.action} onPress={onPress} accessibilityLabel={title}>
      <IconBadge name={icon} color={color} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt variant="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
            {title}
          </Txt>
          {badge ? <Pill label={badge} tone="neutral" /> : null}
        </View>
        {subtitle ? (
          <Txt variant="label" weight="regular" color={C.muted} numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ??
        (onPress ? (
          <View style={styles.arrow}>
            <Icon name="arrow-right" size={16} color={C.brand} strokeWidth={2.2} />
          </View>
        ) : null)}
    </Card>
  );
}

export interface ShortcutItem {
  key: string;
  icon: IconName;
  color: AccentName;
  label: string;
  onPress: () => void;
  /** Chức năng chưa có: hiện nhãn "Sắp có". */
  soon?: boolean;
}

/** Lưới lối tắt 4 cột. */
export function ShortcutGrid({ items, footnote }: { items: ShortcutItem[]; footnote?: string }) {
  return (
    <Card style={styles.grid}>
      {items.map((item) => (
        <PressableScale
          key={item.key}
          onPress={item.onPress}
          haptic="selection"
          scaleTo={0.9}
          accessibilityLabel={item.soon ? `${item.label}, sắp có` : item.label}
          style={styles.shortcut}>
          <IconBadge name={item.icon} color={item.color} size={48} />
          <Txt variant="caption" weight="medium" align="center" numberOfLines={2}>
            {item.label}
          </Txt>
        </PressableScale>
      ))}
      {footnote ? (
        <Txt variant="caption" color={C.muted} align="center" style={styles.footnote}>
          {footnote}
        </Txt>
      ) : null}
    </Card>
  );
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SLIDE = { duration: 280, easing: easeOut };

/**
 * Nhóm chip lọc / tab. Chọn chip khác thì ô màu thương hiệu trượt từ chip cũ
 * sang chip mới (chữ đổi trắng đúng phần ô màu đi qua), dải chip tự cuộn để
 * chip đang chọn nằm giữa. Nội dung đổi theo chip thì bọc bằng `TabPanel`.
 */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  scroll = true,
  fill,
}: {
  options: { value: T; label: string; count?: number }[];
  /** null = chưa chọn chip nào. */
  value: T | null;
  onChange: (value: T) => void;
  scroll?: boolean;
  /** Chia đều bề ngang (ít lựa chọn, không cuộn). */
  fill?: boolean;
}) {
  const reduced = useReducedMotion();
  const [boxes, setBoxes] = useState<Partial<Record<string, Box>>>({});
  const target = value === null ? undefined : boxes[value];
  const tx = target?.x;
  const tw = target?.width;

  const x = useSharedValue(0);
  const w = useSharedValue(0);
  useEffect(() => {
    if (tx === undefined || tw === undefined) return;
    if (reduced || w.get() === 0) {
      x.set(tx);
      w.set(tw);
    } else {
      x.set(withTiming(tx, SLIDE));
      w.set(withTiming(tw, SLIDE));
    }
  }, [tx, tw, reduced, x, w]);

  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [viewport, setViewport] = useState(0);
  useEffect(() => {
    if (!scroll || fill || tx === undefined || tw === undefined || viewport === 0) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, tx - (viewport - tw) / 2), animated: !reduced });
  }, [scroll, fill, tx, tw, viewport, reduced]);

  const pillStyle = useAnimatedStyle(() => ({ width: w.get(), transform: [{ translateX: x.get() }] }));
  const innerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -x.get() }] }));

  const measure = (key: string) => (e: LayoutChangeEvent) => {
    const { x: bx, y, width, height } = e.nativeEvent.layout;
    setBoxes((prev) => {
      const old = prev[key];
      if (old && old.x === bx && old.y === y && old.width === width && old.height === height) return prev;
      return { ...prev, [key]: { x: bx, y, width, height } };
    });
  };
  const text = (o: { label: string; count?: number }) => `${o.label}${o.count !== undefined ? ` ${o.count}` : ''}`;

  const chips = options.map((o) => {
    const on = o.value === value;
    // Chưa đo xong vị trí thì tô màu thẳng lên chip; đo xong thì ô trượt lo phần này.
    const solid = on && !target;
    return (
      <PressableScale
        key={o.value}
        onLayout={measure(o.value)}
        onPress={() => {
          if (!on) onChange(o.value);
        }}
        haptic={on ? undefined : 'selection'}
        scaleTo={0.94}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        style={[styles.chip, fill ? styles.chipFill : null, solid ? styles.chipOn : null]}>
        <Txt variant="label" weight="medium" color={solid ? C.white : C.text} align="center" numberOfLines={1}>
          {text(o)}
        </Txt>
      </PressableScale>
    );
  });

  const pill = target ? (
    <Animated.View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.pill, { top: target.y, height: target.height }, pillStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, innerStyle]}>
        {options.map((o) => {
          const b = boxes[o.value];
          if (!b) return null;
          return (
            <View key={o.value} style={[styles.pillLabel, { left: b.x, width: b.width, height: b.height }]}>
              <Txt variant="label" weight="semibold" color={C.white} align="center" numberOfLines={1}>
                {text(o)}
              </Txt>
            </View>
          );
        })}
      </Animated.View>
    </Animated.View>
  ) : null;

  if (fill || !scroll)
    return (
      <View style={fill ? styles.chipFillRow : styles.chipRow} accessibilityRole="tablist">
        {chips}
        {pill}
      </View>
    );
  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(e) => setViewport(e.nativeEvent.layout.width)}
      contentContainerStyle={styles.chipRow}
      accessibilityRole="tablist"
      style={{ flexGrow: 0, marginHorizontal: -16 }}>
      <View style={{ width: 4 }} />
      {chips}
      <View style={{ width: 4 }} />
      {pill}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stat: { flex: 1, padding: 14, gap: 4, minHeight: 132 },
  statTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  statBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  arrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 14,
    paddingHorizontal: 6,
    rowGap: 16,
  },
  shortcut: { width: '25%', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  footnote: { width: '100%', paddingHorizontal: 12, marginTop: 2 },
  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, flexWrap: 'nowrap' },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.2,
    borderColor: '#CFD8E0',
    backgroundColor: C.card,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: C.brand, borderColor: C.brand },
  chipFillRow: { flexDirection: 'row', gap: 6 },
  chipFill: { flex: 1, paddingHorizontal: 4, alignItems: 'center' },
  pill: {
    position: 'absolute',
    left: 0,
    borderRadius: radius.pill,
    backgroundColor: C.brand,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  pillLabel: { position: 'absolute', top: 0, alignItems: 'center', justifyContent: 'center' },
});
