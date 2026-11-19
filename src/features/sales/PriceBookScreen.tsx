import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '@/core/http';
import { useSession } from '@/core/session';
import { C, EmptyState, ErrorState, fold, Icon, LoadingState, PressableScale, SearchField, SheetHeader, toast, Txt } from '@/ui';
import { fetchPriceBook, useApplicablePriceBooks, type PriceBookSummary } from './api';
import { useSalePerms } from './perms';
import { rememberPriceBook } from './persist';
import { useSaleScope, useScopedCart } from './scope';

const GENERAL: PriceBookSummary = { id: 0, name: 'Bảng giá chung' };

/** Chọn bảng giá: tìm theo tên (không dấu cũng được), bấm để áp vào giỏ / đơn đang sửa. */
export function PriceBookView({
  books,
  loading,
  error,
  onRetry,
  selectedId,
  busyId,
  onPick,
  hint = 'Giá trong giỏ sẽ đổi theo bảng giá bạn chọn.',
}: {
  books: PriceBookSummary[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  selectedId: number;
  busyId?: number | null;
  onPick: (b: PriceBookSummary) => void;
  /** Dòng chú thích dưới ô tìm. */
  hint?: string;
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const key = fold(q);
  const all = [GENERAL, ...books];
  const shown = key ? all.filter((b) => fold(b.name).includes(key)) : all;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Bảng giá" cancelLabel="Đóng" />
      <View style={styles.top}>
        <SearchField value={q} onChangeText={setQ} placeholder="Tìm bảng giá" />
        <Txt variant="caption" color={C.muted}>
          {hint}
        </Txt>
      </View>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(b) => String(b.id)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <EmptyState icon="search" color="slate" title="Không có bảng giá" message={`Không có bảng giá nào khớp “${q.trim()}”.`} />
          }
          renderItem={({ item: b }) => {
            const on = b.id === selectedId;
            return (
              <PressableScale
                onPress={() => onPick(b)}
                disabled={busyId !== null && busyId !== undefined}
                haptic="selection"
                accessibilityLabel={`${b.name}${on ? ', đang chọn' : ''}`}
                scaleTo={0.98}
                style={[styles.row, on ? styles.rowOn : null]}>
                <Icon name="tag" size={19} color={on ? C.brand : C.muted} />
                <Txt variant="body" weight={on ? 'semibold' : 'medium'} style={{ flex: 1 }} numberOfLines={2}>
                  {b.name}
                </Txt>
                {busyId === b.id ? (
                  <ActivityIndicator color={C.brand} />
                ) : on ? (
                  <Icon name="check" size={20} color={C.brand} strokeWidth={2.4} />
                ) : null}
              </PressableScale>
            );
          }}
        />
      )}
    </View>
  );
}

export default function PriceBookScreen() {
  const perms = useSalePerms();
  const qc = useQueryClient();
  const userId = useSession((s) => s.user?.id);
  const { store, editing } = useSaleScope();
  const customerId = useScopedCart((s) => s.customer?.id);
  const selectedId = useScopedCart((s) => s.priceBookId ?? 0);
  const books = useApplicablePriceBooks(customerId, perms.priceBooks);
  const [busyId, setBusyId] = useState<number | null>(null);

  const pick = async (b: PriceBookSummary) => {
    if (b.id === selectedId) return router.back();
    const { lines, setPriceBook } = store.getState();
    let prices: Map<number, number> | undefined;
    if (lines.length) {
      setBusyId(b.id);
      try {
        const book = b.id > 0 ? await qc.fetchQuery({ queryKey: ['sales', 'price-book', b.id], queryFn: () => fetchPriceBook(b.id) }) : null;
        const outside = book ? lines.filter((l) => !book.prices.has(l.product.id)) : [];
        if (book && !book.allowNonListedProducts && outside.length) {
          setBusyId(null);
          Alert.alert(
            'Không đổi được bảng giá',
            `${outside.length} món trong giỏ không có trong “${book.name}”. Xóa các món đó trước rồi đổi lại.`,
          );
          return;
        }
        prices = new Map(lines.map((l) => [l.product.id, book?.prices.get(l.product.id) ?? l.product.basePrice]));
      } catch (e) {
        setBusyId(null);
        toast.error(errorMessage(e));
        return;
      }
    }
    setPriceBook(b.id || null, b.id ? b.name : null, prices);
    // Đơn đang sửa dùng bảng giá của đơn, không đổi bảng giá mặc định của giỏ bán hàng.
    if (userId && !editing) rememberPriceBook(userId, b.id || null, b.id ? b.name : null);
    setBusyId(null);
    router.back();
  };

  return (
    <PriceBookView
      books={books.data ?? []}
      loading={books.isLoading}
      error={books.isError ? books.error : undefined}
      onRetry={() => void books.refetch()}
      selectedId={selectedId}
      busyId={busyId}
      onPick={(b) => void pick(b)}
      hint={editing ? 'Giá hàng trong đơn sẽ đổi theo bảng giá bạn chọn.' : undefined}
    />
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  rowOn: { borderColor: C.brand, borderWidth: 1.5 },
});
