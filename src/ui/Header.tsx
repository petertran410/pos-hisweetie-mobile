import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from './Button';
import { Icon } from './icons';
import { PressableScale } from './motion';
import { Avatar } from './Surfaces';
import { Txt } from './Text';
import { C } from './theme';

/** Đầu trang chính: lời chào + avatar (như màn "Welcome back!"). */
export function HomeHeader({
  greeting,
  title,
  userName,
  onAvatarPress,
  children,
}: {
  greeting: string;
  title: string;
  userName?: string | null;
  onAvatarPress?: () => void;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.home, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="label" weight="regular" color={C.muted} numberOfLines={1}>
            {greeting}
          </Txt>
          <Txt variant="title" numberOfLines={1}>
            {title}
          </Txt>
        </View>
        <PressableScale onPress={onAvatarPress} accessibilityLabel="Tài khoản" hitSlop={6} scaleTo={0.9}>
          <Avatar name={userName} size={44} />
        </PressableScale>
      </View>
      {children}
    </View>
  );
}

/** Đầu trang tab (tiêu đề lớn, không có nút quay lại). */
export function TitleHeader({ title, right, children }: { title: string; right?: ReactNode; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.home, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        <Txt variant="title" style={{ flex: 1 }} numberOfLines={1}>
          {title}
        </Txt>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Đầu trang con: ‹ quay lại, tiêu đề, nút thao tác. */
export function SubHeader({
  title,
  right,
  onBack,
  children,
}: {
  title: string;
  right?: ReactNode;
  onBack?: () => void;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.sub, { paddingTop: insets.top + 6 }]}>
      <View style={styles.row}>
        <PressableScale
          onPress={onBack ?? (() => router.back())}
          accessibilityLabel="Quay lại"
          hitSlop={10}
          scaleTo={0.85}
          style={styles.back}>
          <Icon name="arrow-left" size={24} color={C.text} />
        </PressableScale>
        <Txt variant="heading" style={{ flex: 1, fontSize: 19 }} numberOfLines={1}>
          {title}
        </Txt>
        {right}
      </View>
      {children}
    </View>
  );
}

export { IconButton };

const styles = StyleSheet.create({
  home: { paddingHorizontal: 16, paddingBottom: 12, gap: 14 },
  sub: { paddingHorizontal: 12, paddingBottom: 10, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  back: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
});
