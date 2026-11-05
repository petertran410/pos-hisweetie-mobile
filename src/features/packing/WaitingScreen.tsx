import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money } from '@/core/format';
import { resolvePeriod, type PeriodChoice } from '@/core/period';
import { useSession } from '@/core/session';
import { useDebounced } from '@/core/useDebounced';
import { usePullRefresh } from '@/core/usePullRefresh';
import {
  Button,
  C,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  PeriodModal,
  periodText,
  PressableScale,
  radius,
  SearchField,
  SubHeader,
  toast,
  toneColors,
  Txt,
} from '@/ui';
import { PERIOD_FILTERS } from '../orders/model';
import { useDeliveryOverview } from './api';
import { startPackDraft } from './draft';
import { newPackForm, packPerms, waitingStatus, waitingToDoc, type WaitingInvoice } from './model';

const STATUS_BG = { warning: toneColors.warning.bg, danger: toneColors.danger.bg, info: '#DBEAFE', violet: '#EDE9FE' } as const;
const STATUS_FG = { warning: toneColors.warning.fg, danger: toneColors.danger.fg, info: '#1D4ED8', violet: '#6D28D9' } as const;

/** Đơn chờ giao (đang lấy hàng / loading): chọn nhiều đơn cùng chi nhánh rồi tạo phiếu giao hàng (giống web). */
export default function WaitingScreen() {
  const insets = useSafeAreaInsets();
  const user = useSession((s) => s.user);
  const branchId = useSession((s) => s.branchId);
  const perms = packPerms(user);
  const [period, setPeriod] = useState<PeriodChoice>('today');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 350);
  const [picked, setPicked] = useState<Map<number, WaitingInvoice>>(() => new Map());
  // Đổi chi nhánh thì bỏ chọn (đơn khác chi nhánh không gộp chung 1 phiếu được).
  const [pickedBranch, setPickedBranch] = useState(branchId);
  if (pickedBranch !== branchId) {
    setPickedBranch(branchId);
    setPicked(new Map());
  }
  const q = useDeliveryOverview(period, term, perms.list);
  const pull = usePullRefresh(q.refetch);
  const pages = q.data?.pages ?? [];
  const rows = pages.flatMap((p) => p.rows);
  const stats = pages[0]?.stats;
  const canCreate = perms.create('giao-hang');

  const toggle = (w: WaitingInvoice) =>
    setPicked((cur) => {
      const next = new Map(cur);
      if (next.has(w.id)) {
        next.delete(w.id);
        return next;
      }
      const first = [...next.values()][0];
      if (first && first.branchId !== w.branchId) {
        toast.error('Chỉ chọn được đơn cùng chi nhánh');
        return cur;
      }
      next.set(w.id, w);
      return next;
    });

  const createSlip = () => {
    const list = [...picked.values()];
    if (!list.length) return;
    startPackDraft(newPackForm('giao-hang', list[0].branchId ?? branchId, list.map(waitingToDoc)));
    setPicked(new Map());
    router.push('/bao-don/phieu' as never);
  };

  const header = (
    <View style={{ gap: 12, paddingBottom: 10 }}>
      <View style={styles.stats}>
        {[
          { label: 'Tổng đơn', value: stats?.total, color: C.text },
          { label: 'Đã giao', value: stats?.delivered, color: '#15803D' },
          { label: 'Chưa giao', value: stats?.pending, color: '#B45309' },
        ].map((c) => (
          <View key={c.label} style={{ flex: 1, gap: 2 }}>
            <Txt variant="caption" color={C.muted}>
              {c.label}
            </Txt>
            <Txt variant="heading" weight="bold" color={c.color} numeric>
              {money(c.value ?? 0)}
            </Txt>
          </View>
        ))}
      </View>
      <View style={styles.summary}>
        <Txt variant="label" color={C.muted} style={{ flex: 1 }} numeric>
          {pages[0] ? `${money(pages[0].total)} đơn đang chờ giao` : ' '}
        </Txt>
        <PressableScale onPress={() => setPeriodOpen(true)} accessibilityLabel={`Thời gian: ${periodText(PERIOD_FILTERS, period)}`} scaleTo={0.95} style={styles.pill}>
          <Icon name="clock" size={15} color={C.brand} />
          <Txt variant="label" weight="semibold" color={C.brand} numeric>
            {periodText(PERIOD_FILTERS, period)}
          </Txt>
          <Icon name="chevron-down" size={15} color={C.brand} />
        </PressableScale>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SubHeader title="Đơn chờ giao">
        <SearchField value={search} onChangeText={setSearch} placeholder="Tìm mã hóa đơn, khách" />
      </SubHeader>
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}
          ListHeaderComponent={header}
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          keyboardDismissMode="on-drag"
          ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={C.brand} style={{ marginTop: 12 }} /> : null}
          ListEmptyComponent={<EmptyState icon="truck" color="slate" title="Không có đơn chờ giao" message="Các hóa đơn đã loading và chưa giao sẽ hiện ở đây." />}
          renderItem={({ item }) => {
            const on = picked.has(item.id);
            return (
              <View style={{ paddingBottom: 8 }}>
                <PressableScale
                  onPress={canCreate ? () => toggle(item) : undefined}
                  disabled={!canCreate}
                  accessibilityRole={canCreate ? 'checkbox' : undefined}
                  accessibilityState={canCreate ? { checked: on } : undefined}
                  accessibilityLabel={`${item.code}, ${item.customerName ?? ''}`}
                  scaleTo={0.985}
                  style={[styles.row, on ? styles.rowOn : null]}>
                  {canCreate ? (
                    <View style={[styles.box, on ? styles.boxOn : null]}>{on ? <Icon name="check" size={14} color={C.white} strokeWidth={3} /> : null}</View>
                  ) : null}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="label" weight="semibold" numeric>
                      {item.code}
                    </Txt>
                    <Txt variant="caption" color={C.muted} numberOfLines={1}>
                      {item.customerName ?? '—'}
                    </Txt>
                    <View style={[styles.status, { backgroundColor: STATUS_BG[waitingStatus(item).tone] }]}>
                      <Txt variant="caption" weight="semibold" color={STATUS_FG[waitingStatus(item).tone]}>
                        {waitingStatus(item).label}
                      </Txt>
                    </View>
                  </View>
                </PressableScale>
              </View>
            );
          }}
        />
      )}
      {canCreate && picked.size ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Button title={`Tạo phiếu giao hàng (${picked.size} đơn)`} icon="truck" onPress={createSlip} />
        </View>
      ) : null}
      <PeriodModal
        visible={periodOpen}
        title="Thời gian"
        options={PERIOD_FILTERS.filter((o) => o.value !== 'all')}
        value={period}
        initialRange={resolvePeriod(period)}
        onChange={(v) => {
          setPeriodOpen(false);
          setPeriod(v);
        }}
        onClose={() => setPeriodOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', padding: 14, borderRadius: radius.card, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: '#CFE3E6',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  rowOn: { borderColor: C.brand, borderWidth: 1.5 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#C3CFD9', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: C.brand, borderColor: C.brand },
  status: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginTop: 2 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
});
