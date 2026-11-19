import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money, qty } from '@/core/format';
import { C, Icon, PressableScale, SheetHeader, Txt } from '@/ui';
import type { DocRow } from './api';
import { ALERT_DEF, type DocAlert, type DocKind } from './model';

const DOC_LABEL: Record<DocKind, string> = { invoice: 'Hóa đơn', order: 'Đơn đặt hàng' };
// Chữ chênh lệch như web: text-red-600 (thiếu / bán thấp), text-orange-600 (dư).
const RED = '#DC2626';
const ORANGE = '#EA580C';

const signedMoney = (n: number) => (n > 0 ? `+${money(n)}` : money(n));
const signedQty = (n: number) => (n > 0 ? `+${qty(n)}` : qty(n));

/** Ý nghĩa 1 icon cảnh báo của dòng (phí ship kèm số tiền, như chữ khi rê chuột ở web). */
export function alertMeaning(a: DocAlert, row: Pick<DocRow, 'shippingFee'>): string {
  if (a === 'shippingFee' && row.shippingFee > 0) return `Có phí ship: ${money(row.shippingFee)}`;
  return ALERT_DEF[a].meaning;
}

/** "Bán thấp hơn giá bảng giá, Có phí ship: 30,000" (đọc màn hình). */
export const alertSummary = (row: Pick<DocRow, 'alerts' | 'shippingFee'>) => row.alerts.map((a) => alertMeaning(a, row)).join(', ');

export function AlertIcon({ alert, size = 16 }: { alert: DocAlert; size?: number }) {
  const d = ALERT_DEF[alert];
  return <Icon name={d.icon} size={size} color={d.color} fill={d.fill} strokeWidth={2} />;
}

/** Dãy icon cảnh báo trên thẻ; bấm mở sheet giải thích (web: rê chuột / bấm icon). */
export function DocAlertIcons({ row, onPress }: { row: Pick<DocRow, 'alerts' | 'shippingFee'>; onPress?: () => void }) {
  if (!row.alerts.length) return null;
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      hitSlop={8}
      scaleTo={0.9}
      accessibilityLabel={`Cảnh báo: ${alertSummary(row)}. Xem chi tiết`}
      style={styles.icons}>
      {row.alerts.map((a) => (
        <AlertIcon key={a} alert={a} />
      ))}
    </PressableScale>
  );
}

function Line({ name, sub, diff, color }: { name: string; sub: string; diff: string; color: string }) {
  return (
    <View style={styles.line}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="body" weight="semibold" numberOfLines={2}>
          {name}
        </Txt>
        <Txt variant="caption" color={C.muted} numeric>
          {sub}
        </Txt>
      </View>
      <Txt variant="body" weight="bold" color={color} numeric>
        {diff}
      </Txt>
    </View>
  );
}

function AlertSheetBody({ kind, row, onClose }: { kind: DocKind; row: DocRow; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const price = row.warnings?.price ?? [];
  const quantity = row.warnings?.quantity ?? [];
  const previous = row.warnings?.previousInvoiceCodes ?? [];
  // Đơn tách giao: so với SL đặt còn lại (giống web).
  const split = previous.length > 0;
  const expectedLabel = split ? 'SL đặt còn lại' : 'SL đặt hàng';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title={`Cảnh báo ${row.code}`} onCancel={onClose} cancelLabel="Đóng" />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <Txt variant="label" color={C.muted} numberOfLines={1}>
          {`${DOC_LABEL[kind]} ${row.code} · ${row.customerName}`}
        </Txt>
        {row.alerts.map((a) => {
          const n = a === 'price' ? price.length : a === 'quantity' ? quantity.length : 0;
          const title = a === 'quantity' && row.warnings?.orderCode ? `${alertMeaning(a, row)} ${row.warnings.orderCode}` : alertMeaning(a, row);
          return (
            <View key={a} style={styles.card}>
              <View style={styles.cardHead}>
                <AlertIcon alert={a} size={20} />
                <Txt variant="body" weight="semibold" style={{ flex: 1 }}>
                  {title}
                </Txt>
                {n > 0 ? (
                  <Txt variant="caption" color={C.muted} numeric>
                    {n} sản phẩm
                  </Txt>
                ) : null}
              </View>
              {a === 'price' ? (
                price.length ? (
                  price.map((p, i) => (
                    <Line
                      key={`${p.productCode}-${i}`}
                      name={p.productName}
                      sub={`${p.productCode} · Giá bán ${money(p.price)} · Bảng giá ${money(p.listPrice)}`}
                      diff={signedMoney(p.price - p.listPrice)}
                      color={RED}
                    />
                  ))
                ) : (
                  <Txt variant="caption" color={C.muted}>
                    Có sản phẩm bán thấp hơn giá niêm yết của bảng giá.
                  </Txt>
                )
              ) : null}
              {a === 'quantity' ? (
                <>
                  {split ? (
                    <Txt variant="caption" color="#92400E" style={styles.note}>
                      {`Đơn tách giao: so với SL đặt còn lại = SL đặt − SL đã xuất ở ${previous.join(', ')}.`}
                    </Txt>
                  ) : null}
                  {quantity.map((q, i) => {
                    const diff = q.invoiceQuantity - q.expectedQuantity;
                    const unit = q.unit ? ` ${q.unit}` : '';
                    return (
                      <Line
                        key={`${q.productCode}-${i}`}
                        name={q.productName}
                        sub={`${q.productCode} · SL hóa đơn ${qty(q.invoiceQuantity)}${unit} · ${expectedLabel} ${qty(q.expectedQuantity)}${unit}`}
                        diff={signedQty(diff)}
                        color={diff < 0 ? RED : ORANGE}
                      />
                    );
                  })}
                  <Txt variant="caption" color={C.muted}>
                    {`Chênh lệch = SL hóa đơn − ${expectedLabel}: đỏ là hóa đơn thiếu, cam là hóa đơn dư.`}
                  </Txt>
                </>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Sheet giải thích các cảnh báo của 1 chứng từ (web: hộp thoại khi bấm icon cảnh báo). */
export function DocAlertSheet({ kind, row, onClose }: { kind: DocKind; row: DocRow | null; onClose: () => void }) {
  return (
    <Modal visible={!!row} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {row ? <AlertSheetBody kind={kind} row={row} onClose={onClose} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  icons: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  body: { padding: 16, gap: 14 },
  card: {
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  note: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FFFBEB' },
});
