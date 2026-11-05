import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { money, qty } from '@/core/format';
import { C, gradients, Icon, Pill, PressableScale, QtyStepper, radius, shadow, Txt } from '@/ui';
import type { CartLine, SaleProduct } from './cart';
import { mediaUri } from '@/core/config';

/** Ảnh sản phẩm (chỉ nhận https ở bản phát hành); không có ảnh thì hiện biểu tượng. */
export function Thumb({ uri, size = 52 }: { uri?: string | null; size?: number }) {
  const src = uri ? mediaUri(uri) : null;
  const ok = !!src && (src.startsWith('https://') || (__DEV__ && src.startsWith('http://')));
  return (
    <View style={[styles.thumb, { width: size, height: size }]}>
      {ok ? (
        <Image source={{ uri: src as string }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : (
        <Icon name="package" size={size * 0.42} color={C.faint} />
      )}
    </View>
  );
}

/** "Tồn 42 gói" — đỏ khi hết/âm. */
export function StockText({ onHand, unit }: { onHand?: number | null; unit?: string | null }) {
  if (onHand === null || onHand === undefined) return null;
  const bad = onHand <= 0;
  return (
    <Txt variant="caption" color={bad ? '#B91C1C' : C.muted} numeric>
      {bad ? `Hết hàng (${qty(onHand)})` : `Tồn ${qty(onHand)}${unit ? ` ${unit}` : ''}`}
    </Txt>
  );
}

/** Một dòng hàng trong danh sách chọn: bấm + để thêm, đã có trong giỏ thì hiện − SL +. */
export function ProductRow({
  product,
  price,
  inCart,
  showStock,
  onAdd,
  onChangeQty,
}: {
  product: SaleProduct;
  price: number;
  inCart: number;
  showStock: boolean;
  onAdd: () => void;
  onChangeQty: (n: number) => void;
}) {
  return (
    <View style={styles.product}>
      <PressableScale onPress={onAdd} accessibilityLabel={`Thêm ${product.name}`} scaleTo={0.985} style={styles.productMain}>
        <Thumb uri={product.image} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="body" weight="semibold" numberOfLines={2}>
            {product.name}
          </Txt>
          <Txt variant="caption" color={C.muted} numberOfLines={1}>
            {product.code}
            {product.unit ? ` · ${product.unit}` : ''}
          </Txt>
          {showStock ? <StockText onHand={product.onHand} unit={product.unit} /> : null}
        </View>
      </PressableScale>
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <Txt variant="body" weight="bold" numeric>
          {money(price)}
        </Txt>
        {inCart > 0 ? (
          <QtyStepper value={inCart} onChange={onChangeQty} size="small" label={product.name} />
        ) : (
          <PressableScale onPress={onAdd} haptic="selection" accessibilityLabel={`Thêm ${product.name}`} hitSlop={6} scaleTo={0.88} style={styles.addBtn}>
            <Icon name="plus" size={18} color={C.white} strokeWidth={2.4} />
          </PressableScale>
        )}
      </View>
    </View>
  );
}

/** Thanh giỏ hàng nổi ở cuối màn chọn hàng. */
export function CartBar({
  count,
  total,
  onPress,
  action = 'Thanh toán',
}: {
  count: number;
  total: number;
  onPress: () => void;
  /** Chữ bên phải thanh (mặc định "Thanh toán"). */
  action?: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="light"
      scaleTo={0.97}
      accessibilityLabel={`Giỏ hàng ${qty(count)} món, ${money(total)} đồng. ${action}`}
      style={styles.cartBarWrap}>
      <LinearGradient colors={[...gradients.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cartBar}>
        <View style={styles.cartIcon}>
          <Icon name="shopping-cart" size={20} color={C.white} />
          <View style={styles.badge}>
            <Txt variant="caption" weight="bold" color={C.brandDark} numeric>
              {qty(count)}
            </Txt>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="caption" color="rgba(255,255,255,0.85)">
            Tạm tính
          </Txt>
          <Txt variant="heading" weight="bold" color={C.white} numeric>
            {money(total)} ₫
          </Txt>
        </View>
        <Txt variant="body" weight="semibold" color={C.white}>
          {action}
        </Txt>
        <Icon name="chevron-right" size={20} color={C.white} />
      </LinearGradient>
    </PressableScale>
  );
}

/** Nhãn của dòng lấy từ đơn: quà tặng, mua ưu đãi, bục rách, cận date. */
function lineTags(line: CartLine): { label: string; gift: boolean }[] {
  const o = line.origin;
  if (!o) return [];
  return [
    o.lineType === 'gift' ? { label: 'Quà tặng', gift: true } : null,
    o.lineType === 'discounted_buy' ? { label: 'Mua ưu đãi', gift: true } : null,
    o.conditionType === 'damaged' ? { label: 'Bục rách', gift: false } : null,
    o.conditionType === 'near_expiry' ? { label: 'Cận date', gift: false } : null,
  ].filter((t): t is { label: string; gift: boolean } => !!t);
}

/** Một dòng trong giỏ: tên, đơn giá × SL, thành tiền; bấm để sửa. `locked`: chỉ xem. */
export function LineRow({
  line,
  total,
  onPress,
  onChangeQty,
  locked,
}: {
  line: CartLine;
  total: number;
  onPress: () => void;
  onChangeQty: (n: number) => void;
  locked?: boolean;
}) {
  const net = line.price - line.discount;
  const tags = lineTags(line);
  return (
    <View style={styles.line}>
      <PressableScale
        onPress={locked ? undefined : onPress}
        disabled={locked}
        accessibilityLabel={locked ? line.product.name : `Sửa ${line.product.name}`}
        scaleTo={0.985}
        style={{ flex: 1, gap: 3 }}>
        <Txt variant="body" weight="semibold" numberOfLines={2}>
          {line.product.name}
        </Txt>
        {tags.length ? (
          <View style={styles.tags}>
            {tags.map((t) => (
              <Pill key={t.label} label={t.label} tone={t.gift ? 'success' : 'warning'} />
            ))}
          </View>
        ) : null}
        <Txt variant="caption" color={C.muted} numeric>
          {line.discount > 0 ? (
            <>
              <Txt variant="caption" color={C.faint} style={styles.strike}>
                {money(line.price)}
              </Txt>{' '}
              {money(net)}
            </>
          ) : (
            money(line.price)
          )}
          {line.product.unit ? ` / ${line.product.unit}` : ''}
        </Txt>
        {line.note ? (
          <Txt variant="caption" color={C.muted} numberOfLines={1}>
            Ghi chú: {line.note}
          </Txt>
        ) : null}
        {locked ? null : (
          <Txt variant="caption" weight="semibold" color={C.brand}>
            Sửa
          </Txt>
        )}
      </PressableScale>
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <Txt variant="body" weight="bold" numeric>
          {money(total)}
        </Txt>
        {locked ? (
          <Txt variant="label" color={C.muted} numeric>
            SL {qty(line.quantity)}
          </Txt>
        ) : (
          <QtyStepper value={line.quantity} onChange={onChangeQty} min={1} size="small" label={line.product.name} />
        )}
      </View>
    </View>
  );
}

/** Dòng tổng kết: nhãn trái, số phải. */
export function SumRow({
  label,
  value,
  strong,
  tone,
  onPress,
  hint,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
  tone?: 'danger' | 'success';
  onPress?: () => void;
  hint?: string;
}) {
  const color = tone === 'danger' ? '#B91C1C' : tone === 'success' ? '#15803D' : C.text;
  const body = (
    <View style={styles.sum}>
      <View style={{ flex: 1 }}>
        <Txt variant={strong ? 'body' : 'label'} weight={strong ? 'semibold' : 'regular'} color={strong ? C.text : C.muted}>
          {label}
        </Txt>
        {hint ? (
          <Txt variant="caption" color={C.faint}>
            {hint}
          </Txt>
        ) : null}
      </View>
      {typeof value === 'string' ? (
        <Txt variant={strong ? 'heading' : 'body'} weight={strong ? 'bold' : 'medium'} color={color} numeric>
          {value}
        </Txt>
      ) : (
        value
      )}
      {onPress ? <Icon name="chevron-right" size={16} color={C.faint} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} scaleTo={0.98}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  thumb: {
    borderRadius: 12,
    backgroundColor: '#F1F5F8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBarWrap: { borderRadius: 18, ...shadow, shadowOpacity: 0.18, shadowRadius: 14 },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  cartIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  strike: { textDecorationLine: 'line-through' },
  sum: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, minHeight: 40 },
});
