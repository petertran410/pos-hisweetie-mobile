import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { Icon } from './Icon';
import { Txt } from './Text';
import { C } from './theme';

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
  const icon = kind === 'success' ? 'checkmark.circle.fill' : kind === 'error' ? 'xmark.octagon.fill' : 'info.circle.fill';
  const color = kind === 'success' ? C.success : kind === 'error' ? C.danger : C.tint;
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
        <Txt variant="subhead" weight="600" style={{ flexShrink: 1 }}>
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
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
});
