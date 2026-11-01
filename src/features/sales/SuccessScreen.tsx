import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money } from '@/core/format';
import { Appear, Banner, Button, C, Card, Divider, EmptyState, Icon, PageBackground, PressableScale, Txt } from '@/ui';
import { easeOut } from '@/ui/motion';
import { useLastSale, type LastSale } from './CheckoutScreen';
import { useSalePerms } from './perms';
import { parseStockWarning } from './warnings';

/** Hàng chưa đủ tồn: gọn 1 dòng, bấm để xem từng món. */
function StockWarnings({ warnings }: { warnings: string[] }) {
  const [open, setOpen] = useState(false);
  const items = warnings.map(parseStockWarning);
  return (
    <Card style={styles.stock}>
      <PressableScale
        onPress={() => setOpen((v) => !v)}
        accessibilityLabel={`${items.length} món chưa đủ tồn kho. ${open ? 'Bấm để ẩn' : 'Bấm để xem'}`}
        accessibilityState={{ expanded: open }}
        scaleTo={0.98}
        style={styles.stockHead}>
        <View style={styles.stockIcon}>
          <Icon name="triangle-alert" size={20} color="#B45309" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="body" weight="semibold">
            {items.length} món chưa đủ tồn kho
          </Txt>
          <Txt variant="caption" color={C.muted}>
            Đơn vẫn được tạo. Kiểm tra hàng trước khi giao.
          </Txt>
        </View>
        <Txt variant="label" weight="semibold" color={C.brand}>
          {open ? 'Ẩn' : 'Xem'}
        </Txt>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} color={C.brand} />
      </PressableScale>
      {open ? (
        <Appear>
          {items.map((it, i) => (
            <View key={i}>
              <Divider inset={14} />
              <View style={styles.stockRow}>
                <Txt variant="label" numberOfLines={2} style={{ flex: 1 }}>
                  {it.name}
                </Txt>
                {it.need !== undefined ? (
                  <Txt variant="caption" weight="semibold" color="#B91C1C" numeric>
                    Có {it.have} · Cần {it.need}
                  </Txt>
                ) : null}
              </View>
            </View>
          ))}
        </Appear>
      ) : null}
    </Card>
  );
}

export function SuccessView({
  sale,
  canPrint,
  onPrint,
  onNew,
}: {
  sale: LastSale;
  canPrint: boolean;
  onPrint: () => void;
  onNew: () => void;
}) {
  const insets = useSafeAreaInsets();
  const what = sale.kind === 'invoice' ? 'hóa đơn' : 'đơn đặt hàng';
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <PageBackground />
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 40 }]}>
        <Animated.View entering={ZoomIn.duration(360).easing(easeOut)} style={styles.check}>
          <Icon name="check" size={44} color={C.white} strokeWidth={2.8} />
        </Animated.View>
        <Appear index={1} style={{ alignItems: 'center', gap: 6 }}>
          <Txt variant="title" align="center">
            Đã tạo {what}
          </Txt>
          <Txt variant="display" color={C.brand} numeric>
            {sale.code}
          </Txt>
        </Appear>
        <Appear index={2} style={{ alignSelf: 'stretch' }}>
          <Card style={styles.card}>
            <View style={styles.row}>
              <Txt variant="label" color={C.muted}>
                Khách hàng
              </Txt>
              <Txt variant="body" weight="semibold" numberOfLines={1} align="right" style={{ flex: 1 }}>
                {sale.customerName}
              </Txt>
            </View>
            <View style={styles.row}>
              <Txt variant="label" color={C.muted} style={{ flex: 1 }}>
                Khách cần trả
              </Txt>
              <Txt variant="heading" weight="bold" numeric>
                {money(sale.total)} ₫
              </Txt>
            </View>
          </Card>
        </Appear>
        {sale.notes.length ? (
          <Appear index={3} style={{ alignSelf: 'stretch' }}>
            <Banner tone="warning" icon="triangle-alert" title="Cần làm thêm" message={sale.notes.join('\n')} />
          </Appear>
        ) : null}
        {sale.stockWarnings.length ? (
          <Appear index={4} style={{ alignSelf: 'stretch' }}>
            <StockWarnings warnings={sale.stockWarnings} />
          </Appear>
        ) : null}
      </ScrollView>
      <View style={styles.actions}>
        {canPrint ? (
          <Button title={`Xem và in ${what}`} icon="printer" variant="outline" onPress={onPrint} />
        ) : null}
        <Button title="Tạo đơn mới" icon="plus" onPress={onNew} />
      </View>
    </View>
  );
}

export default function SuccessScreen() {
  const sale = useLastSale((s) => s.sale);
  const perms = useSalePerms();

  if (!sale) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 80 }}>
        <EmptyState
          icon="receipt"
          color="slate"
          title="Không có đơn vừa tạo"
          action={<Button title="Về màn bán hàng" variant="outline" size="medium" onPress={() => router.back()} />}
        />
      </View>
    );
  }

  return (
    <SuccessView
      sale={sale}
      canPrint={perms.print}
      onPrint={() =>
        router.push({ pathname: '/ban-hang/phieu-in', params: { kind: sale.kind, id: String(sale.id), code: sale.code } })
      }
      onNew={() => {
        useLastSale.setState({ sale: null });
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 24, gap: 18 },
  check: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stock: { overflow: 'hidden' },
  stockHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  stockIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
});
