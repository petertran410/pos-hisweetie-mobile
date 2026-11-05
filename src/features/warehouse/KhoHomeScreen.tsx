import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSession } from '@/core/session';
import { Appear, C, Card, Divider, EmptyState, ErrorState, LoadingState, Page, TitleHeader, Txt } from '@/ui';
import { useFinanceAccess } from './api';
import { KhoTile, RecentRow } from './components';
import { startKhoDraft, useKhoRecent } from './draft';
import { allowedKhoTypes, createBranches, defaultBranch, newKhoForm, type FinanceAccess, type KhoCreated, type KhoType } from './model';

export interface KhoHomeViewProps {
  types: KhoType[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  recent: KhoCreated[];
  onCreate: (t: KhoType) => void;
  now?: Date;
}

/** Trang Phiếu kho: chọn loại phiếu để tạo + các phiếu vừa tạo trên máy này. */
export function KhoHomeView(p: KhoHomeViewProps) {
  // Ô xếp 2 cột như web.
  const rows: KhoType[][] = [];
  for (let i = 0; i < p.types.length; i += 2) rows.push(p.types.slice(i, i + 2));

  let body;
  if (p.loading) body = <LoadingState />;
  else if (p.error) body = <ErrorState error={p.error} onRetry={p.onRetry} />;
  else if (!p.types.length)
    body = <EmptyState icon="lock" color="slate" title="Chưa có quyền tạo phiếu kho" message="Tài khoản chưa được cấp quyền tạo phiếu ở kho nào. Liên hệ quản lý để được cấp quyền." />;
  else
    body = (
      <View style={{ gap: 20 }}>
        <Appear index={0}>
          <View style={{ gap: 10 }}>
            <Txt variant="heading">Tạo phiếu kho</Txt>
            {rows.map((row) => (
              <View key={row.join('-')} style={styles.tiles}>
                {row.map((t) => (
                  <KhoTile key={t} type={t} onPress={() => p.onCreate(t)} />
                ))}
                {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
              </View>
            ))}
          </View>
        </Appear>
        {p.recent.length ? (
          <Appear index={1}>
            <View style={{ gap: 8 }}>
              <Txt variant="heading">Vừa tạo</Txt>
              <Card style={{ paddingVertical: 4 }}>
                {p.recent.map((it, i) => (
                  <View key={`${it.type}-${it.id}`}>
                    {i ? <Divider /> : null}
                    <RecentRow item={it} now={p.now} />
                  </View>
                ))}
              </Card>
              <Txt variant="caption" color={C.muted}>
                Phiếu bạn tạo trên máy này từ lúc mở app. Kế toán kho kiểm tra, duyệt phiếu trên web.
              </Txt>
            </View>
          </Appear>
        ) : null}
      </View>
    );

  return <Page header={<TitleHeader title="Phiếu kho" />}>{body}</Page>;
}

/** Mở form tạo phiếu: chi nhánh mặc định theo chi nhánh đang chọn (nếu được phép), người chi là chính mình. */
export function openKhoForm(type: KhoType, access: FinanceAccess) {
  const { user, branchId } = useSession.getState();
  const payer = type !== 'tien-mat' && user ? { id: user.id, name: user.name ?? '' } : null;
  startKhoDraft(newKhoForm(type, defaultBranch(createBranches(access, type), branchId), payer));
  router.push('/phieu-kho/phieu' as never);
}

export default function KhoHomeScreen() {
  const access = useFinanceAccess();
  const recent = useKhoRecent((s) => s.items);
  return (
    <KhoHomeView
      types={access.data ? allowedKhoTypes(access.data) : []}
      loading={access.isLoading}
      error={access.isError ? access.error : undefined}
      onRetry={() => void access.refetch()}
      recent={recent}
      onCreate={(t) => {
        if (access.data) openKhoForm(t, access.data);
      }}
    />
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 10 },
});
