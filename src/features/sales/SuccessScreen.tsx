import * as Print from 'expo-print';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money } from '@/core/format';
import { errorMessage } from '@/core/http';
import { Appear, Banner, Button, C, Card, EmptyState, Icon, PageBackground, toast, Txt } from '@/ui';
import { easeOut } from '@/ui/motion';
import { renderPrint } from './api';
import { useLastSale, type LastSale } from './CheckoutScreen';
import { useSalePerms } from './perms';

/** Bọc nội dung mẫu in thành trang HTML đầy đủ (giống web). */
export function printDocument(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
@page { margin: 8mm; }
html, body { margin: 0; padding: 0; width: 100%; }
body { font-family: Arial, sans-serif; font-size: 13px; color: #000; overflow-wrap: anywhere; }
table { width: 100% !important; max-width: 100% !important; border-collapse: collapse; }
td, th { padding: 4px 8px; }
img, svg { max-width: 100% !important; height: auto; }
* { box-sizing: border-box; }
</style></head><body><div class="print-content">${content}</div></body></html>`;
}

export function SuccessView({
  sale,
  canPrint,
  printing,
  onPrint,
  onNew,
}: {
  sale: LastSale;
  canPrint: boolean;
  printing?: boolean;
  onPrint: () => void;
  onNew: () => void;
}) {
  const insets = useSafeAreaInsets();
  const what = sale.kind === 'invoice' ? 'hóa đơn' : 'đơn đặt hàng';
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <PageBackground />
      <View style={[styles.body, { paddingTop: insets.top + 48 }]}>
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
              <Txt variant="label" color={C.muted} style={{ flex: 1 }}>
                Khách hàng
              </Txt>
              <Txt variant="body" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
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
            <Banner tone="warning" icon="triangle-alert" title="Lưu ý" message={sale.notes.join('\n')} />
          </Appear>
        ) : null}
      </View>
      <View style={[styles.actions, { paddingBottom: 16 }]}>
        {canPrint ? (
          <Button title={`In ${what}`} icon="printer" variant="outline" onPress={onPrint} loading={printing} />
        ) : null}
        <Button title="Tạo đơn mới" icon="plus" onPress={onNew} />
      </View>
    </View>
  );
}

export default function SuccessScreen() {
  const sale = useLastSale((s) => s.sale);
  const perms = useSalePerms();
  const [printing, setPrinting] = useState(false);

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
      printing={printing}
      onPrint={async () => {
        setPrinting(true);
        try {
          const content = await renderPrint(sale.kind, sale.id);
          await Print.printAsync({ html: printDocument(content) });
        } catch (e) {
          toast.error(errorMessage(e));
        } finally {
          setPrinting(false);
        }
      }}
      onNew={() => {
        useLastSale.setState({ sale: null });
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', paddingHorizontal: 20, gap: 18 },
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
  actions: { paddingHorizontal: 16, gap: 10 },
});
