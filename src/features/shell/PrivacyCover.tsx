import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { C } from '@/ui';
import { Logo } from '../auth/Logo';

/**
 * Che nội dung khi app ra nền: ảnh chụp trong trình chuyển app của iOS sẽ
 * không lộ doanh thu, công nợ, thông tin khách.
 */
export function PrivacyCover() {
  const [covered, setCovered] = useState(AppState.currentState !== 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setCovered(state !== 'active'));
    return () => sub.remove();
  }, []);

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
  cover: { backgroundColor: C.plainBg, alignItems: 'center', justifyContent: 'center' },
});
