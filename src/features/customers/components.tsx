import { StyleSheet, View } from 'react-native';
import { dateTimeVN, dateVN, money } from '@/core/format';
import { Avatar, C, Pill, PressableScale, toneColors, Txt } from '@/ui';
import type { DocRow } from '../orders/api';
import { isCancelled, statusOf, type DocKind } from '../orders/model';
import type { CustomerRow, DebtEntry } from './model';

/** Thẻ 1 khách trong danh sách. */
export function CustomerCard({ row, showDebt, onPress }: { row: CustomerRow; showDebt: boolean; onPress: () => void }) {
  const debt = showDebt && row.totalDebt > 0;
  const a11y = [
    row.name,
    row.code,
    row.phone,
    row.isActive ? null : 'ngừng hoạt động',
    debt ? `nợ ${money(row.totalDebt)} đồng` : null,
    `đã mua ${money(row.totalPurchased)} đồng`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <PressableScale onPress={onPress} accessibilityLabel={a11y} scaleTo={0.985} style={[styles.card, row.isActive ? null : { opacity: 0.62 }]}>
      <Avatar name={row.name} size={44} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.top}>
          <Txt variant="body" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {row.name}
          </Txt>
          {row.isActive ? null : <Pill label="Ngừng" tone="danger" />}
        </View>
        <Txt variant="caption" color={C.muted} numeric numberOfLines={1}>
          {[row.code, row.phone].filter(Boolean).join(' · ')}
        </Txt>
        {row.isCompany || row.isChild ? (
          <View style={styles.tags}>
            {row.isCompany ? <Pill label="Tổ chức" tone="brand" /> : null}
            {row.isChild ? <Pill label="Khách con" tone="neutral" /> : null}
          </View>
        ) : null}
        {row.address ? (
          <Txt variant="caption" color={C.faint} numberOfLines={1}>
            {row.address}
          </Txt>
        ) : null}
      </View>
      <View style={styles.right}>
        {debt ? (
          <>
            <Txt variant="caption" color={C.muted}>
              Nợ
            </Txt>
            <Txt variant="body" weight="bold" numeric color={toneColors.danger.fg}>
              {money(row.totalDebt)}
            </Txt>
          </>
        ) : (
          <>
            <Txt variant="caption" color={C.muted}>
              Đã mua
            </Txt>
            <Txt variant="body" weight="semibold" numeric>
              {money(row.totalPurchased)}
            </Txt>
          </>
        )}
      </View>
    </PressableScale>
  );
}

/** 1 hóa đơn / đơn đặt hàng trong lịch sử của khách. */
export function HistoryCard({ kind, row, showDebt, onPress }: { kind: DocKind; row: DocRow; showDebt: boolean; onPress?: () => void }) {
  const st = statusOf(kind, row.status);
  const cancelled = isCancelled(kind, row.status);
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      accessibilityLabel={`${row.code}, ${dateVN(row.date)}, ${money(row.grandTotal)} đồng, ${st.label}`}
      scaleTo={0.985}
      style={[styles.doc, cancelled ? { opacity: 0.6 } : null]}>
      <View style={styles.docRow}>
        <Txt variant="body" weight="bold" numeric style={{ flex: 1 }}>
          {row.code}
        </Txt>
        <Pill label={st.label} tone={st.tone} />
      </View>
      <View style={styles.docRow}>
        <Txt variant="caption" color={C.muted} numeric numberOfLines={1} style={{ flex: 1 }}>
          {[dateTimeVN(row.date), row.sellerName].filter(Boolean).join(' · ')}
        </Txt>
        <Txt variant="body" weight="bold" numeric style={cancelled ? styles.strike : null}>
          {money(row.grandTotal)}
        </Txt>
      </View>
      {showDebt && !cancelled && row.debtAmount > 0 ? (
        <Txt variant="caption" weight="semibold" color={toneColors.danger.fg} numeric align="right">
          Còn nợ {money(row.debtAmount)}
        </Txt>
      ) : null}
    </PressableScale>
  );
}

/** 1 dòng lịch sử công nợ. */
export function DebtRow({ e, showCustomer, onPress }: { e: DebtEntry; showCustomer: boolean; onPress?: () => void }) {
  const up = e.delta > 0;
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      accessibilityLabel={`${e.label} ${e.code}, ${up ? 'tăng' : 'giảm'} ${money(Math.abs(e.delta))} đồng, dư nợ ${money(e.balance)} đồng`}
      scaleTo={0.985}
      style={styles.debt}>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.docRow}>
          <Txt variant="label" weight="semibold" numeric numberOfLines={1} style={{ flexShrink: 1 }}>
            {e.code || e.label}
          </Txt>
          <Txt variant="caption" color={C.muted} numberOfLines={1}>
            {e.label}
          </Txt>
        </View>
        <Txt variant="caption" color={C.muted} numeric numberOfLines={1}>
          {[dateTimeVN(e.date), showCustomer ? e.customerName : null, e.branchName].filter(Boolean).join(' · ')}
        </Txt>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Txt variant="body" weight="bold" numeric color={up ? toneColors.danger.fg : toneColors.success.fg}>
          {up ? '+' : '−'}
          {money(Math.abs(e.delta))}
        </Txt>
        <Txt variant="caption" color={C.muted} numeric>
          Dư nợ {money(e.balance)}
        </Txt>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 1 },
  right: { alignItems: 'flex-end', gap: 1, maxWidth: '38%' },
  doc: { gap: 4, padding: 12, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  strike: { textDecorationLine: 'line-through', color: C.muted },
  debt: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
});
