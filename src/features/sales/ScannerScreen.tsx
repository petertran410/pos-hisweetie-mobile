import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money, qty } from '@/core/format';
import { errorMessage } from '@/core/http';
import { useSession } from '@/core/session';
import { Button, C, EmptyState, Icon, LoadingState, PressableScale, toast, Txt } from '@/ui';
import { findProductByCode, usePriceBook } from './api';
import { cartTotals } from './cart';
import { useSalePerms } from './perms';
import { addToCart } from './SalesScreen';
import { useSaleScope, useScopedCart } from './scope';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'qr'] as const;

/** Chưa có quyền camera: nói rõ để làm gì rồi mới hỏi (hoặc mở Cài đặt nếu đã từ chối). */
function PermissionAsk({ canAsk, onAsk }: { canAsk: boolean; onAsk: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 40 }}>
      <EmptyState
        icon="camera"
        color="teal"
        title="Quét mã vạch để thêm hàng"
        message={
          canAsk
            ? 'App cần dùng camera để đọc mã vạch trên bao bì. Ảnh không được lưu hay gửi đi.'
            : 'Bạn đã tắt quyền camera cho app. Mở Cài đặt để bật lại, hoặc tìm hàng bằng ô tìm kiếm.'
        }
        action={
          <View style={{ gap: 10, alignSelf: 'stretch' }}>
            <Button
              title={canAsk ? 'Cho phép dùng camera' : 'Mở Cài đặt'}
              icon="camera"
              onPress={canAsk ? onAsk : () => void Linking.openSettings()}
            />
            <Button title="Để sau" variant="ghost" onPress={() => router.back()} />
          </View>
        }
      />
    </View>
  );
}

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const perms = useSalePerms();
  const branchId = useSession((s) => s.branchId);
  const { store } = useSaleScope();
  const priceBookId = useScopedCart((s) => s.priceBookId);
  const count = useScopedCart((s) => cartTotals(s).itemCount);
  const total = useScopedCart((s) => cartTotals(s).total);
  const book = usePriceBook(priceBookId, perms.priceBooks);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const busy = useRef(false);
  const last = useRef({ code: '', at: 0 });

  if (!permission) return <LoadingState />;
  if (!permission.granted) {
    return <PermissionAsk canAsk={permission.canAskAgain} onAsk={() => void requestPermission()} />;
  }

  const onScanned = async ({ data }: BarcodeScanningResult) => {
    const code = data.trim();
    const now = Date.now();
    // Camera đọc liên tục: bỏ qua cùng 1 mã trong 2 giây để không thêm 2 lần.
    if (!code || busy.current || (code === last.current.code && now - last.current.at < 2000)) return;
    busy.current = true;
    last.current = { code, at: now };
    try {
      const found = await findProductByCode(code, branchId);
      const match = found.find((p) => p.code.toLowerCase() === code.toLowerCase()) ?? (found.length === 1 ? found[0] : undefined);
      if (!match) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        toast.error(found.length ? `Có ${found.length} hàng khớp “${code}”, hãy tìm bằng tên` : `Không tìm thấy hàng có mã “${code}”`);
      } else if (addToCart(match, book.data, 1, store)) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAdded(match.name);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      busy.current = false;
      last.current = { code, at: Date.now() };
    }
  };

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={(r) => void onScanned(r)}
      />
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} accessibilityLabel="Đóng" hitSlop={8} scaleTo={0.9} style={styles.round}>
          <Icon name="x" size={22} color={C.white} />
        </PressableScale>
        <Txt variant="heading" color={C.white}>
          Quét mã vạch
        </Txt>
        <PressableScale
          onPress={() => setTorch((v) => !v)}
          accessibilityLabel={torch ? 'Tắt đèn' : 'Bật đèn'}
          hitSlop={8}
          scaleTo={0.9}
          style={[styles.round, torch ? { backgroundColor: C.white } : null]}>
          <Icon name="flashlight" size={20} color={torch ? C.brandDark : C.white} />
        </PressableScale>
      </View>

      <View style={styles.frameWrap} pointerEvents="none">
        <View style={styles.frame} />
        <Txt variant="label" color={C.white} align="center">
          Đưa mã vạch vào khung
        </Txt>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ flex: 1 }}>
          <Txt variant="caption" color={C.muted} numberOfLines={1}>
            {added ? `Vừa thêm: ${added}` : 'Mỗi lần quét thêm 1 đơn vị'}
          </Txt>
          <Txt variant="heading" numeric>
            {qty(count)} món · {money(total)} ₫
          </Txt>
        </View>
        <Button title="Xong" size="medium" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 14 },
  frame: { width: 260, height: 160, borderRadius: 18, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: C.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});
