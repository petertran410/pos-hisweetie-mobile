import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ColorValue,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';
import { C, radius, space } from './theme';

/**
 * Màn cuộn nền xám nhóm (kiểu Cài đặt). `contentInsetAdjustmentBehavior`
 * để tiêu đề lớn + thanh tìm kiếm của header hoạt động đúng.
 */
export function Screen({
  children,
  refreshing,
  onRefresh,
  contentStyle,
  ...rest
}: ScrollViewProps & {
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={[styles.content, contentStyle]}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
      }
      {...rest}>
      {children}
    </ScrollView>
  );
}

/** Nhóm thẻ bo góc có tiêu đề nhỏ phía trên và chú thích phía dưới. */
export function Section({
  title,
  footer,
  right,
  children,
  separatorInset = space.lg,
  style,
}: {
  title?: string;
  footer?: string;
  right?: ReactNode;
  children?: ReactNode;
  separatorInset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.section, style]}>
      {title || right ? (
        <View style={styles.sectionHeader}>
          {title ? (
            <Txt variant="footnote" color={C.secondary} style={{ flex: 1 }}>
              {title}
            </Txt>
          ) : null}
          {right}
        </View>
      ) : null}
      {items.length > 0 ? (
        <View style={styles.card}>
          {items.map((child, i) => (
            <Fragment key={child.key ?? i}>
              {i > 0 ? <View style={[styles.separator, { marginLeft: separatorInset }]} /> : null}
              {child}
            </Fragment>
          ))}
        </View>
      ) : null}
      {footer ? (
        <Txt variant="footnote" color={C.secondary} style={styles.sectionFooter}>
          {footer}
        </Txt>
      ) : null}
    </View>
  );
}

/** Thẻ trắng bo góc đứng riêng. */
export function Card({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export interface RowProps {
  title: string;
  subtitle?: string;
  value?: string;
  valueColor?: ColorValue;
  icon?: IconName;
  iconColor?: ColorValue;
  iconBackground?: ColorValue;
  /** Nội dung tự do bên phải (thay cho `value`). */
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  chevron?: boolean;
  checked?: boolean;
  destructive?: boolean;
  tinted?: boolean;
  disabled?: boolean;
  numberOfLines?: number;
}

/** Dòng danh sách chuẩn iOS: biểu tượng, tiêu đề, phụ đề, giá trị, mũi tên. */
export function Row({
  title,
  subtitle,
  value,
  valueColor,
  icon,
  iconColor,
  iconBackground,
  right,
  onPress,
  onLongPress,
  chevron,
  checked,
  destructive,
  tinted,
  disabled,
  numberOfLines = 1,
}: RowProps) {
  const titleColor = destructive ? C.danger : tinted ? C.tint : disabled ? C.tertiary : C.label;
  const body = (
    <>
      {icon ? (
        <View style={[styles.rowIcon, iconBackground ? { backgroundColor: iconBackground } : null]}>
          <Icon name={icon} size={iconBackground ? 17 : 22} color={iconColor ?? (iconBackground ? '#FFFFFF' : C.tint)} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt color={titleColor} numberOfLines={numberOfLines}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="footnote" color={C.secondary} numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ??
        (value ? (
          <Txt color={valueColor ?? C.secondary} numeric numberOfLines={1} style={styles.rowValue}>
            {value}
          </Txt>
        ) : null)}
      {checked ? <Icon name="checkmark" size={17} weight="semibold" /> : null}
      {chevron ? <Icon name="chevron.right" size={13} weight="semibold" color={C.tertiary} /> : null}
    </>
  );
  if (!onPress && !onLongPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: C.fillStrong } : null]}>
      {body}
    </Pressable>
  );
}

/** Dòng "nhãn — giá trị" gọn cho phần tổng tiền. */
export function KeyValue({
  label,
  value,
  strong,
  valueColor,
}: {
  label: string;
  value: string;
  strong?: boolean;
  valueColor?: ColorValue;
}) {
  return (
    <View style={styles.kv}>
      <Txt variant={strong ? 'headline' : 'subhead'} color={strong ? C.label : C.secondary}>
        {label}
      </Txt>
      <Txt variant={strong ? 'headline' : 'subhead'} color={valueColor ?? C.label} numeric>
        {value}
      </Txt>
    </View>
  );
}

export const listStyles = StyleSheet.create({
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.separator },
});

const styles = StyleSheet.create({
  content: { paddingBottom: 40, gap: 0 },
  section: { marginTop: 22, marginHorizontal: space.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space.lg,
    marginBottom: 7,
    gap: space.sm,
  },
  sectionFooter: { paddingHorizontal: space.lg, marginTop: 7 },
  card: { backgroundColor: C.card, borderRadius: radius.card, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.separator },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: 11,
    gap: space.md,
    backgroundColor: C.card,
  },
  rowIcon: {
    width: 29,
    height: 29,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowValue: { maxWidth: '55%', textAlign: 'right' },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 34,
    gap: space.md,
  },
});
