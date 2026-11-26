import { router, useLocalSearchParams } from 'expo-router';
import { canDo } from '@/core/can';
import { useSession } from '@/core/session';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { money, parseQty, percentInput, qty } from '@/core/format';
import { Button, C, Card, ChipGroup, EmptyState, Icon, MoneyField, QtyField, SheetHeader, TextField, Txt } from '@/ui';
import { useProductDetail } from '../products/api';
import { useLineStock, useProductPriceHistory, type StockCell } from './api';
import type { CartLine } from './cart';
import { PriceHistoryCard, StockCard, Thumb, type PriceHistoryState } from './components';
import { useSalePerms, type SalePerms } from './perms';
import { useSaleScope, useScopedCart } from './scope';
import { discountAmount, lineTotal } from './totals';

type DiscountKind = 'amount' | 'percent';

/** Sửa 1 dòng: số lượng, giá bán, giảm giá, ghi chú; hoặc xóa khỏi giỏ. */
export function LineEditorView({
  line,
  perms,
  history,
  stock,
  onOpenProduct,
  image,
  onSave,
  onRemove,
}: {
  line: CartLine;
  perms: SalePerms;
  /** Giá khách đã mua món này (không có = chưa chọn khách / không có quyền: ẩn). */
  history?: PriceHistoryState;
  /** Số tồn tại chi nhánh (không có = không có quyền xem tồn: ẩn). */
  stock?: StockCell[];
  /** Bấm khung sản phẩm: xem chi tiết hàng hóa (không có = không có quyền xem hàng hóa). */
  onOpenProduct?: () => void;
  /** Ảnh thay khi dòng hàng chưa có ảnh (dòng lấy từ đơn / hóa đơn không kèm ảnh). */
  image?: string | null;
  onSave: (patch: Pick<CartLine, 'quantity' | 'price' | 'discount' | 'note'>) => void;
  onRemove: () => void;
}) {
  const [quantity, setQuantity] = useState(line.quantity);
  const [price, setPrice] = useState(line.price);
  const [discount, setDiscount] = useState(line.discount);
  const [kind, setKind] = useState<DiscountKind>('amount');
  // Chữ đang gõ ở ô %, giữ nguyên chữ để gõ được số lẻ ("12." → "12.5").
  const [percentText, setPercentText] = useState('');
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
    setPercentText('');
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
        <Card
          onPress={onOpenProduct}
          accessibilityLabel={onOpenProduct ? `${line.product.name}. Bấm để xem chi tiết hàng hóa` : undefined}
          style={styles.head}>
          <Thumb uri={line.product.image || image} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="body" weight="semibold" numberOfLines={2}>
              {line.product.name}
            </Txt>
            <Txt variant="caption" color={C.muted}>
              {line.product.code}
              {line.product.conversionValue ? ` · 1 thùng = ${qty(line.product.conversionValue)} ${line.product.unit ?? ''}` : ''}
            </Txt>
          </View>
          {onOpenProduct ? <Icon name="chevron-right" size={18} color={C.faint} /> : null}
        </Card>

        {stock ? <StockCard cells={stock} unit={line.product.unit} /> : null}

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

        {history ? <PriceHistoryCard {...history} /> : null}

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
                setPercentText('');
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
                value={percentText}
                onChangeText={(t) => {
                  const text = percentInput(t);
                  setPercentText(text);
                  const pct = parseQty(text);
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
  const { store, paths } = useSaleScope();
  const line = useScopedCart((s) => s.lines.find((l) => l.rowId === rowId));
  // Dòng chưa có ảnh (vd mở từ xử lý đơn / hóa đơn): lấy ảnh từ chi tiết hàng hóa
  // (dùng chung bộ nhớ đệm với sheet chi tiết hàng hóa mở từ khung này).
  const productDetail = useProductDetail(line?.product.id ?? 0, perms.products && !!line && !line.product.image);
  const fallbackImage = productDetail.data?.images?.find((i) => !!i.image)?.image ?? null;
  const customerId = useScopedCart((s) => s.customer?.id);
  const user = useSession((s) => s.user);
  // Giống web: chỉ người được sửa giá mới xem lịch sử giá (API cần quyền xem đơn hàng).
  const showHistory = perms.editPrice && canDo(user, 'orders:view') && !!customerId;
  const history = useProductPriceHistory(customerId, line?.product.id ?? 0, showHistory);
  // Dòng tồn như web POS: cần quyền xem tồn khi bán; từng số còn theo quyền của API đó.
  const stock = useLineStock(
    line?.product.id ?? 0,
    line?.product.onHand,
    {
      inventory: canDo(user, 'inventory:view'),
      customerOrdered: canDo(user, 'orders:view'),
      supplierOrdered: canDo(user, 'order_suppliers:view'),
      inTransit: canDo(user, 'products:view') || canDo(user, 'transfers:view'),
    },
    perms.viewStock,
  );

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
      stock={perms.viewStock ? stock : undefined}
      image={fallbackImage}
      onOpenProduct={
        perms.products
          ? () => router.push({ pathname: paths.product, params: { id: String(line.product.id), chiXem: '1' } } as never)
          : undefined
      }
      history={
        showHistory
          ? {
              rows: history.data ?? [],
              loading: history.isLoading,
              error: history.isError ? history.error : undefined,
              onRetry: () => void history.refetch(),
            }
          : undefined
      }
      onSave={(patch) => {
        store.getState().updateLine(line.rowId, patch);
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
              store.getState().remove(line.rowId);
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
