import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { money, qty } from '@/core/format';
import { C, Card, chartColors, Divider, FadeSwap, Icon, Pill, resetAfterLeave, Skeleton, Txt, useCountUp, useScreenActive } from '@/ui';
import { easeOut } from '@/ui/motion';
import type { TrendPoint } from './api';
import { deltaTone, formatDelta, sparseLabels } from './model';

const CHART_HEIGHT = 84;

/**
 * Một cột: mọc lên êm từ đáy (không nảy); đổi kỳ thì co/giãn tới chiều cao
 * mới; quay lại màn thì mọc lại.
 */
function Bar({ height, color, index }: { height: number; color: string; index: number }) {
  const active = useScreenActive();
  const h = useSharedValue(0);
  useEffect(() => {
    if (active) h.set(withDelay(index * 20, withTiming(height, { duration: 450, easing: easeOut })));
    else h.set(resetAfterLeave());
  }, [active, height, index, h]);
  const animated = useAnimatedStyle(() => ({ height: h.get() }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, animated]} />;
}

/** Biểu đồ cột doanh thu (tự vẽ bằng View: nhẹ, giống nhau trên mọi nền tảng). */
export function MiniBarChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) {
    return (
      <View style={styles.chartEmpty}>
        <Txt variant="caption" color={C.muted}>
          Chưa có doanh thu trong kỳ này
        </Txt>
      </View>
    );
  }
  const values = points.map((p) => Math.max(0, Number(p.revenue) || 0));
  const max = Math.max(1, ...values);
  const peak = values.indexOf(Math.max(...values));
  const labels = sparseLabels(points.map((p) => p.label));
  const gap = points.length > 16 ? 3 : 6;
  const peakText = `${points[peak]?.label}: ${money(values[peak])}`;
  return (
    <View accessible accessibilityLabel={`Biểu đồ doanh thu, cao nhất ${peakText} đồng`} style={styles.chart}>
      <View style={[styles.bars, { gap }]}>
        {values.map((v, i) => (
          <Bar
            key={i}
            index={i}
            height={v > 0 ? Math.max(4, (v / max) * CHART_HEIGHT) : 2}
            color={i === peak ? chartColors.barActive : v > 0 ? chartColors.bar : C.border}
          />
        ))}
      </View>
      <View style={[styles.labels, { gap }]}>
        {labels.map((l, i) => (
          <Txt key={i} variant="caption" color={C.faint} align="center" numberOfLines={1} style={styles.label}>
            {l}
          </Txt>
        ))}
      </View>
    </View>
  );
}

/** Thẻ doanh thu: số lớn, mức thay đổi so với kỳ trước, biểu đồ cột. */
export function RevenueCard({
  revenue,
  change,
  trend,
  periodLabel,
  loading,
}: {
  revenue?: number;
  change?: number;
  trend?: TrendPoint[];
  periodLabel: string;
  loading?: boolean;
}) {
  const points = trend ?? [];
  const delta = formatDelta(change);
  const shown = useCountUp(revenue, 800);

  return (
    <Card style={styles.revenue}>
      <View style={styles.revenueTop}>
        <View style={styles.revenueIcon}>
          <Icon name="trending-up" size={20} color={C.white} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="label" color={C.muted}>
            Doanh thu {periodLabel.toLowerCase()}
          </Txt>
        </View>
        {delta ? <Pill label={delta} tone={deltaTone(change)} /> : null}
      </View>
      {revenue === undefined ? (
        loading ? (
          <Skeleton width="65%" height={32} style={{ marginVertical: 2 }} />
        ) : (
          <Txt variant="display">—</Txt>
        )
      ) : (
        <Txt
          variant="display"
          numeric
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityLabel={`Doanh thu ${money(revenue)} đồng`}>
          {`${money(Math.round(shown ?? revenue))} ₫`}
        </Txt>
      )}
      {loading && points.length === 0 ? (
        <Skeleton width="100%" height={CHART_HEIGHT} radius={10} style={{ marginTop: 10 }} />
      ) : (
        <MiniBarChart points={points} />
      )}
    </Card>
  );
}

export interface RankItem {
  key: string | number;
  title: string;
  sub: string;
  value: string;
}

/** Danh sách xếp hạng (bán chạy, khách mua nhiều); đổi kỳ thì danh sách mới hiện dần. */
export function RankList({ items }: { items: RankItem[] }) {
  const dataKey = items.map((i) => `${i.key}:${i.value}`).join('|');
  return (
    <FadeSwap swapKey={dataKey} skipFirst>
      <RankCard items={items} />
    </FadeSwap>
  );
}

function RankCard({ items }: { items: RankItem[] }) {
  return (
    <Card>
      {items.map((item, i) => (
        <View key={item.key}>
          {i > 0 ? <Divider inset={60} /> : null}
          <View style={styles.rankRow}>
            <View style={[styles.rank, i < 3 ? styles.rankTop : null]}>
              <Txt variant="label" weight="bold" color={i < 3 ? C.white : C.muted}>
                {i + 1}
              </Txt>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="body" weight="medium" numberOfLines={1}>
                {item.title}
              </Txt>
              <Txt variant="caption" color={C.muted} numberOfLines={1}>
                {item.sub}
              </Txt>
            </View>
            <Txt variant="body" weight="bold" numeric>
              {item.value}
            </Txt>
          </View>
        </View>
      ))}
    </Card>
  );
}

export const formatQtySold = (n: number) => `Đã bán ${qty(n)}`;

const styles = StyleSheet.create({
  revenue: { padding: 16, gap: 6 },
  revenueTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  revenueIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chart: { marginTop: 10, gap: 6 },
  chartEmpty: { marginTop: 10, height: CHART_HEIGHT + 22, alignItems: 'center', justifyContent: 'center' },
  bars: { height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end' },
  bar: { flex: 1, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  labels: { flexDirection: 'row' },
  label: { flex: 1, fontSize: 10, lineHeight: 14 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF1F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankTop: { backgroundColor: C.brand },
});
