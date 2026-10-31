import { useState } from 'react';
import { StyleSheet, useColorScheme, View, type LayoutChangeEvent } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { money } from '@/core/format';
import { C, Card, chartColors, Pill, Txt } from '@/ui';
import type { TrendPoint } from './api';
import { formatDelta } from './model';

function DeltaPill({ pct, invert }: { pct?: number | null; invert?: boolean }) {
  const text = formatDelta(pct);
  if (!text) return null;
  const good = (pct ?? 0) >= 0 ? !invert : !!invert;
  return <Pill label={text} tone={pct === 0 ? 'neutral' : good ? 'success' : 'danger'} />;
}

/** Doanh thu kỳ đang xem + đường xu hướng. */
export function RevenueHero({
  revenue,
  change,
  trend,
  loading,
}: {
  revenue?: number;
  change?: number;
  trend?: TrendPoint[];
  loading?: boolean;
}) {
  const dark = useColorScheme() === 'dark';
  const colors = chartColors(dark);
  const [width, setWidth] = useState(0);
  const points = (trend ?? []).map((p) => ({ value: Math.max(0, Number(p.revenue) || 0) }));
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <Card style={styles.hero}>
      <View style={styles.heroTop}>
        <Txt variant="subhead" color={C.secondary}>
          Doanh thu
        </Txt>
        <DeltaPill pct={change} />
      </View>
      <Txt variant="title1" numeric accessibilityLabel={`Doanh thu ${money(revenue)} đồng`}>
        {loading && revenue === undefined ? '—' : `${money(revenue)} ₫`}
      </Txt>
      <View onLayout={onLayout} style={styles.chart}>
        {width > 0 && points.length > 1 ? (
          <LineChart
            data={points}
            areaChart
            curved
            hideDataPoints
            hideRules
            hideYAxisText
            yAxisThickness={0}
            xAxisThickness={0}
            initialSpacing={0}
            endSpacing={0}
            adjustToWidth
            width={width}
            height={72}
            thickness={2}
            color={colors.line}
            startFillColor={colors.fillStart}
            endFillColor={colors.fillEnd}
            startOpacity={1}
            endOpacity={1}
            disableScroll
          />
        ) : null}
      </View>
    </Card>
  );
}

export function KpiTile({
  label,
  value,
  change,
  note,
}: {
  label: string;
  value: string;
  change?: number | null;
  note?: string;
}) {
  return (
    <Card style={styles.tile}>
      <Txt variant="footnote" color={C.secondary} numberOfLines={1}>
        {label}
      </Txt>
      <Txt variant="title3" numeric numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
      <View style={styles.tileBottom}>
        <DeltaPill pct={change} />
        {note ? (
          <Txt variant="caption" color={C.secondary} numberOfLines={1}>
            {note}
          </Txt>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 16, gap: 6 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chart: { height: 80, marginTop: 6, overflow: 'hidden' },
  tile: { flex: 1, padding: 14, gap: 4, minHeight: 96 },
  tileBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 22 },
});
