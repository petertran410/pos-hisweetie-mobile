import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from './icons';
import { PressableScale } from './motion';
import { Txt } from './Text';
import { C, gradients, radius, toneColors } from './theme';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';

/**
 * Nút: `primary` nền gradient thương hiệu, `outline` viền màu thương hiệu,
 * `ghost` chỉ có chữ, `danger` viền đỏ (đăng xuất, huỷ).
 */
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
  onLongPress,
  accessibilityHint,
}: {
  title: string;
  onPress?: () => void;
  /** Giữ lâu (vd đổi máy in). */
  onLongPress?: () => void;
  accessibilityHint?: string;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'large' | 'medium' | 'small';
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
}) {
  const height = size === 'large' ? 54 : size === 'medium' ? 46 : 36;
  const fg =
    variant === 'primary' ? C.white : variant === 'danger' ? toneColors.danger.fg : C.brand;
  const inactive = disabled || loading;

  const content = loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <View style={styles.inner}>
      {icon ? <Icon name={icon} size={size === 'small' ? 16 : 20} color={fg} strokeWidth={2.2} /> : null}
      <Txt variant={size === 'small' ? 'label' : 'heading'} weight="semibold" color={fg} numberOfLines={1}>
        {title}
      </Txt>
    </View>
  );

  return (
    <PressableScale
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityLabel={title}
      disabled={inactive}
      haptic={haptic ? 'light' : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityHint={accessibilityHint}
      style={[
        styles.base,
        { height, borderRadius: size === 'small' ? radius.pill : radius.control },
        variant === 'outline' ? styles.outline : null,
        variant === 'danger' ? styles.danger : null,
        { opacity: inactive ? 0.55 : 1 },
        style,
      ]}>
      {variant === 'primary' ? (
        <LinearGradient
          colors={[...gradients.brand]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: size === 'small' ? radius.pill : radius.control }]}
        />
      ) : null}
      {content}
    </PressableScale>
  );
}

/** Nút tròn chỉ có biểu tượng (đầu trang). */
export function IconButton({
  icon,
  onPress,
  label,
  tint = C.text,
  background = C.card,
}: {
  icon: IconName;
  onPress?: () => void;
  label: string;
  tint?: string;
  background?: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      scaleTo={0.9}
      style={[styles.iconButton, { backgroundColor: background }]}>
      <Icon name={icon} size={20} color={tint} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  outline: { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.brand },
  danger: { backgroundColor: C.card, borderWidth: 1.5, borderColor: '#F3B4B4' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
});
