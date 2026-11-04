import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, StyleSheet, View } from 'react-native';
import { API_ORIGIN, APP_VERSION } from '@/core/config';
import { dateTimeVN } from '@/core/format';
import type { PermissionHolder } from '@/core/can';
import { currentBranch, signOut, useSession } from '@/core/session';
import { ActionCard, Appear, Avatar, Button, C, Card, gradients, InfoRow, Page, Section, TitleHeader, toast, Txt } from '@/ui';
import { allowedShortcuts } from '../dashboard/shortcuts';
import { applyAppUpdate, checkForAppUpdate, useAppUpdate } from './appUpdate';
import { useTabs } from './tabs';

/** Chức năng xem ở tab Thêm (những gì không có trên thanh tab). */
const MORE_KEYS = ['hang-hoa', 'so-quy', 'bien-dong', 'bao-cao', 'quan-tri', 'bao-don'] as const;

const DESCRIPTIONS: Record<string, string> = {
  'hang-hoa': 'Giá, tồn kho theo chi nhánh',
  'so-quy': 'Phiếu thu, phiếu chi, tồn quỹ',
  'bien-dong': 'Tiền vào tài khoản ngân hàng',
  'bao-cao': 'Bán hàng, hàng hóa, khách hàng, tài chính',
  'quan-tri': 'Người dùng, vai trò, chi nhánh',
  'bao-don': 'Giao hàng, đóng hàng, loading',
};

export interface MoreViewProps {
  user: (PermissionHolder & { name?: string | null; email?: string | null }) | null;
  branchName?: string;
  canSwitchBranch: boolean;
  hiddenTabKeys: string[];
  onOpenBranch: () => void;
  onOpen: (key: string, href?: string) => void;
  onSignOut: () => void;
  /** Cập nhật qua mạng; không có = không hiện (dev, web). */
  update?: {
    pending: boolean;
    busy: boolean;
    /** Thời điểm tạo bản đang chạy; null = bản cài đặt gốc. */
    runningSince: Date | null;
    onCheck: () => void;
    onApply: () => void;
  };
}

export function MoreView({ user, branchName, canSwitchBranch, hiddenTabKeys, onOpenBranch, onOpen, onSignOut, update }: MoreViewProps) {
  const items = allowedShortcuts(user).filter(
    (s) => (MORE_KEYS as readonly string[]).includes(s.key) && (s.key !== 'bao-don' || hiddenTabKeys.includes('bao-don')),
  );

  return (
    <Page header={<TitleHeader title="Thêm" />}>
      <Appear index={0}>
      <LinearGradient colors={[...gradients.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profile}>
        <View style={styles.avatarRing}>
          <Avatar name={user?.name} size={56} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="heading" color={C.white} numberOfLines={1}>
            {user?.name}
          </Txt>
          <Txt variant="label" weight="regular" color="rgba(255,255,255,0.88)" numberOfLines={1}>
            {user?.email}
          </Txt>
          {user?.roles?.length ? (
            <Txt variant="caption" color="rgba(255,255,255,0.88)" numberOfLines={1}>
              {user.roles.join(', ')}
            </Txt>
          ) : null}
        </View>
      </LinearGradient>
      </Appear>

      <Section index={1} title="Chi nhánh">
        <ActionCard
          icon="store"
          color="teal"
          title={branchName ?? 'Chưa chọn chi nhánh'}
          subtitle="Số liệu, quyền và đơn hàng theo chi nhánh này"
          onPress={canSwitchBranch ? onOpenBranch : undefined}
        />
      </Section>

      {items.length > 0 ? (
        <Section index={2} title="Quản lý">
          <View style={{ gap: 10 }}>
            {items.map((item) => (
              <ActionCard
                key={item.key}
                icon={item.icon}
                color={item.color}
                title={item.label.replace('\n', ' ')}
                subtitle={DESCRIPTIONS[item.key]}
                badge={item.href ? undefined : 'Sắp có'}
                onPress={() => onOpen(item.key, item.href)}
              />
            ))}
          </View>
        </Section>
      ) : null}

      <Section index={3} title="Ứng dụng">
        <Card>
          <InfoRow icon="smartphone" color="slate" label="Phiên bản" value={APP_VERSION} />
          {update ? (
            <InfoRow
              icon="refresh-cw"
              color="slate"
              label="Bản cập nhật"
              value={update.runningSince ? dateTimeVN(update.runningSince) : 'Bản cài đặt'}
            />
          ) : null}
          {__DEV__ ? (
            <InfoRow icon="info" color="slate" label="Máy chủ (chỉ hiện khi dev)" value={API_ORIGIN.replace(/^https?:\/\//, '')} />
          ) : null}
        </Card>
        {update?.pending ? (
          <ActionCard
            icon="download"
            color="teal"
            title="Có bản cập nhật mới"
            subtitle="Đã tải xong. Bấm để cập nhật, app tự mở lại trong vài giây."
            onPress={update.onApply}
          />
        ) : update ? (
          <Button title="Kiểm tra cập nhật" icon="refresh-cw" variant="outline" size="medium" loading={update.busy} onPress={update.onCheck} />
        ) : null}
      </Section>

      <View style={{ marginTop: 24 }}>
        <Button title="Đăng xuất" icon="log-out" variant="danger" onPress={onSignOut} />
      </View>
    </Page>
  );
}

export default function MoreScreen() {
  const user = useSession((s) => s.user);
  useSession((s) => s.branchId);
  const branches = useSession((s) => s.branches);
  // Tab có quyền nhưng không còn chỗ trên thanh tab → hiện ở đây.
  const hiddenTabKeys = useTabs().overflow.map((t) => t.key);
  const app = useAppUpdate();

  const confirmSignOut = () =>
    Alert.alert('Đăng xuất?', 'Bạn sẽ cần đăng nhập lại để dùng ứng dụng trên máy này.', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => void signOut() },
    ]);

  return (
    <MoreView
      user={user}
      branchName={currentBranch()?.name}
      canSwitchBranch={branches.length > 1}
      hiddenTabKeys={hiddenTabKeys}
      onOpenBranch={() => router.push('/chi-nhanh')}
      onOpen={(_key, href) => {
        if (href) router.navigate(href as never);
        else toast.info('Chức năng này sẽ có ở bản cập nhật tới');
      }}
      onSignOut={confirmSignOut}
      update={
        app.enabled
          ? {
              pending: app.pending,
              busy: app.busy,
              runningSince: app.runningSince,
              onApply: () => void applyAppUpdate(),
              onCheck: () =>
                void checkForAppUpdate().then((r) => {
                  // Tải xong thì hộp hỏi cập nhật tự hiện (UpdateWatcher).
                  if (r === 'latest') toast.success('Bạn đang dùng bản mới nhất');
                  if (r === 'error') toast.error('Chưa kiểm tra được, kiểm tra mạng rồi thử lại');
                }),
            }
          : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  profile: {
    marginTop: 4,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarRing: { padding: 3, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.35)' },
});
