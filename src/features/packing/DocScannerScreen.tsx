import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '@/core/http';
import { Button, C, EmptyState, Icon, LoadingState, PressableScale, toast, Txt } from '@/ui';
import { resolveScannedDoc } from './api';
import { addDocsToDraft, usePackDraft } from './draft';

/** Quét mã QR in trên hóa đơn / phiếu ký gửi, thêm thẳng vào phiếu đang nhập (quét liên tục). */
export default function DocScannerScreen() {
  const insets = useSafeAreaInsets();
  const form = usePackDraft((s) => s.form);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const busy = useRef(false);
  const seen = useRef({ code: '', at: 0 });

  if (!form) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 40 }}>
        <EmptyState icon="qr-code" color="slate" title="Không có phiếu đang nhập" action={<Button title="Đóng" variant="outline" onPress={() => router.back()} />} />
      </View>
    );
  }
  if (!permission) return <LoadingState />;
  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 40 }}>
        <EmptyState
          icon="camera"
          color="teal"
          title="Quét QR chứng từ"
          message={
            permission.canAskAgain
              ? 'App cần dùng camera để đọc mã QR in trên hóa đơn. Ảnh không được lưu hay gửi đi.'
              : 'Bạn đã tắt quyền camera cho app. Mở Cài đặt để bật lại, hoặc chọn chứng từ bằng ô tìm kiếm.'
          }
          action={
            <View style={{ gap: 10, alignSelf: 'stretch' }}>
              <Button
                title={permission.canAskAgain ? 'Cho phép dùng camera' : 'Mở Cài đặt'}
                icon="camera"
                onPress={permission.canAskAgain ? () => void requestPermission() : () => void Linking.openSettings()}
              />
              <Button title="Để sau" variant="ghost" onPress={() => router.back()} />
            </View>
          }
        />
      </View>
    );
  }

  const onScanned = async ({ data }: BarcodeScanningResult) => {
    const payload = data.trim();
    const now = Date.now();
    // Camera đọc liên tục: bỏ qua cùng 1 mã trong 1,5 giây, mỗi lần tra 1 mã.
    if (!payload || busy.current || (payload === seen.current.code && now - seen.current.at < 1500)) return;
    busy.current = true;
    seen.current = { code: payload, at: now };
    try {
      const doc = await resolveScannedDoc(payload, form.type);
      if (usePackDraft.getState().form?.docs.some((d) => d.id === doc.id && d.kind === doc.kind)) {
        toast.info(`${doc.code} đã được chọn`);
        return;
      }
      const res = addDocsToDraft([doc]);
      if (res.added) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setLast(`${doc.code}${doc.customerName ? ` · ${doc.customerName}` : ''}`);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        toast.error(res.error ?? `Không thêm được ${doc.code}`);
      }
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(errorMessage(e));
    } finally {
      busy.current = false;
      seen.current = { code: payload, at: Date.now() };
    }
  };

  const word = form.docMode === 'consignment' ? 'phiếu ký gửi' : 'hóa đơn';
  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={(r) => void onScanned(r)}
      />
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} accessibilityLabel="Đóng" hitSlop={8} scaleTo={0.9} style={styles.round}>
          <Icon name="x" size={22} color={C.white} />
        </PressableScale>
        <Txt variant="heading" color={C.white}>
          Quét QR {word}
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
          Đưa mã QR trên {word} vào khung
        </Txt>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ flex: 1 }}>
          <Txt variant="caption" color={C.muted} numberOfLines={1}>
            {last ? `Vừa thêm: ${last}` : `Quét lần lượt từng ${word}`}
          </Txt>
          <Txt variant="heading" numeric>
            Đã chọn {form.docs.length} {word}
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
  frame: { width: 240, height: 240, borderRadius: 22, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
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
