import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useDebounced } from '@/core/useDebounced';
import { usePullRefresh } from '@/core/usePullRefresh';
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
  Select,
  Skeleton,
  SubHeader,
  TitleHeader,
  toast,
  Txt,
  type IconName,
  type SelectOption,
} from '@/ui';
import { priceFor, usePriceBook, useSaleProducts, type PriceBookDetail } from './api';
import { cartTotals, useCart, type CartStore, type SaleProduct } from './cart';
import { CartBar, ProductRow } from './components';
import { closeDraft, draftLabel, draftOptions, DRAFTS_FULL_MESSAGE, isBlankCart, newDraft, switchDraft, useDrafts } from './drafts';
import { useSalePerms } from './perms';
import { useSaleScope, useScopedCart } from './scope';

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
  /** Hàng đã có trong giỏ: mở màn sửa dòng hàng. */
  onEditLine?: (p: SaleProduct) => void;
  /** Hàng đã có trong giỏ: nút xóa cạnh ô số lượng. */
  onRemove?: (p: SaleProduct) => void;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  /** Mở từ đơn đang sửa: đầu trang có nút quay lại, thanh dưới để quay về đơn. */
  editing?: boolean;
  /** Đơn nháp của tab Bán hàng (không có khi đang sửa đơn). */
  drafts?: {
    options: SelectOption<string>[];
    value: string;
    onChange: (id: string) => void;
    onAdd: () => void;
    /** Nút xóa ở từng đơn trong sheet chọn đơn nháp. */
    onRemove?: (id: string) => void;
    canRemove?: (id: string) => boolean;
  };
}

/** Nút gọn ở đầu màn (bảng giá, đơn nháp). */
function HeaderPill({ icon, text, label, onPress }: { icon: IconName; text: string; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} scaleTo={0.96} style={styles.pill}>
      <Icon name={icon} size={16} color={C.brand} />
      <Txt variant="label" weight="semibold" color={C.brand} numberOfLines={1} style={{ flexShrink: 1 }}>
        {text}
      </Txt>
      <Icon name="chevron-down" size={15} color={C.brand} />
    </PressableScale>
  );
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
  const Header = p.editing ? SubHeader : TitleHeader;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <PageBackground />
      <Header
        title={p.editing ? 'Thêm hàng vào đơn' : 'Bán hàng'}
        right={
          <View style={styles.actions}>
            {p.drafts ? <IconButton icon="plus" label="Thêm đơn nháp" onPress={p.drafts.onAdd} /> : null}
            {p.onScan ? <IconButton icon="scan-barcode" label="Quét mã vạch" onPress={p.onScan} /> : null}
          </View>
        }>
        <SearchField value={p.search} onChangeText={p.onSearch} placeholder="Tìm tên hoặc mã hàng" />
        {p.drafts || p.onOpenPriceBook ? (
          <View style={styles.pills}>
            {p.drafts ? (
              <Select
                label="Đơn nháp"
                options={p.drafts.options}
                value={p.drafts.value}
                onChange={(id) => id && p.drafts?.onChange(id)}
                onRemove={p.drafts.onRemove}
                canRemove={p.drafts.canRemove}
                trigger={({ text, open }) => (
                  <HeaderPill icon="receipt-text" text={text} label={`Đơn nháp: ${text}. Bấm để đổi`} onPress={open} />
                )}
              />
            ) : null}
            {p.onOpenPriceBook ? (
              <HeaderPill
                icon="tag"
                text={p.priceBookName ?? 'Bảng giá chung'}
                label={`Bảng giá: ${p.priceBookName ?? 'Bảng giá chung'}. Bấm để đổi`}
                onPress={p.onOpenPriceBook}
              />
            ) : null}
          </View>
        ) : null}
      </Header>

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
              onEdit={p.onEditLine ? () => p.onEditLine?.(item) : undefined}
              onRemove={p.onRemove ? () => p.onRemove?.(item) : undefined}
            />
          )}
        />
      )}

      {hasCart ? (
        <Appear style={styles.cartBar}>
          <CartBar count={p.cartCount} total={p.cartTotal} onPress={p.onOpenCart} action={p.editing ? 'Xem đơn' : undefined} />
        </Appear>
      ) : null}
    </View>
  );
}

/** Thêm hàng vào giỏ theo bảng giá đang chọn (chặn hàng ngoài bảng giá "chỉ bán hàng trong bảng giá"). */
export function addToCart(
  product: SaleProduct,
  book: PriceBookDetail | null | undefined,
  quantity = 1,
  store: CartStore = useCart,
): boolean {
  const listed = !book || book.prices.has(product.id);
  if (book && !listed && !book.allowNonListedProducts) {
    toast.error(`“${product.name}” không có trong bảng giá ${book.name}`);
    return false;
  }
  if (book && !listed && book.warnNonListedProducts) {
    toast.info(`“${product.name}” không có trong bảng giá, dùng giá gốc`);
  }
  store.getState().add(product, priceFor(product, book), quantity);
  return true;
}

/** Đổi tổng SL của 1 sản phẩm trong giỏ (tăng/giảm ở dòng mới nhất của sản phẩm đó). */
export function setProductQty(productId: number, next: number, store: CartStore = useCart) {
  const { lines, setQuantity } = store.getState();
  const mine = lines.filter((l) => l.product.id === productId);
  const current = mine.reduce((s, l) => s + l.quantity, 0);
  const target = mine[0];
  if (!target) return;
  setQuantity(target.rowId, target.quantity + (next - current));
}

/** Xóa 1 đơn nháp từ sheet chọn đơn; đơn còn hàng / khách thì hỏi trước. */
function removeDraftAsk(id: string) {
  const book = useDrafts.getState();
  const draft = book.drafts.find((d) => d.id === id);
  if (!draft) return;
  const cart = useCart.getState();
  const content = id === book.activeId ? cart : draft.cart;
  // Giữ loại đơn và bảng giá của đơn đang mở cho đơn trống thay thế (nếu xóa hết).
  const remove = () => closeDraft(id, { mode: cart.mode, priceBookId: cart.priceBookId, priceBookName: cart.priceBookName });
  if (isBlankCart(content)) return remove();
  Alert.alert(`Xóa ${draftLabel(draft)}?`, 'Toàn bộ hàng, khách và thanh toán của đơn nháp này sẽ bị xóa.', [
    { text: 'Hủy', style: 'cancel' },
    { text: 'Xóa đơn', style: 'destructive', onPress: remove },
  ]);
}

export default function SalesScreen() {
  const perms = useSalePerms();
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 300);
  const { store, editing, paths } = useSaleScope();
  const lines = useScopedCart((s) => s.lines);
  const orderDiscount = useScopedCart((s) => s.orderDiscount);
  const shippingFee = useScopedCart((s) => s.shippingFee);
  const priceBookId = useScopedCart((s) => s.priceBookId);
  const priceBookName = useScopedCart((s) => s.priceBookName);
  const customer = useScopedCart((s) => s.customer);
  const draftBook = useDrafts();

  const book = usePriceBook(priceBookId, perms.priceBooks);
  const strict = !!book.data && !book.data.allowNonListedProducts;
  const products = useSaleProducts(term, { priceBookId, onlyInPriceBook: strict });
  const pull = usePullRefresh(products.refetch);

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
      refreshing={pull.refreshing}
      onRefresh={pull.onRefresh}
      priceOf={(p) => priceFor(p, book.data)}
      qtyInCart={(id) => qtyByProduct.get(id) ?? 0}
      showStock={perms.viewStock}
      priceBookName={priceBookName}
      onOpenPriceBook={perms.priceBooks ? () => router.push(paths.priceBook as never) : undefined}
      onScan={() => router.push(paths.scan as never)}
      onAdd={(p) => {
        if (book.isLoading && priceBookId) return toast.info('Đang tải bảng giá, thử lại sau giây lát');
        addToCart(p, book.data, 1, store);
      }}
      onSetQty={(p, n) => setProductQty(p.id, n, store)}
      onEditLine={(p) => {
        // Cùng dòng mà nút − SL + đang đổi (dòng mới nhất của sản phẩm).
        const row = lines.find((l) => l.product.id === p.id);
        if (row) router.push({ pathname: paths.line, params: { rowId: row.rowId } } as never);
      }}
      onRemove={(p) =>
        Alert.alert(editing ? 'Xóa khỏi đơn?' : 'Xóa khỏi giỏ?', p.name, [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Xóa', style: 'destructive', onPress: () => store.getState().removeProduct(p.id) },
        ])
      }
      cartCount={totals.itemCount}
      cartTotal={totals.total}
      // Đơn đang sửa: màn chọn hàng mở từ đơn nên quay lại là về đơn.
      onOpenCart={() => (editing ? router.back() : router.push(paths.cart as never))}
      editing={editing}
      drafts={
        editing || !draftBook.drafts.length
          ? undefined
          : {
              options: draftOptions(draftBook, { lines, customer, orderDiscount, shippingFee }),
              value: draftBook.activeId,
              onChange: switchDraft,
              onAdd: () => {
                const r = newDraft();
                if (r === 'already') toast.info('Đơn đang mở còn trống');
                if (r === 'full') toast.info(DRAFTS_FULL_MESSAGE);
              },
              onRemove: removeDraftAsk,
              // Chỉ còn 1 đơn (là đơn đang mở) và đơn đó trống: xóa cũng không đổi gì.
              canRemove: () => draftBook.drafts.length > 1 || !isBlankCart({ lines, customer }),
            }
      }
    />
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: '#CFE3E6',
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
