import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { errorMessage } from '@/core/http';
import { Button } from './Button';
import { Icon, type IconName } from './icons';
import { IconBadge } from './Surfaces';
import { Txt } from './Text';
import { C, toneColors, type AccentName, type Tone } from './theme';

/** Màn trống: nói rõ vì sao trống và bước tiếp theo. */
export function EmptyState({
  icon = 'inbox',
  color = 'teal',
  title,
  message,
  action,
}: {
  icon?: IconName;
  color?: AccentName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      <IconBadge name={icon} color={color} size={72} round />
      <Txt variant="heading" align="center">
        {title}
      </Txt>
      {message ? (
        <Txt variant="body" color={C.muted} align="center">
          {message}
        </Txt>
      ) : null}
      {action}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="triangle-alert"
      color="red"
      title="Không tải được dữ liệu"
      message={errorMessage(error)}
      action={onRetry ? <Button title="Thử lại" variant="outline" size="medium" onPress={onRetry} /> : null}
    />
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={C.brand} />
      {label ? (
        <Txt variant="label" color={C.muted}>
          {label}
        </Txt>
      ) : null}
    </View>
  );
}

/** Dải thông báo trong trang (lỗi, cảnh báo, thông tin). */
export function Banner({ tone = 'warning', icon, title, message }: { tone?: Tone; icon?: IconName; title: string; message?: string }) {
  const t = toneColors[tone];
  const name: IconName = icon ?? (tone === 'danger' ? 'circle-x' : tone === 'info' ? 'info' : 'triangle-alert');
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]}>
      <Icon name={name} size={20} color={t.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="label" weight="semibold" color={t.fg}>
          {title}
        </Txt>
        {message ? (
          <Txt variant="caption" color={t.fg}>
            {message}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 12,
  },
  banner: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, alignItems: 'flex-start' },
});
