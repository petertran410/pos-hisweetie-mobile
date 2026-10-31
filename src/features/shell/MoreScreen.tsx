import { router } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { API_ORIGIN, APP_VERSION } from '@/core/config';
import { canDo } from '@/core/permissions';
import { currentBranch, signOut, useSession } from '@/core/session';
import { Avatar, C, Card, Row, Screen, Section, Txt, type IconName } from '@/ui';
import { useTabs } from './tabs';

interface MenuItem {
  key: string;
  title: string;
  icon: IconName;
  color: string;
  allowed: boolean;
  /** Chưa có thì hiện "Sắp có" và không bấm được. */
  href?: string;
}

export default function MoreScreen() {
  const user = useSession((s) => s.user);
  useSession((s) => s.branchId);
  const branches = useSession((s) => s.branches);
  const branch = currentBranch();
  const { overflow } = useTabs();
  const can = (p: string) => canDo(user, p);
  const hasReport = !!user && (user.roles.includes('Super Admin') || user.permissions.some((p) => p.startsWith('reports:')));

  const candidates: MenuItem[] = [
    ...overflow.map<MenuItem>((t) => ({
      key: t.key,
      title: t.label,
      icon: t.iconSelected,
      color: '#1A5F6A',
      allowed: true,
      href: t.key === 'tong-quan' ? '/tong-quan' : undefined,
    })),
    { key: 'hang-hoa', title: 'Hàng hóa', icon: 'cube.box.fill', color: '#2F7A4F', allowed: can('products:view') },
    { key: 'so-quy', title: 'Sổ quỹ', icon: 'book.closed.fill', color: '#975A16', allowed: can('cash_flows:view') },
    {
      key: 'bien-dong',
      title: 'Biến động số dư',
      icon: 'building.columns.fill',
      color: '#1F5AA6',
      allowed: can('sepay:view'),
    },
    { key: 'bao-cao', title: 'Báo cáo', icon: 'chart.pie.fill', color: '#8E44AD', allowed: hasReport },
    {
      key: 'quan-tri',
      title: 'Quản trị',
      icon: 'gearshape.2.fill',
      color: '#636366',
      allowed: can('users:view') || can('roles:view') || can('branches:view'),
    },
  ];
  const items = candidates.filter((i) => i.allowed);

  const confirmSignOut = () =>
    Alert.alert('Đăng xuất?', 'Bạn sẽ cần đăng nhập lại để dùng ứng dụng trên máy này.', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => void signOut() },
    ]);

  return (
    <Screen>
      <Card style={styles.profile}>
        <Avatar name={user?.name} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="title3" numberOfLines={1}>
            {user?.name}
          </Txt>
          <Txt variant="footnote" color={C.secondary} numberOfLines={1}>
            {user?.email}
          </Txt>
          {user?.roles?.length ? (
            <Txt variant="footnote" color={C.secondary} numberOfLines={1}>
              {user.roles.join(', ')}
            </Txt>
          ) : null}
        </View>
      </Card>

      <Section footer="Số liệu, quyền và đơn hàng hiển thị theo chi nhánh đang chọn." separatorInset={57}>
        <Row
          icon="building.2.fill"
          iconBackground={C.tint}
          title="Chi nhánh"
          value={branch?.name ?? 'Chưa chọn'}
          chevron={branches.length > 1}
          onPress={branches.length > 1 ? () => router.push('/chi-nhanh') : undefined}
        />
      </Section>

      {items.length > 0 ? (
        <Section title="Quản lý" separatorInset={57}>
          {items.map((item) => (
            <Row
              key={item.key}
              icon={item.icon}
              iconBackground={item.color}
              title={item.title}
              value={item.href ? undefined : 'Sắp có'}
              chevron={!!item.href}
              onPress={item.href ? () => router.push(item.href as never) : undefined}
            />
          ))}
        </Section>
      ) : null}

      <Section title="Ứng dụng">
        <Row title="Phiên bản" value={APP_VERSION} />
        {/* Chỉ hiện khi dev: không đưa địa chỉ backend lên giao diện người dùng. */}
        {__DEV__ ? <Row title="Máy chủ (dev)" value={API_ORIGIN.replace(/^https?:\/\//, '')} /> : null}
      </Section>

      <Section>
        <Row title="Đăng xuất" destructive onPress={confirmSignOut} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { marginTop: 12, marginHorizontal: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
});
