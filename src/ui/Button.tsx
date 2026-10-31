import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';
import { C, radius } from './theme';

type Variant = 'primary' | 'secondary' | 'plain' | 'destructive';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  size = 'large',
  style,
  haptic,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'large' | 'medium' | 'small';
  style?: StyleProp<ViewStyle>;
  /** Rung nhẹ khi bấm (thao tác quan trọng). */
  haptic?: boolean;
}) {
  const height = size === 'large' ? 54 : size === 'medium' ? 44 : 34;
  const bg =
    variant === 'primary' ? C.tint : variant === 'secondary' ? C.tintSoft : variant === 'destructive' ? C.dangerSoft : 'transparent';
  const fg = variant === 'primary' ? C.onTint : variant === 'destructive' ? C.danger : C.tint;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        { height, backgroundColor: bg, opacity: inactive ? 0.5 : pressed ? 0.75 : 1 },
        size === 'small' ? { paddingHorizontal: 12, borderRadius: radius.pill } : null,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.inner}>
          {icon ? <Icon name={icon} size={size === 'small' ? 15 : 19} color={fg} weight="semibold" /> : null}
          <Txt
            variant={size === 'small' ? 'subhead' : 'headline'}
            weight="600"
            color={fg}
            numberOfLines={1}>
            {title}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
