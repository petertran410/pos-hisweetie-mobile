import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { money, parseQty, qty } from '@/core/format';
import { Button, C, Card, ChipGroup, EmptyState, MoneyField, QtyField, SheetHeader, TextField, Txt } from '@/ui';
import { useCart, type CartLine } from './cart';
import { Thumb } from './components';
import { useSalePerms, type SalePerms } from './perms';
import { discountAmount, lineTotal } from './totals';

type DiscountKind = 'amount' | 'percent';

/** Sửa 1 dòng: số lượng, giá bán, giảm giá, ghi chú; hoặc xóa khỏi giỏ. */
export function LineEditorView({
  line,
  perms,
  onSave,
  onRemove,
}: {
  line: CartLine;
  perms: SalePerms;
  onSave: (patch: Pick<CartLine, 'quantity' | 'price' | 'discount' | 'note'>) => void;
  onRemove: () => void;
}) {
  const [quantity, setQuantity] = useState(line.quantity);
  const [price, setPrice] = useState(line.price);
  const [discount, setDiscount] = useState(line.discount);
  const [kind, setKind] = useState<DiscountKind>('amount');
  const [percent, setPercent] = useState(0);
  const [note, setNote] = useState(line.note);

  const net = Math.max(0, price - discount);
  const total = lineTotal({ price, quantity, discount: { type: 'amount', value: discount } });
  const unit = line.product.unit ? ` / ${line.product.unit}` : '';

  // Sửa giá bán (giống web): thấp hơn đơn giá thì ghi thành giảm giá, cao hơn thì đổi đơn giá.
  const editNet = (n: number) => {
    if (n <= 0) return;
    if (n < price) setDiscount(price - n);
    else {
      setPrice(n);
      setDiscount(0);
    }
    setPercent(0);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader
        title="Sửa hàng"
        actionLabel="Xong"
        actionDisabled={!(quantity > 0)}
        onAction={() => onSave({ quantity, price, discount, note: note.trim() })}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets>
        <Card style={styles.head}>
          <Thumb uri={line.product.image} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="body" weight="semibold" numberOfLines={2}>
              {line.product.name}
            </Txt>
            <Txt variant="caption" color={C.muted}>
              {line.product.code}
              {line.product.conversionValue ? ` · 1 thùng = ${qty(line.product.conversionValue)} ${line.product.unit ?? ''}` : ''}
            </Txt>
          </View>
        </Card>

        <QtyField label={`Số lượng${line.product.unit ? ` (${line.product.unit})` : ''}`} value={quantity} onChange={setQuantity} />

        <MoneyField
          label={`Giá bán${unit}`}
          value={net}
          onChange={editNet}
          editable={perms.editPrice}
        />
        {!perms.editPrice ? (
          <Txt variant="caption" color={C.muted}>
            Bạn chưa có quyền sửa giá bán.
          </Txt>
        ) : null}

        {perms.editDiscount ? (
          <View style={{ gap: 8 }}>
            <Txt variant="label" weight="semibold">
              Giảm giá trên mỗi {line.product.unit ?? 'đơn vị'}
            </Txt>
            <ChipGroup
              fill
              options={[
                { value: 'amount', label: 'Theo số tiền' },
                { value: 'percent', label: 'Theo %' },
              ]}
              value={kind}
              onChange={(k) => {
                setKind(k);
                setPercent(0);
                setDiscount(0);
              }}
            />
            {kind === 'amount' ? (
              <MoneyField
                label="Số tiền giảm"
                value={discount}
                onChange={(n) => setDiscount(discountAmount(price, { type: 'amount', value: n }))}
              />
            ) : (
              <TextField
                label="Phần trăm giảm"
                value={percent ? String(percent).replace('.', ',') : ''}
                onChangeText={(t) => {
                  const pct = Math.min(100, parseQty(t));
                  setPercent(pct);
                  setDiscount(Math.floor((price * pct) / 100));
                }}
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

        <TextField label="Ghi chú" value={note} onChangeText={setNote} placeholder="Không bắt buộc" maxLength={500} />

        <Card style={styles.total}>
          <Txt variant="label" color={C.muted}>
            Thành tiền
          </Txt>
          <Txt variant="title" numeric>
            {money(total)} ₫
          </Txt>
          {discount > 0 ? (
            <Txt variant="caption" color="#15803D">
              Đã giảm {money(discount * quantity)} ₫
            </Txt>
          ) : null}
        </Card>

        <Button title="Xóa khỏi giỏ" variant="danger" icon="trash" onPress={onRemove} />
      </ScrollView>
    </View>
  );
}

export default function LineEditorScreen() {
  const { rowId } = useLocalSearchParams<{ rowId: string }>();
  const perms = useSalePerms();
  const line = useCart((s) => s.lines.find((l) => l.rowId === rowId));

  if (!line) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SheetHeader title="Sửa hàng" />
        <EmptyState icon="package" color="slate" title="Không còn dòng hàng này" message="Dòng hàng đã bị xóa khỏi giỏ." />
      </View>
    );
  }

  return (
    <LineEditorView
      line={line}
      perms={perms}
      onSave={(patch) => {
        useCart.getState().updateLine(line.rowId, patch);
        router.back();
      }}
      onRemove={() =>
        Alert.alert('Xóa khỏi giỏ?', line.product.name, [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Xóa',
            style: 'destructive',
            onPress: () => {
              router.back();
              useCart.getState().remove(line.rowId);
            },
          },
        ])
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  total: { padding: 16, gap: 2 },
});
