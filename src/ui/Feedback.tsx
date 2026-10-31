import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type ColorValue } from 'react-native';
import { errorMessage } from '@/core/http';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';
import { C, space, toneColors, type Tone } from './theme';

/** Màn trống: nói rõ vì sao trống và bước tiếp theo. */
export function EmptyState({
  icon = 'tray',
  title,
  message,
  action,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      <Icon name={icon} size={44} color={C.tertiary} />
      <Txt variant="title3" align="center">
        {title}
      </Txt>
      {message ? (
        <Txt variant="subhead" color={C.secondary} align="center">
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
      icon="exclamationmark.triangle"
      title="Không tải được dữ liệu"
      message={errorMessage(error)}
      action={onRetry ? <Button title="Thử lại" variant="secondary" size="medium" onPress={onRetry} /> : null}
    />
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator />
      {label ? (
        <Txt variant="subhead" color={C.secondary}>
          {label}
        </Txt>
      ) : null}
    </View>
  );
}

/** Nhãn trạng thái dạng viên thuốc. */
export function Pill({ label, tone = 'neutral', color }: { label: string; tone?: Tone; color?: ColorValue }) {
  const t = toneColors[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Txt variant="caption" weight="600" color={color ?? t.fg} numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

/** Dải thông báo (cảnh báo / thông tin) trong màn. */
export function Banner({ tone = 'warning', icon, title, message }: { tone?: Tone; icon?: IconName; title: string; message?: string }) {
  const t = toneColors[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]}>
      <Icon name={icon ?? 'exclamationmark.triangle.fill'} size={18} color={t.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="subhead" weight="600" color={t.fg}>
          {title}
        </Txt>
        {message ? (
          <Txt variant="footnote" color={t.fg}>
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
    gap: space.md,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    alignItems: 'flex-start',
  },
});
