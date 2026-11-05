import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { C, FadeSwap, resetAfterLeave, Txt, useScreenActive } from '@/ui';
import { easeOut } from '@/ui/motion';
import type { TrendPoint } from './api';
import {
  areaPath,
  axisMoney,
  CHART,
  compactMoney,
  heatColor,
  nearestIndex,
  niceScale,
  pointLabel,
  smoothPath,
  sparseLabels,
  type CashBar,
  type CategoryPart,
  type HeatGrid,
} from './model';

/** Cột nhãn trục tung (bên trái vùng vẽ). */
const AXIS_W = 46;
/** Lề trái/phải trong vùng vẽ để điểm đầu/cuối không sát mép. */
const PAD_X = 10;
const PAD_TOP = 8;

function Dot({ x, y, color }: { x: number; y: number; color: string }) {
  // Viền trắng 2px để chấm nổi trên đường.
  return <Circle cx={x} cy={y} r={5} fill={color} stroke={C.white} strokeWidth={2} />;
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Txt variant="caption" color={C.muted}>
        {label}
      </Txt>
    </View>
  );
}

/**
 * Biểu đồ doanh thu (và lợi nhuận với Admin) theo thời gian: một trục tiền,
 * lưới mảnh, đường mượt. Chạm hoặc kéo ngang để xem số của từng mốc.
 * Đổi kỳ / quay lại màn thì đường vẽ dần từ trái sang (ease-out, không nảy).
 */
export function TrendChart({ points, showProfit, height = 168 }: { points: TrendPoint[]; showProfit: boolean; height?: number }) {
  const [width, setWidth] = useState(0);
  const [sel, setSel] = useState<{ key: string; index: number } | null>(null);
  const active = useScreenActive();
  const reduced = useReducedMotion();
  const reveal = useSharedValue(0);

  const plotW = Math.max(0, width - AXIS_W);
  const dataKey = points.map((p) => `${p.label}:${p.revenue}:${p.profit}`).join('|') + (showProfit ? '+' : '');
  const selected = sel && sel.key === dataKey ? sel.index : null;

  useEffect(() => {
    if (plotW <= 0) return;
    if (reduced) reveal.set(plotW);
    else if (active) {
      reveal.set(0);
      reveal.set(withTiming(plotW, { duration: 700, easing: easeOut }));
    } else reveal.set(resetAfterLeave());
  }, [active, dataKey, plotW, reduced, reveal]);
  const clip = useAnimatedStyle(() => ({ width: reveal.get() }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  if (points.length === 0) {
    return (
      <View style={[styles.empty, { height: height + 22 }]}>
        <Txt variant="caption" color={C.muted}>
          Chưa có doanh thu trong kỳ này
        </Txt>
      </View>
    );
  }

  const revenue = points.map((p) => Number(p.revenue) || 0);
  const profit = points.map((p) => Number(p.profit) || 0);
  const scale = niceScale(showProfit ? [...revenue, ...profit] : revenue);
  const plotH = height - PAD_TOP;
  const y = (v: number) => PAD_TOP + ((scale.max - v) / (scale.max - scale.min)) * plotH;
  const n = points.length;
  const xs = points.map((_, i) => (n === 1 ? plotW / 2 : PAD_X + (i * (plotW - 2 * PAD_X)) / (n - 1)));
  const revPts = xs.map((x, i) => ({ x, y: y(revenue[i]) }));
  const proPts = xs.map((x, i) => ({ x, y: y(profit[i]) }));
  const baseY = y(Math.max(0, scale.min));
  const labels = sparseLabels(
    points.map((p) => pointLabel(p.label)),
    Math.max(2, Math.floor(plotW / 46)),
  );
  const peak = revenue.indexOf(Math.max(...revenue));

  const pick = (x: number) => setSel({ key: dataKey, index: nearestIndex(xs, x) });
  const s = selected;

  return (
    <View
      accessible
      accessibilityLabel={`Biểu đồ doanh thu theo thời gian, ${n} mốc. Cao nhất ${pointLabel(points[peak].label)}: ${compactMoney(revenue[peak])}`}>
      {/* Dòng trên biểu đồ: số của mốc đang chạm, hoặc chú thích. */}
      <View style={styles.readout}>
        {s !== null ? (
          <>
            <Txt variant="label" weight="semibold" numeric>
              {pointLabel(points[s].label)}
            </Txt>
            <LegendItem color={CHART.revenue} label={`Doanh thu ${compactMoney(revenue[s])}`} />
            {showProfit ? <LegendItem color={CHART.profit} label={`Lợi nhuận ${compactMoney(profit[s])}`} /> : null}
          </>
        ) : (
          <>
            {showProfit ? (
              <>
                <LegendItem color={CHART.revenue} label="Doanh thu" />
                <LegendItem color={CHART.profit} label="Lợi nhuận" />
              </>
            ) : (
              <Txt variant="caption" color={C.muted} numeric>
                Cao nhất {pointLabel(points[peak].label)}: {compactMoney(revenue[peak])}
              </Txt>
            )}
            <Txt variant="caption" color={C.faint} style={{ marginLeft: 'auto' }}>
              Chạm để xem
            </Txt>
          </>
        )}
      </View>

      <View onLayout={onLayout} style={{ height }}>
        {width > 0 ? (
          <>
            {/* Lưới + nhãn trục tung (đứng yên). */}
            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
              {scale.ticks.map((t) => (
                <Line
                  key={t}
                  x1={AXIS_W}
                  x2={width}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? '#CBD5DF' : CHART.grid}
                  strokeWidth={StyleSheet.hairlineWidth * 2}
                />
              ))}
            </Svg>
            {scale.ticks.map((t) => (
              <Txt key={t} variant="caption" color={C.faint} numeric align="right" style={[styles.yLabel, { top: y(t) - 8 }]}>
                {axisMoney(t)}
              </Txt>
            ))}

            {/* Đường số liệu: hiện dần từ trái sang. */}
            <Animated.View style={[styles.clip, { left: AXIS_W, height }, clip]}>
              <Svg width={plotW} height={height}>
                <Defs>
                  <LinearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={CHART.revenue} stopOpacity={0.2} />
                    <Stop offset="1" stopColor={CHART.revenue} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                {n > 1 ? <Path d={areaPath(revPts, baseY)} fill="url(#rev-fill)" /> : null}
                {n > 1 ? <Path d={smoothPath(revPts)} stroke={CHART.revenue} strokeWidth={2} fill="none" strokeLinejoin="round" /> : null}
                {showProfit && n > 1 ? (
                  <Path d={smoothPath(proPts)} stroke={CHART.profit} strokeWidth={2} fill="none" strokeLinejoin="round" />
                ) : null}
                {n === 1 ? <Dot x={revPts[0].x} y={revPts[0].y} color={CHART.revenue} /> : null}
                {n === 1 && showProfit ? <Dot x={proPts[0].x} y={proPts[0].y} color={CHART.profit} /> : null}
              </Svg>
            </Animated.View>

            {/* Mốc đang chạm: vạch dọc + chấm. */}
            {s !== null ? (
              <Svg width={plotW} height={height} style={[styles.overlay, { left: AXIS_W }]} pointerEvents="none">
                <Line x1={xs[s]} x2={xs[s]} y1={PAD_TOP} y2={height} stroke="#B8C2CC" strokeWidth={1} />
                <Dot x={xs[s]} y={revPts[s].y} color={CHART.revenue} />
                {showProfit ? <Dot x={xs[s]} y={proPts[s].y} color={CHART.profit} /> : null}
              </Svg>
            ) : null}

            {/* Lớp nhận chạm (trên cùng, không có con → toạ độ chạm đúng vùng vẽ). */}
            <View
              style={[styles.overlay, { left: AXIS_W, width: plotW, height }]}
              onStartShouldSetResponder={() => true}
              onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
              onResponderMove={(e) => pick(e.nativeEvent.locationX)}
              onResponderTerminationRequest={() => true}
            />
          </>
        ) : null}
      </View>

      {/* Nhãn trục hoành. */}
      <View style={[styles.xLabels, { marginLeft: AXIS_W }]}>
        {plotW > 0
          ? labels.map((l, i) =>
              l ? (
                <Txt key={i} variant="caption" color={C.faint} align="center" numberOfLines={1} style={[styles.xLabel, { left: xs[i] - 22 }]}>
                  {l}
                </Txt>
              ) : null,
            )
          : null}
      </View>
    </View>
  );
}

/** Vùng vẽ hiện dần từ trái sang (ease-out, không nảy); quay lại màn thì chạy lại. */
function useReveal(plotW: number, dataKey: string) {
  const active = useScreenActive();
  const reduced = useReducedMotion();
  const reveal = useSharedValue(0);
  useEffect(() => {
    if (plotW <= 0) return;
    if (reduced) reveal.set(plotW);
    else if (active) {
      reveal.set(0);
      reveal.set(withTiming(plotW, { duration: 700, easing: easeOut }));
    } else reveal.set(resetAfterLeave());
  }, [active, dataKey, plotW, reduced, reveal]);
  return useAnimatedStyle(() => ({ width: reveal.get() }));
}

/** Cột có đầu bo tròn ở phía số liệu, chân vuông nằm trên đường đáy. */
function columnPath(x: number, top: number, w: number, base: number): string {
  const h = base - top;
  if (h <= 0 || w <= 0) return '';
  const r = Math.min(3, w / 2, h);
  return `M${x},${base} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + w - r},${top} Q${x + w},${top} ${x + w},${top + r} L${x + w},${base} Z`;
}

/**
 * Cột đôi thu / chi theo từng mốc (cùng một trục tiền). Hai cột trong một mốc
 * cách nhau 2px; chạm hoặc kéo ngang để xem số của mốc.
 */
export function PairColumns({ bars, height = 150 }: { bars: CashBar[]; height?: number }) {
  const [width, setWidth] = useState(0);
  const [sel, setSel] = useState<{ key: string; index: number } | null>(null);
  const plotW = Math.max(0, width - AXIS_W);
  const dataKey = bars.map((b) => `${b.label}:${b.receipt}:${b.payment}`).join('|');
  const clip = useReveal(plotW, dataKey);
  const selected = sel && sel.key === dataKey ? sel.index : null;

  const n = bars.length;
  const scale = niceScale(bars.flatMap((b) => [b.receipt, b.payment]));
  const plotH = height - PAD_TOP;
  const y = (v: number) => PAD_TOP + ((scale.max - v) / (scale.max - scale.min)) * plotH;
  const baseY = y(0);
  const slot = n > 0 ? plotW / n : 0;
  const barW = Math.max(2, Math.min(12, (slot - 6) / 2));
  const xs = bars.map((_, i) => slot * i + slot / 2);
  const labels = sparseLabels(
    bars.map((b) => b.label),
    Math.max(2, Math.floor(plotW / 46)),
  );
  const s = selected;

  return (
    <View accessible accessibilityLabel={`Biểu đồ thu chi theo thời gian, ${n} mốc`}>
      <View style={styles.readout}>
        {s !== null ? (
          <>
            <Txt variant="label" weight="semibold" numeric>
              {bars[s].label}
            </Txt>
            <LegendItem color={CHART.receipt} label={`Thu ${compactMoney(bars[s].receipt)}`} />
            <LegendItem color={CHART.payment} label={`Chi ${compactMoney(bars[s].payment)}`} />
          </>
        ) : (
          <>
            <LegendItem color={CHART.receipt} label="Thu" />
            <LegendItem color={CHART.payment} label="Chi" />
            <Txt variant="caption" color={C.faint} style={{ marginLeft: 'auto' }}>
              Chạm để xem
            </Txt>
          </>
        )}
      </View>
      <View onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))} style={{ height }}>
        {width > 0 ? (
          <>
            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
              {scale.ticks.map((t) => (
                <Line
                  key={t}
                  x1={AXIS_W}
                  x2={width}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? '#CBD5DF' : CHART.grid}
                  strokeWidth={StyleSheet.hairlineWidth * 2}
                />
              ))}
              {s !== null ? (
                <Rect x={AXIS_W + slot * s} y={PAD_TOP} width={slot} height={plotH} fill={C.divider} rx={4} />
              ) : null}
            </Svg>
            {scale.ticks.map((t) => (
              <Txt key={t} variant="caption" color={C.faint} numeric align="right" style={[styles.yLabel, { top: y(t) - 8 }]}>
                {axisMoney(t)}
              </Txt>
            ))}
            <Animated.View style={[styles.clip, { left: AXIS_W, height }, clip]}>
              <Svg width={plotW} height={height}>
                {bars.map((b, i) => (
                  <Path key={`r${i}`} d={columnPath(xs[i] - barW - 1, y(b.receipt), barW, baseY)} fill={CHART.receipt} />
                ))}
                {bars.map((b, i) => (
                  <Path key={`p${i}`} d={columnPath(xs[i] + 1, y(b.payment), barW, baseY)} fill={CHART.payment} />
                ))}
              </Svg>
            </Animated.View>
            <View
              style={[styles.overlay, { left: AXIS_W, width: plotW, height }]}
              onStartShouldSetResponder={() => true}
              onResponderGrant={(e) => setSel({ key: dataKey, index: nearestIndex(xs, e.nativeEvent.locationX) })}
              onResponderMove={(e) => setSel({ key: dataKey, index: nearestIndex(xs, e.nativeEvent.locationX) })}
              onResponderTerminationRequest={() => true}
            />
          </>
        ) : null}
      </View>
      <View style={[styles.xLabels, { marginLeft: AXIS_W }]}>
        {plotW > 0
          ? labels.map((l, i) =>
              l ? (
                <Txt key={i} variant="caption" color={C.faint} align="center" numberOfLines={1} style={[styles.xLabel, { left: xs[i] - 22 }]}>
                  {l}
                </Txt>
              ) : null,
            )
          : null}
      </View>
    </View>
  );
}

const HEAT_LABEL_W = 28;
const HEAT_GAP = 2;
const HEAT_CELL_H = 22;

/**
 * Bản đồ khung giờ bán: hàng = thứ (T2 → CN), cột = giờ; ô càng đậm doanh
 * thu càng cao. Chạm (hoặc kéo) để xem số của từng ô.
 */
export function Heatmap({ grid }: { grid: HeatGrid }) {
  const [width, setWidth] = useState(0);
  const [sel, setSel] = useState<{ key: string; r: number; c: number } | null>(null);
  const cols = grid.hours.length;
  const dataKey = `${grid.hours.join(',')}|${grid.rows.map((r) => r.cells.map((c) => c.revenue).join(',')).join('|')}`;
  const cellW = cols > 0 && width > 0 ? (width - HEAT_LABEL_W - HEAT_GAP * (cols - 1)) / cols : 0;
  const gridH = grid.rows.length * HEAT_CELL_H + (grid.rows.length - 1) * HEAT_GAP;
  const picked = sel && sel.key === dataKey ? sel : null;
  const step = cols > 12 ? 3 : 2;

  const pick = (x: number, yPos: number) => {
    if (cellW <= 0) return;
    const c = Math.max(0, Math.min(cols - 1, Math.floor(x / (cellW + HEAT_GAP))));
    const r = Math.max(0, Math.min(grid.rows.length - 1, Math.floor(yPos / (HEAT_CELL_H + HEAT_GAP))));
    setSel({ key: dataKey, r, c });
  };
  const cell = picked ? grid.rows[picked.r].cells[picked.c] : null;

  return (
    <View>
      <View style={styles.readout}>
        {picked && cell ? (
          <Txt variant="label" numeric>
            <Txt variant="label" weight="semibold">
              {grid.rows[picked.r].label}, {grid.hours[picked.c]}h:
            </Txt>{' '}
            {cell.count > 0 ? `${compactMoney(cell.revenue)}, ${cell.count} hóa đơn` : 'chưa có đơn'}
          </Txt>
        ) : (
          <>
            <Txt variant="caption" color={C.muted} numeric>
              {grid.peak ? `Đông nhất ${grid.peak.label}, ${grid.peak.hour}h: ${compactMoney(grid.peak.revenue)}` : 'Chưa có đơn trong kỳ'}
            </Txt>
            <Txt variant="caption" color={C.faint} style={{ marginLeft: 'auto' }}>
              Chạm để xem
            </Txt>
          </>
        )}
      </View>

      <FadeSwap swapKey={dataKey} skipFirst>
        <View onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}>
          <View style={{ gap: HEAT_GAP }}>
            {grid.rows.map((row, r) => (
              <View key={row.dow} style={styles.heatRow}>
                <Txt variant="caption" color={C.muted} style={{ width: HEAT_LABEL_W }}>
                  {row.label}
                </Txt>
                {cellW > 0
                  ? row.cells.map((c, i) => (
                      <View
                        key={i}
                        style={[
                          styles.heatCell,
                          { width: cellW, backgroundColor: heatColor(c.revenue, grid.max) },
                          picked && picked.r === r && picked.c === i ? styles.heatOn : null,
                        ]}
                      />
                    ))
                  : null}
              </View>
            ))}
          </View>
          {cellW > 0 ? (
            <View
              style={[styles.overlay, { left: HEAT_LABEL_W, width: width - HEAT_LABEL_W, height: gridH }]}
              onStartShouldSetResponder={() => true}
              onResponderGrant={(e) => pick(e.nativeEvent.locationX, e.nativeEvent.locationY)}
              onResponderMove={(e) => pick(e.nativeEvent.locationX, e.nativeEvent.locationY)}
              onResponderTerminationRequest={() => true}
            />
          ) : null}
          <View style={[styles.xLabels, { marginLeft: HEAT_LABEL_W }]}>
            {cellW > 0
              ? grid.hours.map((h, i) =>
                  i % step === 0 ? (
                    <Txt
                      key={h}
                      variant="caption"
                      color={C.faint}
                      align="center"
                      numberOfLines={1}
                      style={[styles.xLabel, { left: i * (cellW + HEAT_GAP) + cellW / 2 - 22 }]}>
                      {h}h
                    </Txt>
                  ) : null,
                )
              : null}
          </View>
        </View>
      </FadeSwap>

      <View style={styles.heatLegend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Txt variant="caption" color={C.muted}>
          Ít
        </Txt>
        {CHART.heat.map((c) => (
          <View key={c} style={[styles.heatSwatch, { backgroundColor: c }]} />
        ))}
        <Txt variant="caption" color={C.muted}>
          Nhiều doanh thu
        </Txt>
      </View>
    </View>
  );
}

/** Thanh ngang mọc dần (ease-out) tới `share` (0–1); quay lại màn thì mọc lại. */
export function Meter({ share, color, index = 0, height = 6 }: { share: number; color: string; index?: number; height?: number }) {
  const active = useScreenActive();
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? share : 0);
  useEffect(() => {
    if (reduced) p.set(share);
    else if (active) p.set(withDelay(Math.min(index, 10) * 30, withTiming(share, { duration: 520, easing: easeOut })));
    else p.set(resetAfterLeave());
  }, [active, share, index, p, reduced]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, p.get())) * 100}%` }));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, fill]} />
    </View>
  );
}

/**
 * Thanh tỷ trọng (cơ cấu nhóm hàng): các đoạn liền nhau, cách 2px.
 * Mỗi nhóm có dòng chú thích kèm % và số tiền nên không chỉ dựa vào màu.
 */
export function SegmentBar({ parts }: { parts: CategoryPart[] }) {
  return (
    <View style={styles.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {parts.map((p, i) => (
        <View
          key={p.name}
          style={{
            flex: Math.max(p.percent, 0.5),
            backgroundColor: p.color,
            borderTopLeftRadius: i === 0 ? 7 : 0,
            borderBottomLeftRadius: i === 0 ? 7 : 0,
            borderTopRightRadius: i === parts.length - 1 ? 7 : 0,
            borderBottomRightRadius: i === parts.length - 1 ? 7 : 0,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  readout: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 12, rowGap: 4, minHeight: 22, marginBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  clip: { position: 'absolute', top: 0, overflow: 'hidden' },
  overlay: { position: 'absolute', top: 0 },
  yLabel: { position: 'absolute', left: 0, width: AXIS_W - 8, fontSize: 10, lineHeight: 16 },
  xLabels: { height: 18, marginTop: 4 },
  xLabel: { position: 'absolute', top: 0, width: 44, fontSize: 10, lineHeight: 16 },
  track: { width: '100%', backgroundColor: C.divider, overflow: 'hidden' },
  segments: { flexDirection: 'row', gap: 2, height: 14 },
  heatRow: { flexDirection: 'row', alignItems: 'center', gap: HEAT_GAP },
  heatCell: { height: HEAT_CELL_H, borderRadius: 4 },
  heatOn: { borderWidth: 2, borderColor: C.text },
  heatLegend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  heatSwatch: { width: 16, height: 10, borderRadius: 3 },
});
