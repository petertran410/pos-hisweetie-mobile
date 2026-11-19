import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { money, vnd } from '@/core/format';
import { C, Card, Divider, FadeSwap, Icon, InfoRow, Pill, PressableScale, Skeleton, toneColors, Txt, useCountUp } from '@/ui';
import type { CashflowSummary, FinanceData, ReturnsSummary, TrendPoint } from './api';
import { Meter, PairColumns, SegmentBar, TrendChart } from './charts';
import {
  agingRows,
  cashBars,
  CHART,
  compactMoney,
  deltaTone,
  formatDelta,
  marginText,
  overdueNote,
  paymentRows,
  returnRows,
  type BarRow,
  type CategoryPart,
} from './model';

/** Hàng bộ lọc nhỏ ở đầu thẻ (các nút "Tháng này ⌄"). */
export function FilterRow({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <View style={styles.filterRow}>
      {children}
      {note ? (
        <Txt variant="caption" color={C.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
          {note}
        </Txt>
      ) : null}
    </View>
  );
}

/**
 * Phần thân của một khối số liệu: đang tải (khung xám), lỗi (nút thử lại),
 * trống (dòng chữ nhạt) hoặc nội dung.
 */
export function BlockBody({
  loading,
  error,
  empty,
  emptyText = 'Chưa có dữ liệu trong kỳ này',
  onRetry,
  rows = 3,
  children,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
  rows?: number;
  children: ReactNode;
}) {
  if (error) {
    return (
      <View style={styles.state}>
        <Icon name="wifi-off" size={18} color={C.muted} />
        <Txt variant="label" color={C.muted} style={{ flex: 1 }}>
          Không tải được số liệu
        </Txt>
        {onRetry ? (
          <PressableScale onPress={onRetry} hitSlop={10} accessibilityRole="button" scaleTo={0.94}>
            <Txt variant="label" weight="semibold" color={C.brand}>
              Thử lại
            </Txt>
          </PressableScale>
        ) : null}
      </View>
    );
  }
  if (loading) {
    return (
      <View style={{ gap: 14, paddingVertical: 4 }}>
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} style={{ gap: 6 }}>
            <Skeleton width={i % 2 ? '55%' : '75%'} height={14} />
            <Skeleton width="100%" height={6} />
          </View>
        ))}
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.emptyState}>
        <Txt variant="caption" color={C.muted} align="center">
          {emptyText}
        </Txt>
      </View>
    );
  }
  return <>{children}</>;
}

/** Thẻ doanh thu: số lớn, thay đổi so với kỳ trước, lợi nhuận (Admin), biểu đồ theo thời gian. */
export function RevenueCard({
  revenue,
  change,
  profit,
  margin,
  showProfit,
  trend,
  trendLoading,
  periodLabel,
  caption,
  loading,
}: {
  revenue?: number;
  change?: number;
  profit?: number;
  margin?: number;
  showProfit: boolean;
  trend?: TrendPoint[];
  trendLoading?: boolean;
  periodLabel: string;
  caption: string;
  loading?: boolean;
}) {
  const delta = formatDelta(change);
  const shown = useCountUp(revenue, 800);

  return (
    <Card style={styles.revenue}>
      <View style={styles.revenueTop}>
        <View style={styles.revenueIcon}>
          <Icon name="trending-up" size={20} color={C.white} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="label" color={C.muted} numberOfLines={1}>
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
        <Txt variant="display" numeric numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={`Doanh thu ${money(revenue)} đồng`}>
          {`${money(Math.round(shown ?? revenue))} ₫`}
        </Txt>
      )}
      {showProfit && profit !== undefined ? (
        <View style={styles.profitRow}>
          <View style={[styles.legendDot, { backgroundColor: CHART.profit }]} />
          <Txt variant="label" color={C.muted}>
            Lợi nhuận tạm tính
          </Txt>
          <Txt variant="label" weight="bold" numeric style={{ marginLeft: 'auto' }}>
            {compactMoney(profit)}
          </Txt>
          <Pill label={`biên ${marginText(margin)}`} tone="warning" />
        </View>
      ) : null}
      <Divider />
      <Txt variant="caption" color={C.muted}>
        {caption}
      </Txt>
      {trendLoading && !trend ? (
        <Skeleton width="100%" height={168} radius={10} />
      ) : (
        <TrendChart points={trend ?? []} showProfit={showProfit} />
      )}
    </Card>
  );
}

/**
 * Danh sách xếp hạng có thanh tỷ lệ (bán chạy, khách mua nhiều, chi nhánh).
 * Thanh cùng một màu: độ dài mới là số liệu, màu không mang nghĩa thứ hạng.
 */
export function BarList({ rows, color = CHART.revenue, ranked = true }: { rows: BarRow[]; color?: string; ranked?: boolean }) {
  const dataKey = rows.map((r) => `${r.key}:${r.value}`).join('|');
  return (
    <FadeSwap swapKey={dataKey} skipFirst>
      <View style={{ gap: 14 }}>
        {rows.map((r, i) => (
          <View key={r.key} style={styles.barRow} accessible accessibilityLabel={`${ranked ? `Hạng ${i + 1}, ` : ''}${r.title}: ${r.value}`}>
            {ranked ? (
              <View style={[styles.rank, i < 3 ? styles.rankTop : null]}>
                <Txt variant="caption" weight="bold" color={i < 3 ? C.white : C.muted}>
                  {i + 1}
                </Txt>
              </View>
            ) : null}
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.barHead}>
                <View style={{ flex: 1, gap: 1 }}>
                  <Txt variant="body" weight="medium" numberOfLines={1}>
                    {r.title}
                  </Txt>
                  {r.sub ? (
                    <Txt variant="caption" color={C.muted} numberOfLines={1}>
                      {r.sub}
                    </Txt>
                  ) : null}
                </View>
                <Txt variant="body" weight="bold" numeric>
                  {r.value}
                </Txt>
              </View>
              <Meter share={r.share} color={color} index={i} />
            </View>
          </View>
        ))}
      </View>
    </FadeSwap>
  );
}

/** Cơ cấu doanh thu theo nhóm hàng: thanh tỷ trọng + chú thích từng nhóm. */
export function CategoryBreakdown({ parts }: { parts: CategoryPart[] }) {
  const dataKey = parts.map((p) => `${p.name}:${p.revenue}`).join('|');
  return (
    <FadeSwap swapKey={dataKey} skipFirst>
      <View style={{ gap: 14 }}>
        <SegmentBar parts={parts} />
        <View style={{ gap: 10 }}>
          {parts.map((p) => (
            <View key={p.name} style={styles.legendRow} accessible accessibilityLabel={`${p.name}: ${p.percent}%, ${compactMoney(p.revenue)}`}>
              <View style={[styles.legendDot, { backgroundColor: p.color }]} />
              <Txt variant="body" numberOfLines={1} style={{ flex: 1 }}>
                {p.name}
              </Txt>
              <Txt variant="label" color={C.muted} numeric style={styles.pct}>
                {p.percent}%
              </Txt>
              <Txt variant="body" weight="semibold" numeric style={styles.amount}>
                {compactMoney(p.revenue)}
              </Txt>
            </View>
          ))}
        </View>
      </View>
    </FadeSwap>
  );
}

const AGING_COLOR = { success: toneColors.success.fg, warning: toneColors.warning.fg, danger: toneColors.danger.fg } as const;

/**
 * Công nợ và COD: tổng phải thu, hóa đơn còn nợ, COD đang luân chuyển, phân tuổi nợ.
 * Đặt trong thẻ không có lề ngang (các dòng tự có lề 16).
 */
export function FinanceBlock({ data, supplierDebt }: { data: FinanceData; supplierDebt?: number }) {
  const aging = agingRows(data);
  const shown = aging.filter((a) => a.value > 0);
  const hasAging = shown.length > 0;
  return (
    <View>
      <InfoRow icon="wallet" color="orange" label="Tổng phải thu" sub={overdueNote(data)} value={vnd(data.debt)} valueTone="warning" />
      <Divider inset={64} />
      <InfoRow
        icon="receipt-text"
        color="blue"
        label="Hóa đơn còn phải thu"
        sub={data.unpaidCount > 0 ? `Trung bình ${compactMoney(data.debt / data.unpaidCount)} mỗi hóa đơn` : undefined}
        value={`${money(data.unpaidCount)} hóa đơn`}
      />
      <Divider inset={64} />
      <InfoRow icon="truck" color="teal" label="COD đang luân chuyển" sub={`${money(data.codCount)} đơn`} value={vnd(data.codAmount)} />
      {supplierDebt !== undefined ? (
        <>
          <Divider inset={64} />
          <InfoRow icon="hand-coins" color="slate" label="Nợ nhà cung cấp" sub="Toàn bộ, không theo kỳ" value={vnd(supplierDebt)} />
        </>
      ) : null}

      <View style={styles.aging}>
        <Txt variant="label" weight="semibold" color={C.muted} style={{ marginBottom: 8 }}>
          Phân tuổi nợ
        </Txt>
        {hasAging ? (
          <View style={styles.segments}>
            {shown.map((a, i) => (
              <View
                key={a.key}
                style={{
                  flex: a.share,
                  backgroundColor: AGING_COLOR[a.tone],
                  borderTopLeftRadius: i === 0 ? 5 : 0,
                  borderBottomLeftRadius: i === 0 ? 5 : 0,
                  borderTopRightRadius: i === shown.length - 1 ? 5 : 0,
                  borderBottomRightRadius: i === shown.length - 1 ? 5 : 0,
                }}
              />
            ))}
          </View>
        ) : null}
        <View style={{ gap: 8, marginTop: hasAging ? 10 : 0 }}>
          {aging.map((a) => (
            <View key={a.key} style={styles.legendRow} accessible accessibilityLabel={`${a.label}: ${compactMoney(a.value)}, ${Math.round(a.share * 100)}%`}>
              <View style={[styles.legendDot, { backgroundColor: AGING_COLOR[a.tone] }]} />
              <Txt variant="body" style={{ flex: 1 }}>
                {a.label}
              </Txt>
              <Txt variant="label" color={C.muted} numeric style={styles.pct}>
                {Math.round(a.share * 100)}%
              </Txt>
              <Txt variant="body" weight="semibold" numeric style={styles.amount}>
                {compactMoney(a.value)}
              </Txt>
            </View>
          ))}
        </View>
        <Txt variant="caption" color={C.faint} style={{ marginTop: 10 }}>
          Tuổi nợ tính theo ngày tạo hóa đơn (hệ thống chưa lưu hạn thanh toán).
        </Txt>
      </View>
    </View>
  );
}

/** Một ô số trong hàng 3 ô (thu, chi, chênh lệch…). */
function Figure({ label, value, color, dot }: { label: string; value: string; color?: string; dot?: string }) {
  return (
    <View style={styles.figure} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.figureHead}>
        {dot ? <View style={[styles.legendDot, { backgroundColor: dot }]} /> : null}
        <Txt variant="caption" color={C.muted} numberOfLines={1}>
          {label}
        </Txt>
      </View>
      <Txt variant="heading" numeric numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} color={color ?? C.text}>
        {value}
      </Txt>
    </View>
  );
}

/** Thu chi sổ quỹ: tổng thu, tổng chi, chênh lệch, cột đôi theo thời gian, nhóm chi lớn nhất. */
export function CashflowBlock({ data }: { data: CashflowSummary }) {
  const bars = cashBars(data);
  const payments = paymentRows(data);
  return (
    <View style={{ gap: 14 }}>
      <View style={styles.figures}>
        <Figure label="Tổng thu" value={compactMoney(data.receipt)} dot={CHART.receipt} />
        <Figure label="Tổng chi" value={compactMoney(data.payment)} dot={CHART.payment} />
        <Figure
          label="Chênh lệch"
          value={`${data.net > 0 ? '+' : ''}${compactMoney(data.net)}`}
          color={data.net < 0 ? toneColors.danger.fg : toneColors.success.fg}
        />
      </View>
      {bars.length > 1 ? <PairColumns bars={bars} /> : null}
      {payments.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Txt variant="label" weight="semibold" color={C.muted}>
            Chi nhiều nhất
          </Txt>
          <BarList rows={payments} ranked={false} color={CHART.payment} />
        </View>
      ) : null}
    </View>
  );
}

/** Trả hàng: giá trị, số phiếu, tỷ lệ trên doanh thu, phiếu đang chờ và mặt hàng bị trả nhiều. */
export function ReturnsBlock({ data }: { data: ReturnsSummary }) {
  const rows = returnRows(data);
  return (
    <View style={{ gap: 14 }}>
      <View style={styles.figures}>
        <Figure label="Giá trị trả" value={compactMoney(data.amount)} />
        <Figure label="Số phiếu" value={money(data.count)} />
        <Figure
          label="Tỷ lệ trả"
          value={`${data.rate}%`}
          color={data.rate >= 5 ? toneColors.danger.fg : C.text}
        />
      </View>
      {data.pendingCount > 0 ? <Pill label={`${money(data.pendingCount)} phiếu đang chờ nhận hàng`} tone="warning" /> : null}
      {rows.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Txt variant="label" weight="semibold" color={C.muted}>
            Hàng bị trả nhiều nhất
          </Txt>
          <BarList rows={rows} color={CHART.payment} />
        </View>
      ) : (
        <Txt variant="caption" color={C.muted}>
          Không có phiếu trả hàng trong kỳ này.
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  figures: { flexDirection: 'row', gap: 10 },
  figure: { flex: 1, gap: 2, padding: 10, borderRadius: 12, backgroundColor: C.bg },
  figureHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  emptyState: { paddingVertical: 18, alignItems: 'center' },
  revenue: { padding: 16, gap: 10 },
  revenueTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  revenueIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  pct: { minWidth: 44, textAlign: 'right' },
  amount: { minWidth: 72, textAlign: 'right' },
  barRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  barHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: {
    width: 26,
    height: 26,
    marginTop: 1,
    borderRadius: 13,
    backgroundColor: '#EEF1F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankTop: { backgroundColor: C.brand },
  segments: { flexDirection: 'row', gap: 2, height: 10 },
  aging: { paddingHorizontal: 16, paddingTop: 14 },
});
