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
  sampleProducts,
  sampleSalePerms,
  sampleTasks,
  sampleUser,
} from '@/features/preview/sample';
import { addressToDelivery, cartTotals, useCart } from '@/features/sales/cart';
import { CheckoutView } from '@/features/sales/CheckoutScreen';
import { CustomerPickerView } from '@/features/sales/CustomerPickerScreen';
import { DeliveryView } from '@/features/sales/DeliveryScreen';
import { DiscountView } from '@/features/sales/DiscountScreen';
import { LineEditorView } from '@/features/sales/LineEditorScreen';
import { PriceBookView } from '@/features/sales/PriceBookScreen';
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
] as const;

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
  const lines = useCart((st) => st.lines);
  const cart = useCart();

  useEffect(() => {
    if (man && ['gio-hang', 'sua-hang', 'giao-hang', 'giam-gia'].includes(man)) seedCart();
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
          kind: 'invoice',
          id: 1,
          code: 'HD000123',
          total: 1_041_000,
          customerName: sampleCustomers[0].name,
          notes: [],
        }}
        canPrint
        onPrint={noop}
        onNew={toView('ban-hang')}
      />
    );
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
