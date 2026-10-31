import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useDebounced } from '@/core/useDebounced';
import {
  Appear,
  C,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  PageBackground,
  PressableScale,
  SearchField,
  Skeleton,
  TitleHeader,
  toast,
  Txt,
} from '@/ui';
import { priceFor, usePriceBook, useSaleProducts, type PriceBookDetail } from './api';
import { cartTotals, useCart, type SaleProduct } from './cart';
import { CartBar, ProductRow } from './components';
import { useSalePerms } from './perms';

export interface SalesViewProps {
  search: string;
  onSearch: (text: string) => void;
  products: SaleProduct[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onEndReached?: () => void;
  loadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  priceOf: (p: SaleProduct) => number;
  qtyInCart: (productId: number) => number;
  showStock: boolean;
  priceBookName: string | null;
  onOpenPriceBook?: () => void;
  onScan?: () => void;
  onAdd: (p: SaleProduct) => void;
  onSetQty: (p: SaleProduct, n: number) => void;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
}

function ListSkeleton() {
  return (
    <View style={{ gap: 10, paddingHorizontal: 16 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={52} height={52} radius={12} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="75%" height={15} />
            <Skeleton width="45%" height={12} />
          </View>
          <Skeleton width={64} height={15} />
        </View>
      ))}
    </View>
  );
}

/** Màn chọn hàng: tìm/quét → bấm để thêm vào giỏ → thanh giỏ ở dưới. */
export function SalesView(p: SalesViewProps) {
  const hasCart = p.cartCount > 0;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <PageBackground />
      <TitleHeader
        title="Bán hàng"
        right={p.onScan ? <IconButton icon="scan-barcode" label="Quét mã vạch" onPress={p.onScan} /> : undefined}>
        <SearchField value={p.search} onChangeText={p.onSearch} placeholder="Tìm tên hoặc mã hàng" />
        {p.onOpenPriceBook ? (
          <PressableScale
            onPress={p.onOpenPriceBook}
            accessibilityLabel={`Bảng giá: ${p.priceBookName ?? 'Bảng giá chung'}. Bấm để đổi`}
            scaleTo={0.96}
            style={styles.book}>
            <Icon name="tag" size={16} color={C.brand} />
            <Txt variant="label" weight="semibold" color={C.brand} numberOfLines={1} style={{ flexShrink: 1 }}>
              {p.priceBookName ?? 'Bảng giá chung'}
            </Txt>
            <Icon name="chevron-down" size={15} color={C.brand} />
          </PressableScale>
        ) : null}
      </TitleHeader>

      {p.loading ? (
        <ListSkeleton />
      ) : p.error ? (
        <ErrorState error={p.error} onRetry={p.onRetry} />
      ) : (
        <FlashList
          data={p.products}
          keyExtractor={(item) => String(item.id)}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: hasCart ? 104 : 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onEndReached={p.onEndReached}
          onEndReachedThreshold={0.4}
          refreshing={!!p.refreshing}
          onRefresh={p.onRefresh}
          ListFooterComponent={p.loadingMore ? <ActivityIndicator color={C.brand} style={{ marginTop: 14 }} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="package-search"
              color="slate"
              title={p.search ? 'Không tìm thấy hàng' : 'Chưa có hàng để bán'}
              message={p.search ? `Không có hàng nào khớp “${p.search}”.` : 'Hàng ngừng bán hoặc không bán trực tiếp sẽ không hiện ở đây.'}
            />
          }
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              price={p.priceOf(item)}
              inCart={p.qtyInCart(item.id)}
              showStock={p.showStock}
              onAdd={() => p.onAdd(item)}
              onChangeQty={(n) => p.onSetQty(item, n)}
            />
          )}
        />
      )}

      {hasCart ? (
        <Appear style={styles.cartBar}>
          <CartBar count={p.cartCount} total={p.cartTotal} onPress={p.onOpenCart} />
        </Appear>
      ) : null}
    </View>
  );
}

/** Thêm hàng vào giỏ theo bảng giá đang chọn (chặn hàng ngoài bảng giá "chỉ bán hàng trong bảng giá"). */
export function addToCart(product: SaleProduct, book: PriceBookDetail | null | undefined, quantity = 1): boolean {
  const listed = !book || book.prices.has(product.id);
  if (book && !listed && !book.allowNonListedProducts) {
    toast.error(`“${product.name}” không có trong bảng giá ${book.name}`);
    return false;
  }
  if (book && !listed && book.warnNonListedProducts) {
    toast.info(`“${product.name}” không có trong bảng giá, dùng giá gốc`);
  }
  useCart.getState().add(product, priceFor(product, book), quantity);
  return true;
}

/** Đổi tổng SL của 1 sản phẩm trong giỏ (tăng/giảm ở dòng mới nhất của sản phẩm đó). */
export function setProductQty(productId: number, next: number) {
  const { lines, setQuantity } = useCart.getState();
  const mine = lines.filter((l) => l.product.id === productId);
  const current = mine.reduce((s, l) => s + l.quantity, 0);
  const target = mine[0];
  if (!target) return;
  setQuantity(target.rowId, target.quantity + (next - current));
}

export default function SalesScreen() {
  const perms = useSalePerms();
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 300);
  const lines = useCart((s) => s.lines);
  const orderDiscount = useCart((s) => s.orderDiscount);
  const shippingFee = useCart((s) => s.shippingFee);
  const priceBookId = useCart((s) => s.priceBookId);
  const priceBookName = useCart((s) => s.priceBookName);

  const book = usePriceBook(priceBookId, perms.priceBooks);
  const strict = !!book.data && !book.data.allowNonListedProducts;
  const products = useSaleProducts(term, { priceBookId, onlyInPriceBook: strict });

  if (!perms.products) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <PageBackground />
        <TitleHeader title="Bán hàng" />
        <EmptyState
          icon="lock"
          color="slate"
          title="Chưa có quyền xem hàng hóa"
          message="Nhờ quản trị viên cấp quyền “Xem hàng hóa” để bán hàng trên app."
        />
      </View>
    );
  }

  const items = products.data?.pages.flatMap((pg) => pg.items) ?? [];
  const totals = cartTotals({ lines, orderDiscount, shippingFee });
  const qtyByProduct = new Map<number, number>();
  for (const l of lines) qtyByProduct.set(l.product.id, (qtyByProduct.get(l.product.id) ?? 0) + l.quantity);

  return (
    <SalesView
      search={search}
      onSearch={setSearch}
      products={items}
      loading={products.isLoading}
      error={products.isError ? products.error : undefined}
      onRetry={() => void products.refetch()}
      onEndReached={() => {
        if (products.hasNextPage && !products.isFetchingNextPage) void products.fetchNextPage();
      }}
      loadingMore={products.isFetchingNextPage}
      refreshing={products.isRefetching && !products.isFetchingNextPage}
      onRefresh={() => void products.refetch()}
      priceOf={(p) => priceFor(p, book.data)}
      qtyInCart={(id) => qtyByProduct.get(id) ?? 0}
      showStock={perms.viewStock}
      priceBookName={priceBookName}
      onOpenPriceBook={perms.priceBooks ? () => router.push('/ban-hang/bang-gia') : undefined}
      onScan={() => router.push('/ban-hang/quet-ma')}
      onAdd={(p) => {
        if (book.isLoading && priceBookId) return toast.info('Đang tải bảng giá, thử lại sau giây lát');
        addToCart(p, book.data);
      }}
      onSetQty={(p, n) => setProductQty(p.id, n)}
      cartCount={totals.itemCount}
      cartTotal={totals.total}
      onOpenCart={() => router.push('/ban-hang/gio-hang')}
    />
  );
}


const styles = StyleSheet.create({
  book: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: '#CFE3E6',
    maxWidth: '100%',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: C.card,
  },
  cartBar: { position: 'absolute', left: 16, right: 16, bottom: 12 },
});
