import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { Icon } from './icons';
import { Txt } from './Text';
import { C, shadow, toneColors } from './theme';

type Kind = 'success' | 'error' | 'info';
const useToastStore = create<{ message: string | null; kind: Kind; seq: number }>(() => ({
  message: null,
  kind: 'info',
  seq: 0,
}));

function show(kind: Kind, message: string) {
  if (kind === 'error') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  useToastStore.setState((s) => ({ message, kind, seq: s.seq + 1 }));
}

/** Thông báo ngắn ở đầu màn hình. */
export const toast = {
  success: (message: string) => show('success', message),
  error: (message: string) => show('error', message),
  info: (message: string) => show('info', message),
};

/** Đặt 1 lần ở layout gốc. */
export function ToastHost() {
  const { message, kind, seq } = useToastStore();
  const insets = useSafeAreaInsets();
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!message) return;
    anim.setValue(0);
    Animated.sequence([
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }),
      Animated.delay(2600),
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) useToastStore.setState({ message: null });
    });
  }, [seq, message, anim]);

  if (!message) return null;
  const icon = kind === 'success' ? 'circle-check' : kind === 'error' ? 'circle-x' : 'info';
  const color = kind === 'success' ? toneColors.success.fg : kind === 'error' ? toneColors.danger.fg : C.brand;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center' }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          {
            marginTop: insets.top + 8,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
          },
        ]}>
        <Icon name={icon} size={20} color={color} />
        <Txt variant="label" weight="semibold" style={{ flexShrink: 1 }}>
          {message}
        </Txt>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '90%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    ...shadow,
    shadowOpacity: 0.12,
  },
});
