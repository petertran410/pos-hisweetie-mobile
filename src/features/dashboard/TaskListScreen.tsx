import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { dateVN, money, qty } from '@/core/format';
import { C, EmptyState, ErrorState, LoadingState, Pill, Txt, listStyles } from '@/ui';
import { useTasks, type TaskRow, type TaskType } from './api';
import { isValidTaskType, TASKS, taskStatusLabel } from './model';

function TaskItem({ row, type }: { row: TaskRow; type: TaskType }) {
  const status = taskStatusLabel(type, row.status);
  const isStock = type === 'stock';
  const overdue = type === 'debt' && row.status === 'overdue';
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
    <View style={styles.item}>
      <View style={{ flex: 1, gap: 3 }}>
        <Txt numberOfLines={2}>{row.partner}</Txt>
        <Txt variant="footnote" color={C.secondary} numberOfLines={2}>
          {meta}
        </Txt>
        {status ? <Pill label={status} tone={overdue || row.status === 'negative' || row.status === 'out' ? 'danger' : 'neutral'} /> : null}
      </View>
      <Txt variant="headline" numeric color={overdue ? C.danger : C.label}>
        {isStock ? `${qty(row.value)} ${row.unit ?? ''}`.trim() : money(row.value)}
      </Txt>
    </View>
  );
}

export default function TaskListScreen() {
  const { type: raw } = useLocalSearchParams<{ type: string }>();
  const type: TaskType = isValidTaskType(raw) ? raw : 'orders';
  const tasks = useTasks(type);

  return (
    <>
      <Stack.Screen options={{ title: TASKS[type].title }} />
      {tasks.isLoading ? (
        <LoadingState />
      ) : tasks.isError ? (
        <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
      ) : (
        <FlashList
          data={tasks.data ?? []}
          keyExtractor={(row, i) => `${row.code}-${i}`}
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: C.bg }}
          contentContainerStyle={{ paddingVertical: 16 }}
          onRefresh={() => void tasks.refetch()}
          refreshing={tasks.isRefetching}
          ItemSeparatorComponent={() => (
            <View style={styles.sep}>
              <View style={[listStyles.separator, { marginLeft: 16 }]} />
            </View>
          )}
          ListEmptyComponent={<EmptyState icon="checkmark.circle" title="Đã xử lý hết" message={TASKS[type].empty} />}
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.card,
                index === 0 ? styles.first : null,
                index === (tasks.data?.length ?? 0) - 1 ? styles.last : null,
              ]}>
              <TaskItem row={item} type={type} />
            </View>
          )}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, backgroundColor: C.card },
  first: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  last: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  sep: { marginHorizontal: 16, backgroundColor: C.card },
  item: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'flex-start' },
});
