import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { errorMessage } from '@/core/http';
import { useSession } from '@/core/session';
import { C, ErrorState, Icon, LoadingState, PressableScale, SheetHeader, toast, Txt } from '@/ui';
import { fetchPriceBook, useApplicablePriceBooks, type PriceBookSummary } from './api';
import { useSalePerms } from './perms';
import { rememberPriceBook } from './persist';
import { useSaleScope, useScopedCart } from './scope';

const GENERAL: PriceBookSummary = { id: 0, name: 'Bảng giá chung' };

export function PriceBookView({
  books,
  loading,
  error,
  onRetry,
  selectedId,
  busyId,
  onPick,
}: {
  books: PriceBookSummary[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  selectedId: number;
  busyId?: number | null;
  onPick: (b: PriceBookSummary) => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Bảng giá" cancelLabel="Đóng" formSheet />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Txt variant="caption" color={C.muted}>
            Giá trong giỏ sẽ đổi theo bảng giá bạn chọn.
          </Txt>
          {[GENERAL, ...books].map((b) => {
            const on = b.id === selectedId;
            return (
              <PressableScale
                key={b.id}
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
          })}
        </ScrollView>
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
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 40 },
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
