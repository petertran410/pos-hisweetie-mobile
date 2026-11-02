import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { dateVN, money, qty } from '@/core/format';
import { usePullRefresh } from '@/core/usePullRefresh';
import {
  C,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  IconBadge,
  PageBackground,
  Pill,
  Skeleton,
  SubHeader,
  TabPanel,
  Txt,
} from '@/ui';
import { useTaskCounts, useTasks, type TaskRow, type TaskType } from './api';
import { isValidTaskType, TASK_ORDER, TASKS, taskStatusLabel } from './model';

function TaskCard({ row, type }: { row: TaskRow; type: TaskType }) {
  const status = taskStatusLabel(type, row.status);
  const isStock = type === 'stock';
  const bad = (type === 'debt' && row.status === 'overdue') || row.status === 'negative' || row.status === 'out';
  const meta = [
    row.code,
    row.branchName,
    row.time ? dateVN(row.time) : undefined,
    type === 'debt' && row.ageDays ? `${row.ageDays} ngày` : undefined,
    isStock && row.minQuality !== undefined ? `tối thiểu ${qty(row.minQuality)}` : undefined,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Card style={styles.card}>
      <IconBadge name={TASKS[type].icon} color={TASKS[type].color} size={40} />
      <View style={{ flex: 1, gap: 4 }}>
        <Txt variant="body" weight="semibold" numberOfLines={2}>
          {row.partner}
        </Txt>
        <Txt variant="caption" color={C.muted} numberOfLines={2}>
          {meta}
        </Txt>
        {status ? <Pill label={status} tone={bad ? 'danger' : 'neutral'} /> : null}
      </View>
      <Txt variant="body" weight="bold" numeric color={bad ? '#B91C1C' : C.text}>
        {isStock ? `${qty(row.value)} ${row.unit ?? ''}`.trim() : money(row.value)}
      </Txt>
    </Card>
  );
}

/** Khung xám thay cho danh sách đang tải. */
function TaskSkeleton() {
  return (
    <View style={styles.skeleton}>
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} style={styles.card}>
          <Skeleton width={40} height={40} radius={12} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="70%" height={16} />
            <Skeleton width="50%" height={12} />
          </View>
          <Skeleton width={72} height={16} />
        </Card>
      ))}
    </View>
  );
}

type Phase = 'loading' | 'error' | 'ready';

/** Danh sách việc cần xử lý; chip phía trên để chuyển nhanh giữa 4 loại. */
export function TaskListView({
  type,
  onTypeChange,
  rows,
  counts,
  loading,
  error,
  refreshing,
  onRefresh,
}: {
  type: TaskType;
  onTypeChange: (type: TaskType) => void;
  rows?: TaskRow[];
  counts?: Partial<Record<TaskType, number>>;
  loading?: boolean;
  error?: unknown;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const phase: Phase = loading ? 'loading' : error ? 'error' : 'ready';
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <PageBackground />
      <SubHeader title="Việc cần xử lý">
        <ChipGroup
          options={TASK_ORDER.map((t) => ({ value: t, label: TASKS[t].short, count: counts?.[t] }))}
          value={type}
          onChange={onTypeChange}
        />
      </SubHeader>
      <TabPanel value={type} order={TASK_ORDER} phase={phase} style={{ flex: 1 }}>
        {loading ? (
          <TaskSkeleton />
        ) : error ? (
          <ErrorState error={error} onRetry={onRefresh} />
        ) : (
          <FlashList
            data={rows ?? []}
            keyExtractor={(row, i) => `${row.code}-${i}`}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 }}
            onRefresh={onRefresh}
            refreshing={!!refreshing}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={
              <EmptyState icon="circle-check" color="green" title="Đã xử lý hết" message={TASKS[type].empty} />
            }
            renderItem={({ item }) => <TaskCard row={item} type={type} />}
          />
        )}
      </TabPanel>
    </View>
  );
}

export default function TaskListScreen() {
  const { type: raw } = useLocalSearchParams<{ type: string }>();
  const type: TaskType = isValidTaskType(raw) ? raw : 'orders';
  const tasks = useTasks(type);
  const pull = usePullRefresh(tasks.refetch);
  const counts = useTaskCounts();
  return (
    <TaskListView
      type={type}
      onTypeChange={(next) => router.setParams({ type: next })}
      rows={tasks.data}
      counts={counts.data}
      loading={tasks.isLoading}
      error={tasks.isError ? tasks.error : undefined}
      refreshing={pull.refreshing}
      onRefresh={pull.onRefresh}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: { paddingHorizontal: 16, paddingTop: 4, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
});
