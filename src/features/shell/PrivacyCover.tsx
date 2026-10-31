import { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { C } from '@/ui';
import { Logo } from '../auth/Logo';

/**
 * Che nội dung khi app ra nền: ảnh chụp trong trình chuyển app của iOS sẽ
 * không lộ doanh thu, công nợ, thông tin khách.
 */
export function PrivacyCover() {
  // Chỉ cần trên iPhone (trình chuyển app chụp màn hình); bỏ qua trên web.
  const native = Platform.OS !== 'web';
  const [covered, setCovered] = useState(native && AppState.currentState !== 'active');

  useEffect(() => {
    if (!native) return;
    const sub = AppState.addEventListener('change', (state) => setCovered(state !== 'active'));
    return () => sub.remove();
  }, [native]);

  if (!covered) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.cover]}>
      <Logo size={72} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
});
