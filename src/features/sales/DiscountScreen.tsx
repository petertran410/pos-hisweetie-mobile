import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { money, parseQty } from '@/core/format';
import { C, Card, ChipGroup, MoneyField, SheetHeader, TextField, Txt } from '@/ui';
import { cartTotals, useCart } from './cart';
import { useSalePerms } from './perms';
import type { Discount } from './totals';

/** Giảm giá cả đơn (theo số tiền hoặc %) và phí giao hàng. */
export function DiscountView({
  subtotal,
  initialDiscount,
  initialShipping,
  canDiscount,
  onSave,
}: {
  subtotal: number;
  initialDiscount: Discount;
  initialShipping: number;
  canDiscount: boolean;
  onSave: (d: Discount, shipping: number) => void;
}) {
  const [d, setD] = useState(initialDiscount);
  const [shipping, setShipping] = useState(initialShipping);
  const preview = cartTotals({
    lines: [{ rowId: '', product: { id: 0, code: '', name: '', basePrice: 0 }, quantity: 1, price: subtotal, discount: 0, note: '' }],
    orderDiscount: d,
    shippingFee: shipping,
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Giảm giá và phí ship" actionLabel="Xong" onAction={() => onSave(d, shipping)} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {canDiscount ? (
          <View style={{ gap: 8 }}>
            <Txt variant="label" weight="semibold">
              Giảm giá đơn
            </Txt>
            <ChipGroup
              fill
              options={[
                { value: 'amount', label: 'Theo số tiền' },
                { value: 'percent', label: 'Theo %' },
              ]}
              value={d.type}
              onChange={(type) => setD({ type, value: 0 })}
            />
            {d.type === 'amount' ? (
              <MoneyField label="Số tiền giảm" value={d.value} onChange={(n) => setD({ type: 'amount', value: Math.min(n, subtotal) })} />
            ) : (
              <TextField
                label="Phần trăm giảm"
                value={d.value ? String(d.value).replace('.', ',') : ''}
                onChangeText={(t) => setD({ type: 'percent', value: Math.min(100, Math.round(parseQty(t) * 100) / 100) })}
                keyboardType="decimal-pad"
                placeholder="0"
                right={
                  <Txt variant="body" color={C.muted}>
                    %
                  </Txt>
                }
              />
            )}
          </View>
        ) : null}

        <MoneyField label="Phí giao hàng" value={shipping} onChange={setShipping} />

        <Card style={styles.preview}>
          <Row label="Tổng tiền hàng" value={money(subtotal)} />
          <Row label="Giảm giá" value={preview.orderDiscount ? `-${money(preview.orderDiscount)}` : '0'} />
          <Row label="Phí giao hàng" value={money(preview.shipping)} />
          <View style={styles.divider} />
          <Row label="Khách cần trả" value={`${money(preview.total)} ₫`} strong />
        </Card>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Txt variant={strong ? 'body' : 'label'} weight={strong ? 'semibold' : 'regular'} color={strong ? C.text : C.muted} style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt variant={strong ? 'heading' : 'body'} weight={strong ? 'bold' : 'medium'} numeric>
        {value}
      </Txt>
    </View>
  );
}

export default function DiscountScreen() {
  const perms = useSalePerms();
  const cart = useCart();
  const t = cartTotals(cart);
  return (
    <DiscountView
      subtotal={t.subtotal}
      initialDiscount={cart.orderDiscount}
      initialShipping={cart.shippingFee}
      canDiscount={perms.editDiscount}
      onSave={(d, shipping) => {
        if (perms.editDiscount) cart.setOrderDiscount(d);
        cart.setShippingFee(shipping);
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 18, paddingBottom: 40 },
  preview: { paddingHorizontal: 16, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginVertical: 4 },
});
