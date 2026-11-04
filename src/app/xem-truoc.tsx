import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BranchPickerView } from '@/features/shell/BranchPickerScreen';
import { DashboardView } from '@/features/dashboard/DashboardView';
import type { DashRange, TaskType } from '@/features/dashboard/api';
import { TaskListView } from '@/features/dashboard/TaskListScreen';
import {
  sampleBanks,
  sampleBranches,
  sampleCustomers,
  sampleDashboard,
  sampleDocCounts,
  sampleDocDetail,
  sampleInvoiceDetail,
  sampleInvoiceDraft,
  sampleInvoiceEdit,
  sampleOrderEdit,
  sampleOrderEditPromo,
  sampleDocRows,
  samplePrintContent,
  sampleProducts,
  sampleRawProducts,
  sampleSalePerms,
  sampleStockMoves,
  sampleTasks,
  sampleUser,
} from '@/features/preview/sample';
import { InvoiceFromOrderView } from '@/features/orders/InvoiceFromOrderScreen';
import { OrderDetailView } from '@/features/orders/OrderDetailScreen';
import { OrderEditView } from '@/features/orders/OrderEditScreen';
import { ORDER_EDIT_SCOPE, startOrderEdit, useOrderEditMeta } from '@/features/orders/editScope';
import { OrdersView } from '@/features/orders/OrdersScreen';
import type { DocKind, StatusFilter } from '@/features/orders/model';
import { printDocument } from '@/features/print/print';
import { CostScopeView } from '@/features/products/CostScopeModal';
import { newForm, toEditForm, type ProductForm } from '@/features/products/form';
import { ComponentPickerView, NamePickerView } from '@/features/products/PickerScreens';
import { ProductDetailView, type DetailTab, type LogData } from '@/features/products/ProductDetailScreen';
import { ProductFormView } from '@/features/products/ProductFormScreen';
import { ProductFilterView } from '@/features/products/ProductFilterScreen';
import { ProductsView } from '@/features/products/ProductsScreen';
import {
  DEFAULT_FILTERS,
  productPerms,
  toProductDetail,
  toProductRow,
  type ConditionBucket,
  type ProductFilters,
} from '@/features/products/model';
import { PrintPreviewView } from '@/features/print/PrintPreviewScreen';
import { addressToDelivery, cartTotals, useCart } from '@/features/sales/cart';
import { CheckoutView } from '@/features/sales/CheckoutScreen';
import { CustomerPickerView } from '@/features/sales/CustomerPickerScreen';
import { DeliveryView } from '@/features/sales/DeliveryScreen';
import { DiscountView } from '@/features/sales/DiscountScreen';
import { LineEditorView } from '@/features/sales/LineEditorScreen';
import { PriceBookView } from '@/features/sales/PriceBookScreen';
import { SaleScopeProvider } from '@/features/sales/scope';
import { SalesView, setProductQty } from '@/features/sales/SalesScreen';
import { SuccessView } from '@/features/sales/SuccessScreen';
import { MoreView } from '@/features/shell/MoreScreen';
import { TabBar } from '@/features/shell/TabBar';
import { TAB_DEFS } from '@/features/shell/tabs';
import LoginScreen from '@/features/auth/LoginScreen';
import { ActionCard, Page, TitleHeader, toast } from '@/ui';

const SCREENS = [
  { key: 'dang-nhap', title: 'Đăng nhập' },
  { key: 'tong-quan', title: 'Tổng quan' },
  { key: 'viec', title: 'Việc cần xử lý' },
  { key: 'them', title: 'Thêm' },
  { key: 'chi-nhanh', title: 'Chọn chi nhánh' },
  { key: 'ban-hang', title: 'Bán hàng' },
  { key: 'gio-hang', title: 'Giỏ hàng' },
  { key: 'khach', title: 'Chọn khách hàng' },
  { key: 'sua-hang', title: 'Sửa hàng trong giỏ' },
  { key: 'giao-hang', title: 'Giao hàng' },
  { key: 'giam-gia', title: 'Giảm giá và phí ship' },
  { key: 'bang-gia', title: 'Bảng giá' },
  { key: 'xong', title: 'Tạo đơn xong' },
  { key: 'phieu-in', title: 'Xem và in phiếu' },
  { key: 'don-hang', title: 'Đơn hàng' },
  { key: 'chi-tiet-don', title: 'Chi tiết đơn' },
  { key: 'chi-tiet-hd', title: 'Chi tiết hóa đơn' },
  { key: 'xu-ly', title: 'Xử lý đơn hàng' },
  { key: 'xu-ly-km', title: 'Xử lý đơn có khuyến mãi' },
  { key: 'xu-ly-hd', title: 'Xử lý hóa đơn' },
  { key: 'tao-hd', title: 'Tạo hóa đơn từ đơn' },
  { key: 'hang-hoa', title: 'Hàng hóa' },
  { key: 'loc-hang', title: 'Bộ lọc hàng hóa' },
  { key: 'ct-hang', title: 'Chi tiết hàng hóa' },
  { key: 'ct-combo', title: 'Chi tiết combo' },
  { key: 'ct-sx', title: 'Chi tiết hàng sản xuất' },
  { key: 'them-hh', title: 'Thêm hàng hóa' },
  { key: 'sua-hh', title: 'Sửa hàng hóa' },
  { key: 'sua-combo', title: 'Sửa combo' },
  { key: 'sua-sx', title: 'Sửa hàng sản xuất' },
  { key: 'chon-nhom', title: 'Chọn nhóm hàng' },
  { key: 'chon-tp', title: 'Chọn thành phần' },
  { key: 'gia-von', title: 'Áp dụng giá vốn' },
] as const;

/** Form mẫu theo màn xem trước. */
function sampleForm(key: string): ProductForm | null {
  if (key === 'them-hh') return newForm(2);
  const id = { 'sua-hh': 1, 'sua-combo': 3, 'sua-sx': 4 }[key];
  const r = sampleRawProducts.find((x) => x.id === id);
  return r ? toEditForm(r, 1) : null;
}

const productDetailKey: Record<string, number> = { 'ct-hang': 1, 'ct-combo': 3, 'ct-sx': 4 };

const sampleLogs = (rows = sampleStockMoves): LogData => ({
  rows,
  total: rows.length + 12,
  loading: false,
  hasMore: true,
  loadingMore: false,
  onMore: () => toast.info('Chỉ là bản xem trước'),
  onRetry: () => {},
});

/** Giỏ mẫu cho các màn bán hàng. */
function seedCart() {
  if (useCart.getState().lines.length) return;
  const c = sampleCustomers[0];
  useCart.setState({
    mode: 'invoice',
    customer: c,
    delivery: addressToDelivery(c),
    lines: [
      { rowId: 'a', product: sampleProducts[0], quantity: 2, price: 185_000, discount: 15_000, note: '' },
      { rowId: 'b', product: sampleProducts[1], quantity: 6, price: 96_000, discount: 0, note: 'Giao trước 10h' },
      { rowId: 'c', product: sampleProducts[3], quantity: 1, price: 65_000, discount: 0, note: '' },
    ],
    payKind: 'transfer',
    paidAmount: 500_000,
    accountId: 1,
  });
}

const noop = () => toast.info('Chỉ là bản xem trước');
const tabs = TAB_DEFS.slice(0, 4);

function FakeTabBar({ active }: { active: string }) {
  const names = [...tabs.map((t) => t.key), 'them'];
  return (
    <TabBar
      tabs={tabs}
      state={{ index: Math.max(0, names.indexOf(active)), routes: names.map((n) => ({ key: n, name: n })) }}
      emitter={{ emit: () => ({ defaultPrevented: false }) } as never}
      navigateToTab={noop}
      descriptors={{} as never}
      insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
    />
  );
}

/**
 * Trang xem trước giao diện bằng dữ liệu mẫu — CHỈ khi dev (để chụp ảnh kiểm
 * tra trên trình duyệt). Bản phát hành chuyển thẳng về trang chính.
 */
export default function PreviewScreen() {
  const { man } = useLocalSearchParams<{ man?: string }>();
  const [range, setRange] = useState<DashRange>('today');
  const [task, setTask] = useState<TaskType>('orders');
  const [search, setSearch] = useState('');
  const [docKind, setDocKind] = useState<DocKind>('order');
  const [docStatus, setDocStatus] = useState<StatusFilter>('all');
  const [docPeriod, setDocPeriod] = useState<import('@/core/format').PeriodKey | 'all'>('last7');
  const lines = useCart((st) => st.lines);
  const cart = useCart();

  const editMeta = useOrderEditMeta((st) => st.meta);
  const [productFilters, setProductFilters] = useState<ProductFilters>(DEFAULT_FILTERS);
  const [detailTab, setDetailTab] = useState<DetailTab>('info');
  const [bucket, setBucket] = useState<ConditionBucket>('DAMAGED');
  const productPermsAll = productPerms(sampleUser);
  const [previewForm, setPreviewForm] = useState<{ key: string; form: ProductForm } | null>(null);

  useEffect(() => {
    if (man && ['gio-hang', 'sua-hang', 'giao-hang', 'giam-gia'].includes(man)) seedCart();
    if (man === 'xu-ly') startOrderEdit(sampleOrderEdit.cart, sampleOrderEdit.meta);
    if (man === 'xu-ly-km') startOrderEdit(sampleOrderEditPromo.cart, sampleOrderEditPromo.meta);
    if (man === 'xu-ly-hd') startOrderEdit(sampleInvoiceEdit.cart, sampleInvoiceEdit.meta);
  }, [man]);

  if (!__DEV__) return <Redirect href="/" />;

  const toView = (key: string) => () => router.setParams({ man: key });

  if (man === 'dang-nhap') return <LoginScreen />;
  if (man === 'tong-quan')
    return (
      <View style={{ flex: 1 }}>
        <DashboardView
          user={sampleUser}
          branchName={sampleBranches[0].name}
          range={range}
          onRangeChange={setRange}
          data={sampleDashboard}
          onOpenBranch={() => router.setParams({ man: 'chi-nhanh' })}
          onOpenAccount={() => router.setParams({ man: 'them' })}
          onOpenTask={() => router.setParams({ man: 'viec' })}
          onShortcut={noop}
        />
        <FakeTabBar active="tong-quan" />
      </View>
    );
  if (man === 'viec')
    return (
      <TaskListView
        type={task}
        onTypeChange={setTask}
        rows={task === 'orders' ? sampleTasks : []}
        counts={sampleDashboard.counts}
      />
    );
  if (man === 'them')
    return (
      <View style={{ flex: 1 }}>
        <MoreView
          user={sampleUser}
          branchName={sampleBranches[0].name}
          canSwitchBranch
          hiddenTabKeys={['bao-don']}
          onOpenBranch={() => router.setParams({ man: 'chi-nhanh' })}
          onOpen={noop}
          onSignOut={noop}
          update={{ pending: true, busy: false, runningSince: new Date(), onCheck: noop, onApply: noop }}
        />
        <FakeTabBar active="them" />
      </View>
    );
  if (man === 'ban-hang') {
    const t = cartTotals(cart);
    const q = search.trim().toLowerCase();
    return (
      <View style={{ flex: 1 }}>
        <SalesView
          search={search}
          onSearch={setSearch}
          products={sampleProducts.filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))}
          priceOf={(p) => p.basePrice}
          qtyInCart={(id) => lines.filter((l) => l.product.id === id).reduce((n, l) => n + l.quantity, 0)}
          showStock
          priceBookName={null}
          onOpenPriceBook={toView('bang-gia')}
          onScan={noop}
          onAdd={(p) => useCart.getState().add(p, p.basePrice)}
          onSetQty={(p, n) => setProductQty(p.id, n)}
          cartCount={t.itemCount}
          cartTotal={t.total}
          onOpenCart={toView('gio-hang')}
        />
        <FakeTabBar active="ban-hang" />
      </View>
    );
  }
  if (man === 'gio-hang')
    return (
      <View style={{ flex: 1 }}>
        <CheckoutView
          perms={sampleSalePerms}
          bankAccounts={sampleBanks}
          promotions={[{ promotionId: 1, name: 'Mua 10 tặng 1 (mẫu)', autoApply: true }]}
          onSubmit={toView('xong')}
          onOpenCustomer={toView('khach')}
          onOpenLine={toView('sua-hang')}
          onOpenDelivery={toView('giao-hang')}
          onOpenDiscount={toView('giam-gia')}
          onAddMore={toView('ban-hang')}
          onClear={() => useCart.getState().reset()}
        />
        <FakeTabBar active="ban-hang" />
      </View>
    );
  if (man === 'khach')
    return (
      <CustomerPickerView
        search={search}
        onSearch={setSearch}
        customers={sampleCustomers}
        selectedId={cart.customer?.id}
        showDebt
        onPick={(c) => {
          useCart.getState().setCustomer(c);
          toView('gio-hang')();
        }}
      />
    );
  if (man === 'sua-hang' && lines[0])
    return <LineEditorView line={lines[0]} perms={sampleSalePerms} onSave={toView('gio-hang')} onRemove={noop} />;
  if (man === 'giao-hang')
    return <DeliveryView customer={cart.customer} initial={cart.delivery} onSave={toView('gio-hang')} />;
  if (man === 'giam-gia')
    return (
      <DiscountView
        subtotal={cartTotals(cart).subtotal}
        initialDiscount={cart.orderDiscount}
        initialShipping={cart.shippingFee}
        canDiscount
        onSave={toView('gio-hang')}
      />
    );
  if (man === 'bang-gia')
    return (
      <PriceBookView
        books={[
          { id: 3, name: 'Bảng giá đại lý (mẫu)' },
          { id: 4, name: 'Bảng giá khách sỉ (mẫu)' },
        ]}
        selectedId={0}
        onPick={toView('ban-hang')}
      />
    );
  if (man === 'xong')
    return (
      <SuccessView
        sale={{
          kind: 'order',
          id: 1,
          code: 'DH000123',
          total: 1_041_000,
          customerName: sampleCustomers[0].name,
          notes: [],
          stockWarnings: [
            'Sản phẩm Trà đen mẫu 1kg không đủ tồn kho (Có: 0, Cần: 2)',
            'Sản phẩm Siro đào mẫu 2,5L không đủ tồn kho (Có: 3, Cần: 6)',
            'Sản phẩm Thạch dừa mẫu 2,2kg (12 hũ/thùng) không đủ tồn kho (Có: 0, Cần: 1)',
            'Sản phẩm Bột sữa béo mẫu 1kg không đủ tồn kho (Có: 0, Cần: 1)',
            'Sản phẩm Ly nhựa mẫu 500ml (50 cái) không đủ tồn kho (Có: 0, Cần: 4)',
            'Sản phẩm Trân châu đen mẫu 3kg không đủ tồn kho (Có: 0, Cần: 1)',
          ],
        }}
        canPrint
        onPrint={toView('phieu-in')}
        onNew={toView('ban-hang')}
      />
    );
  if (man === 'don-hang')
    return (
      <View style={{ flex: 1 }}>
        <OrdersView
          kinds={['order', 'invoice']}
          kind={docKind}
          onKind={setDocKind}
          filters={{ search, status: docStatus, period: docPeriod }}
          onSearch={setSearch}
          onStatus={setDocStatus}
          onPeriod={setDocPeriod}
          rows={docStatus === 'all' ? sampleDocRows : sampleDocRows.filter((r) => r.status === 5)}
          total={docStatus === 'all' ? 24 : 5}
          counts={sampleDocCounts}
          onOpen={toView('chi-tiet-don')}
        />
        <FakeTabBar active="don-hang" />
      </View>
    );
  if (man === 'chi-tiet-don' || man === 'chi-tiet-hd')
    return (
      <OrderDetailView
        doc={man === 'chi-tiet-hd' ? sampleInvoiceDetail : sampleDocDetail}
        canPrint
        onPrint={toView('phieu-in')}
        onOpenOrder={noop}
        onOpenInvoice={noop}
        actions={{
          canProcess: true,
          onProcess: toView(man === 'chi-tiet-hd' ? 'xu-ly-hd' : 'xu-ly'),
          canChangeStatus: true,
          canComplete: true,
          canCancel: true,
          onChangeStatus: noop,
          onComplete: noop,
          onCancel: noop,
        }}
      />
    );
  if ((man === 'xu-ly' || man === 'xu-ly-km' || man === 'xu-ly-hd') && editMeta)
    return (
      <SaleScopeProvider value={ORDER_EDIT_SCOPE}>
        <OrderEditView
          meta={editMeta}
          perms={sampleSalePerms}
          canInvoice
          busy={null}
          bankAccounts={sampleBanks}
          onSave={noop}
          onInvoice={toView('tao-hd')}
          onOpenCustomer={noop}
          onOpenLine={noop}
          onOpenDelivery={noop}
          onOpenDiscount={noop}
          onAddMore={noop}
        />
      </SaleScopeProvider>
    );
  if (man === 'tao-hd')
    return <InvoiceFromOrderView draft={sampleInvoiceDraft} perms={{ viewPayment: true, editPayment: true }} onSubmit={noop} />;
  if (man === 'phieu-in')
    return (
      <PrintPreviewView
        title="Phiếu đặt hàng"
        html={printDocument({ content: samplePrintContent, paperSize: 'A5', landscape: false }, { screen: true })}
        pageWidth={559}
        onPrint={noop}
        onChangePrinter={noop}
        onSendPdf={noop}
        onSendImage={noop}
      />
    );
  if (man === 'hang-hoa') {
    const q = search.trim().toLowerCase();
    const rows = sampleRawProducts
      .map((r) => toProductRow(r, 1))
      .filter((r) => productFilters.status === 'all' || r.isActive === (productFilters.status === 'active'))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
    return (
      <ProductsView
        perms={productPermsAll}
        search={search}
        onSearch={setSearch}
        filters={productFilters}
        onStatus={(status) => setProductFilters((f) => ({ ...f, status }))}
        onSort={(sort) => setProductFilters((f) => ({ ...f, sort }))}
        onOpenFilters={toView('loc-hang')}
        onCreate={noop}
        rows={rows}
        total={rows.length}
        onOpen={(r) => router.setParams({ man: r.type === 1 ? 'ct-combo' : r.type === 4 ? 'ct-sx' : 'ct-hang' })}
      />
    );
  }
  if (man === 'loc-hang')
    return (
      <ProductFilterView
        draft={productFilters}
        onChange={(patch) => setProductFilters((f) => ({ ...f, ...patch }))}
        categories={{
          parent: { items: [{ id: 1, name: 'Nguyên liệu mẫu' }, { id: 2, name: 'Bao bì mẫu' }], loading: false },
          middle: { items: [{ id: 3, name: 'Trong nước' }, { id: 4, name: 'Nhập khẩu' }], loading: false },
          child: {
            items: ['Trà', 'Siro', 'Bột', 'Thạch', 'Trân châu', 'Ly', 'Ống hút', 'Nắp', 'Sữa', 'Kem', 'Topping', 'Hương liệu', 'Thành phẩm'].map(
              (name, i) => ({ id: 10 + i, name }),
            ),
            loading: false,
          },
        }}
        trademarks={{ items: [{ id: 1, name: 'Thương hiệu mẫu' }], loading: false }}
        onApply={toView('hang-hoa')}
        onReset={() => setProductFilters((f) => ({ ...DEFAULT_FILTERS, status: f.status, sort: f.sort }))}
        onCancel={toView('hang-hoa')}
      />
    );
  if (man && productDetailKey[man]) {
    const rawProduct = sampleRawProducts.find((r) => r.id === productDetailKey[man]) ?? sampleRawProducts[0];
    return (
      <ProductDetailView
        d={toProductDetail(rawProduct, 1)}
        perms={productPermsAll}
        branchId={1}
        tab={detailTab}
        onTab={setDetailTab}
        branches={sampleBranches}
        logBranchId={1}
        onLogBranch={noop}
        card={sampleLogs()}
        condition={{
          summary: { onHand: 42, good: 35, damaged: 2, nearExpiry: 5, promo: 0 },
          bucket,
          onBucket: setBucket,
          logs: sampleLogs([]),
        }}
        onOpenInvoice={noop}
        onEdit={noop}
        onToggleActive={noop}
      />
    );
  }
  if (man && ['them-hh', 'sua-hh', 'sua-combo', 'sua-sx'].includes(man)) {
    const current = previewForm?.key === man ? previewForm.form : sampleForm(man);
    if (!current) return null;
    return (
      <ProductFormView
        form={current}
        editing={man !== 'them-hh'}
        code={current.code}
        perms={productPermsAll}
        onChange={(patch) =>
          setPreviewForm({ key: man, form: { ...current, ...(typeof patch === 'function' ? patch(current) : patch) } })
        }
        onPickImages={noop}
        onPick={toView('chon-nhom')}
        onAddComponent={toView('chon-tp')}
        onSave={toView('gia-von')}
      />
    );
  }
  if (man === 'chon-nhom')
    return (
      <NamePickerView
        title="Danh mục"
        items={['Trà', 'Siro', 'Bột', 'Thạch', 'Trân châu', 'Ly'].map((name, i) => ({ id: i + 1, name }))}
        selected="Siro"
        clearLabel="Bỏ chọn danh mục"
        onPick={toView('sua-hh')}
        onCreate={noop}
      />
    );
  if (man === 'chon-tp')
    return (
      <ComponentPickerView
        title="Thêm thành phần"
        search={search}
        onSearch={setSearch}
        items={sampleRawProducts.filter((r) => r.type !== 1)}
        added={[1]}
        branchId={1}
        showCost
        onPick={noop}
      />
    );
  if (man === 'gia-von') return <CostScopeView branches={sampleBranches} currentBranchId={1} onCancel={toView('sua-hh')} onConfirm={noop} />;
  if (man === 'chi-nhanh')
    return <BranchPickerView branches={sampleBranches} branchId={1} switching={null} onPick={noop} />;

  return (
    <Page header={<TitleHeader title="Xem trước giao diện" />}>
      <View style={{ gap: 10 }}>
        {SCREENS.map((s) => (
          <ActionCard
            key={s.key}
            icon="layout-grid"
            color="teal"
            title={s.title}
            subtitle="Dữ liệu mẫu"
            onPress={() => router.setParams({ man: s.key })}
          />
        ))}
      </View>
    </Page>
  );
}
