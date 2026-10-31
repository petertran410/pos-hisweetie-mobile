import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { initials } from '@/core/format';
import { Appear, PressableScale } from './motion';
import { Icon, type IconName } from './icons';
import { Txt } from './Text';
import { accents, accentSoft, C, gradients, radius, shadow, space, toneColors, type AccentName, type Tone } from './theme';

/** Nền gradient nhẹ dùng chung cho mọi trang. */
export function PageBackground() {
  return (
    <LinearGradient
      colors={[...gradients.page]}
      locations={[0, 0.35, 1]}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}

/**
 * Trang: nền gradient + đầu trang (tuỳ chọn) + nội dung cuộn, kéo xuống để
 * làm mới. Đầu trang cuộn theo nội dung; `stickyHeader` để giữ cố định
 * (trang con có nút quay lại).
 */
export function Page({
  header,
  stickyHeader,
  children,
  refreshing,
  onRefresh,
  scroll = true,
  contentStyle,
  footer,
  ...rest
}: ScrollViewProps & {
  header?: ReactNode;
  stickyHeader?: boolean;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const headerInScroll = scroll && !stickyHeader;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <PageBackground />
      <View style={{ flex: 1 }}>
        {headerInScroll ? null : header}
        {scroll ? (
          <ScrollView
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, contentStyle]}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.brand} />
              ) : undefined
            }
            {...rest}>
            {headerInScroll && header ? <View style={styles.scrollHeader}>{header}</View> : null}
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
        )}
      </View>
      {footer}
    </View>
  );
}

/** Thẻ trắng bo góc, viền mảnh, bóng nhẹ. */
export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel} scaleTo={0.98} style={[styles.card, style]}>
      {children}
    </PressableScale>
  );
}

/** Tiêu đề khu + liên kết bên phải ("Xem tất cả"). */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Txt variant="heading" style={{ flex: 1 }}>
        {title}
      </Txt>
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} hitSlop={10} accessibilityRole="link" scaleTo={0.94}>
          <Txt variant="label" weight="semibold" color={C.brand}>
            {actionLabel}
          </Txt>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Khu nội dung: tiêu đề + phần thân, cách đều nhau. */
export function Section({
  title,
  actionLabel,
  onAction,
  children,
  style,
  index,
}: {
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Thứ tự hiện dần khi mở màn (bỏ trống = hiện ngay). */
  index?: number;
}) {
  const body = (
    <>
      {title ? <SectionHeader title={title} actionLabel={actionLabel} onAction={onAction} /> : null}
      {children}
    </>
  );
  if (index === undefined) return <View style={[styles.section, style]}>{body}</View>;
  return (
    <Appear index={index} style={[styles.section, style]}>
      {body}
    </Appear>
  );
}

/** Ô biểu tượng màu (nền nhạt + icon đậm). */
export function IconBadge({
  name,
  color = 'teal',
  size = 40,
  round,
}: {
  name: IconName;
  color?: AccentName;
  size?: number;
  round?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: round ? size / 2 : size * 0.3,
        backgroundColor: accentSoft[color],
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name={name} size={Math.round(size * 0.52)} color={accents[color]} />
    </View>
  );
}

export function Avatar({ name, size = 40 }: { name?: string | null; size?: number }) {
  return (
    <LinearGradient
      colors={[...gradients.brand]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Txt
        weight="semibold"
        color={C.white}
        style={{ fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.48) }}>
        {initials(name)}
      </Txt>
    </LinearGradient>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: inset }} />;
}

/** Nhãn trạng thái. */
export function Pill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = toneColors[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Txt variant="caption" weight="semibold" color={t.fg} numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

/** Dòng "nhãn … giá trị" trong một thẻ. */
export function InfoRow({
  icon,
  color,
  label,
  sub,
  value,
  valueTone,
  strong,
}: {
  icon?: IconName;
  color?: AccentName;
  label: string;
  sub?: string;
  value: string;
  valueTone?: Tone;
  strong?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      {icon ? <IconBadge name={icon} color={color} size={36} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="body" weight={strong ? 'semibold' : 'medium'} numberOfLines={2}>
          {label}
        </Txt>
        {sub ? (
          <Txt variant="caption" color={C.muted} numberOfLines={1}>
            {sub}
          </Txt>
        ) : null}
      </View>
      <Txt
        variant="body"
        weight="bold"
        numeric
        color={valueTone ? toneColors[valueTone].fg : C.text}
        numberOfLines={1}>
        {value}
      </Txt>
    </View>
  );
}

export const surfaceStyles = StyleSheet.create({
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingBottom: 32, gap: 0 },
  scrollHeader: { marginHorizontal: -space.lg },
  card: {
    backgroundColor: C.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    ...shadow,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  section: { marginTop: 24, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
  },
});
