import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { create } from 'zustand';
import { money, vnd } from '@/core/format';
import { ApiError, errorMessage } from '@/core/http';
import { useSession } from '@/core/session';
import {
  Avatar,
  Banner,
  Button,
  C,
  Card,
  ChipGroup,
  Divider,
  EmptyState,
  Icon,
  IconButton,
  MoneyField,
  Page,
  Pill,
  PressableScale,
  Section,
  Select,
  SubHeader,
  TabPanel,
  TextField,
  toast,
  Txt,
} from '@/ui';
import { startCustomerDraft } from '../customers/draft';
import { newCustomerForm } from '../customers/form';
import { customerPerms } from '../customers/model';
import {
  addOrderPayment,
  addPaymentNote,
  bankOptions,
  createOrder,
  createPosInvoice,
  useBankAccounts,
  usePromotionCheck,
  type BankAccount,
  type EligiblePromotion,
} from './api';
import { cartTotals, useCart, type PayKind, type SaleMode } from './cart';
import { LineRow, SumRow } from './components';
import { closeDraft, draftLabel, useDrafts } from './drafts';
import { buildInvoicePayload, buildOrderPayload, paymentNoteOf, validateCheckout } from './payload';
import { useSalePerms, type SalePerms } from './perms';
import { useScopedCart } from './scope';
import { lineTotal } from './totals';

const MODE_ORDER: SaleMode[] = ['order', 'invoice'];
const PAY_ORDER: PayKind[] = ['transfer', 'cash'];

/** Đơn vừa tạo (cho màn hoàn tất). Giữ trong bộ nhớ, không đưa lên đường dẫn. */
export interface LastSale {
  kind: SaleMode;
  id: number;
  code: string;
  total: number;
  customerName: string;
  /** Việc cần làm thêm (vd chưa ghi được tiền cọc). */
  notes: string[];
  /** Hàng chưa đủ tồn kho (đơn đặt hàng vẫn được tạo). */
  stockWarnings: string[];
}

export const useLastSale = create<{ sale: LastSale | null }>(() => ({ sale: null }));

/** Chế độ được phép: có cả 2 quyền thì theo lựa chọn, không thì cố định. */
export function allowedMode(perms: Pick<SalePerms, 'order' | 'invoice'>, wanted: SaleMode): SaleMode {
  if (perms.order && perms.invoice) return wanted;
  return perms.order ? 'order' : 'invoice';
}

export interface CheckoutViewProps {
  perms: SalePerms;
  bankAccounts?: BankAccount[];
  promotions?: EligiblePromotion[];
  submitting?: boolean;
  onSubmit: () => void;
  onOpenCustomer: () => void;
  onCreateCustomer?: () => void;
  onOpenLine: (rowId: string) => void;
  onOpenDelivery: () => void;
  onOpenDiscount: () => void;
  onAddMore: () => void;
  onClear: () => void;
  /** Tên đơn nháp đang mở (vd "Đơn 2"). */
  draftName?: string | null;
  /** Còn đơn nháp khác: nút xóa là xóa đơn nháp này. */
  manyDrafts?: boolean;
}

/** Khách của giỏ đang mở; không truyền `onPress` thì không cho đổi khách. */
export function CustomerCard({ perms, onPress }: { perms: SalePerms; onPress?: () => void }) {
  const customer = useScopedCart((s) => s.customer);
  if (!customer) {
    return (
      <PressableScale onPress={onPress} accessibilityLabel="Chọn khách hàng" scaleTo={0.98} style={styles.pickCustomer}>
        <View style={styles.pickIcon}>
          <Icon name="user-plus" size={20} color={C.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="body" weight="semibold" color={C.brand}>
            Chọn khách hàng
          </Txt>
          <Txt variant="caption" color={C.muted}>
            Bắt buộc để tạo đơn
          </Txt>
        </View>
        <Icon name="chevron-right" size={18} color={C.brand} />
      </PressableScale>
    );
  }
  const debt = customer.totalDebt ?? 0;
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={onPress ? `Khách hàng ${customer.name}. Bấm để đổi` : `Khách hàng ${customer.name}`}
      style={styles.customer}>
      <Avatar name={customer.name} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="body" weight="semibold" numberOfLines={1}>
          {customer.name}
        </Txt>
        <Txt variant="caption" color={C.muted} numberOfLines={1}>
          {[customer.code, customer.contactNumber || customer.phone].filter(Boolean).join(' · ')}
        </Txt>
        {perms.viewDebt && debt !== 0 ? (
          <View style={{ flexDirection: 'row' }}>
            <Pill label={debt > 0 ? `Đang nợ ${money(debt)}` : `Trả trước ${money(-debt)}`} tone={debt > 0 ? 'danger' : 'success'} />
          </View>
        ) : null}
      </View>
      {onPress ? (
        <Txt variant="label" weight="semibold" color={C.brand}>
          Đổi
        </Txt>
      ) : null}
    </Card>
  );
}

export function DeliveryCard({ onPress }: { onPress: () => void }) {
  const d = useScopedCart((s) => s.delivery);
  const place = [d.address, d.wardName, d.locationName].filter(Boolean).join(', ');
  return (
    <Card onPress={onPress} accessibilityLabel="Sửa thông tin giao hàng" style={styles.delivery}>
      <Icon name="truck" size={20} color={C.brand} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="body" weight="semibold" numberOfLines={1}>
          {[d.receiver, d.contactNumber].filter(Boolean).join(' · ') || 'Chưa có người nhận'}
        </Txt>
        <Txt variant="caption" color={place ? C.muted : '#B45309'} numberOfLines={2}>
          {place || 'Chưa có địa chỉ giao hàng'}
        </Txt>
        {d.noteForDriver ? (
          <Txt variant="caption" color={C.muted} numberOfLines={1}>
            Ghi chú: {d.noteForDriver}
          </Txt>
        ) : null}
      </View>
      <Icon name="chevron-right" size={16} color={C.faint} />
    </Card>
  );
}

function PaymentCard({ perms, mode, bankAccounts }: { perms: SalePerms; mode: SaleMode; bankAccounts?: BankAccount[] }) {
  const cart = useCart();
  const t = cartTotals(cart);
  const paid = perms.viewPayment ? cart.paidAmount : 0;
  const left = t.total - paid;
  const paidLabel = mode === 'order' ? 'Đặt cọc' : 'Khách trả ngay';

  return (
    <Card style={styles.pay}>
      <Txt variant="label" weight="semibold">
        Hình thức thanh toán
      </Txt>
      <ChipGroup
        fill
        options={[
          { value: 'transfer', label: 'Chuyển khoản' },
          { value: 'cash', label: 'Tiền mặt' },
        ]}
        value={cart.payKind}
        onChange={cart.setPayKind}
      />
      {cart.payKind ? (
        <TabPanel value={cart.payKind} order={PAY_ORDER} style={{ gap: 12 }}>
          {cart.payKind === 'cash' ? (
            <MoneyField label="Tiền mặt cần thu" value={cart.cashAmount} onChange={cart.setCashAmount} />
          ) : null}

          {perms.viewPayment ? (
            <View style={{ gap: 8 }}>
              <MoneyField
                label={paidLabel}
                value={cart.paidAmount}
                onChange={(n) => cart.setPaid(n)}
                editable={perms.editPayment}
              />
              {perms.editPayment ? (
                <View style={styles.quick}>
                  <PressableScale onPress={() => cart.setPaid(0)} scaleTo={0.94} style={styles.quickBtn}>
                    <Txt variant="label" weight="semibold" color={C.brand}>
                      Chưa trả
                    </Txt>
                  </PressableScale>
                  <PressableScale onPress={() => cart.setPaid(t.total)} scaleTo={0.94} style={styles.quickBtn}>
                    <Txt variant="label" weight="semibold" color={C.brand}>
                      Trả đủ {money(t.total)}
                    </Txt>
                  </PressableScale>
                </View>
              ) : null}
            </View>
          ) : null}

          {cart.payKind === 'transfer' && paid > 0 ? (
            bankAccounts?.length ? (
              <Select
                variant="field"
                label="Tài khoản nhận"
                placeholder="Chọn tài khoản ngân hàng"
                options={bankOptions(bankAccounts)}
                value={cart.accountId ?? null}
                onChange={cart.setAccount}
              />
            ) : (
              <Txt variant="caption" color={C.muted}>
                Chưa có tài khoản ngân hàng nào.
              </Txt>
            )
          ) : null}
        </TabPanel>
      ) : (
        <Txt variant="caption" color={C.muted}>
          Chọn khách trả bằng chuyển khoản hay tiền mặt.
        </Txt>
      )}

      {perms.viewPayment && paid > 0 ? (
        <>
          <Divider />
          <SumRow
            label={left > 0 ? (mode === 'order' ? 'Còn lại' : 'Còn nợ') : left < 0 ? 'Tiền thừa' : 'Đã trả đủ'}
            value={left === 0 ? '✓' : vnd(Math.abs(left))}
            tone={left > 0 ? 'danger' : 'success'}
          />
        </>
      ) : null}
    </Card>
  );
}

/** Giỏ hàng và thanh toán. Đọc/ghi thẳng vào giỏ đang mở. */
export function CheckoutView(p: CheckoutViewProps) {
  const cart = useCart();
  const mode = allowedMode(p.perms, cart.mode);
  const t = cartTotals(cart);
  const canSwitch = p.perms.order && p.perms.invoice;
  const action = mode === 'order' ? 'Tạo đơn hàng' : 'Tạo hóa đơn';

  const footer = cart.lines.length ? (
    <View style={styles.footer}>
      <View style={{ flex: 1 }}>
        <Txt variant="caption" color={C.muted}>
          Khách cần trả
        </Txt>
        <Txt variant="title" numeric numberOfLines={1} adjustsFontSizeToFit>
          {money(t.total)} ₫
        </Txt>
      </View>
      <Button title={action} icon="check" onPress={p.onSubmit} loading={p.submitting} disabled={p.submitting} style={{ flex: 1.2 }} />
    </View>
  ) : null;

  return (
    <Page
      stickyHeader
      header={
        <SubHeader
          title={p.draftName ? `Giỏ hàng · ${p.draftName}` : 'Giỏ hàng'}
          right={
            cart.lines.length ? (
              <IconButton icon="trash" label={p.manyDrafts ? 'Xóa đơn nháp' : 'Xóa giỏ hàng'} tint="#B91C1C" onPress={p.onClear} />
            ) : undefined
          }>
          {canSwitch ? (
            <ChipGroup
              fill
              options={[
                { value: 'order', label: 'Đặt hàng' },
                { value: 'invoice', label: 'Hóa đơn' },
              ]}
              value={mode}
              onChange={cart.setMode}
            />
          ) : null}
        </SubHeader>
      }
      footer={footer}
      automaticallyAdjustKeyboardInsets
      contentStyle={{ paddingBottom: 32 }}>
      <Section
        index={0}
        title="Khách hàng"
        actionLabel={p.onCreateCustomer ? 'Tạo khách' : undefined}
        onAction={p.onCreateCustomer}>
        <CustomerCard perms={p.perms} onPress={p.onOpenCustomer} />
      </Section>

      {cart.lines.length === 0 ? (
        <Section index={1} title="Hàng hóa">
          <EmptyState
            icon="shopping-cart"
            color="teal"
            title="Chưa có hàng hóa"
            message="Bạn có thể chọn khách hàng trước hoặc thêm hàng để bắt đầu."
            action={<Button title="Chọn hàng" variant="outline" size="medium" onPress={p.onAddMore} />}
          />
        </Section>
      ) : (
        <>
          <Section index={1} title={`Hàng hóa · ${cart.lines.length}`} actionLabel="Thêm hàng" onAction={p.onAddMore}>
            <Card>
              {cart.lines.map((l, i) => (
                <View key={l.rowId}>
                  {i > 0 ? <Divider inset={14} /> : null}
                  <LineRow
                    line={l}
                    total={lineTotal({ price: l.price, quantity: l.quantity, discount: { type: 'amount', value: l.discount } })}
                    onPress={() => p.onOpenLine(l.rowId)}
                    onChangeQty={(n) => cart.setQuantity(l.rowId, n)}
                  />
                </View>
              ))}
            </Card>
          </Section>

          {cart.customer ? (
            <Section index={2} title="Giao hàng">
              <DeliveryCard onPress={p.onOpenDelivery} />
            </Section>
          ) : null}

          {p.promotions?.length ? (
            <Banner
              tone="warning"
              icon="tag"
              title="Đơn này có khuyến mãi"
              message={`${p.promotions.map((x) => x.name).join(', ')}. App chưa áp dụng khuyến mãi; muốn khách được hưởng, hãy tạo đơn trên web.`}
            />
          ) : null}

          <Section index={3} title="Thanh toán">
            <Card style={styles.sum}>
              <SumRow label={`Tổng tiền hàng (${money(t.itemCount)} món)`} value={money(t.subtotal)} />
              <SumRow
                label="Giảm giá đơn"
                hint={cart.orderDiscount.type === 'percent' && cart.orderDiscount.value > 0 ? `${cart.orderDiscount.value}%` : undefined}
                value={t.orderDiscount ? `-${money(t.orderDiscount)}` : '0'}
                onPress={p.perms.editDiscount ? p.onOpenDiscount : undefined}
              />
              <SumRow label="Phí giao hàng" value={money(t.shipping)} onPress={p.onOpenDiscount} />
              <Divider />
              <SumRow label="Khách cần trả" value={`${money(t.total)} ₫`} strong />
            </Card>
            <TabPanel value={mode} order={MODE_ORDER}>
              <PaymentCard perms={p.perms} mode={mode} bankAccounts={p.bankAccounts} />
            </TabPanel>
          </Section>

          <Section index={4} title="Ghi chú">
            <TextField
              label="Ghi chú cho đơn"
              value={cart.note}
              onChangeText={cart.setNote}
              placeholder="Không bắt buộc"
              multiline
              maxLength={1000}
              style={{ minHeight: 64, textAlignVertical: 'top' }}
            />
          </Section>
        </>
      )}
    </Page>
  );
}

export default function CheckoutScreen() {
  const perms = useSalePerms();
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const branchId = useSession((s) => s.branchId);
  const lines = useCart((s) => s.lines);
  const customer = useCart((s) => s.customer);
  const payKind = useCart((s) => s.payKind);
  const paidAmount = useCart((s) => s.paidAmount);
  const draftName = useDrafts((s) => {
    const d = s.drafts.find((x) => x.id === s.activeId);
    return d ? draftLabel(d) : null;
  });
  const manyDrafts = useDrafts((s) => s.drafts.length > 1);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const canCreateCustomer = perms.customers && customerPerms(user).create;

  const banks = useBankAccounts(perms.viewPayment && payKind === 'transfer' && paidAmount > 0);
  const promos = usePromotionCheck(
    {
      customerId: customer?.id,
      userId: user?.id,
      items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity, price: l.price, discount: l.discount })),
    },
    lines.length > 0,
  );

  const submit = async () => {
    if (busyRef.current || !user) return;
    const cart = useCart.getState();
    // Đang gửi vẫn có thể quay lại đổi đơn nháp: nhớ đơn nào để đóng đúng đơn.
    const draftId = useDrafts.getState().activeId;
    const mode = allowedMode(perms, cart.mode);
    const state = { ...cart, mode };
    const problem = validateCheckout(state, { branchId, canPay: perms.viewPayment });
    if (problem) return toast.error(problem);

    busyRef.current = true;
    setBusy(true);
    const paid = perms.viewPayment ? cart.paidAmount : 0;
    const ctx = { branchId: branchId as number, userId: user.id, paid };
    let sale: LastSale;
    try {
      if (mode === 'invoice') {
        const res = await createPosInvoice(buildInvoicePayload(state, ctx));
        sale = { kind: 'invoice', id: res.id, code: res.code, total: 0, customerName: '', notes: [], stockWarnings: [] };
      } else {
        const res = await createOrder(buildOrderPayload(state, ctx));
        sale = {
          kind: 'order',
          id: res.order.id,
          code: res.order.code,
          total: 0,
          customerName: '',
          notes: [],
          stockWarnings: res.warnings ?? [],
        };
      }
    } catch (e) {
      busyRef.current = false;
      setBusy(false);
      // Không có chống tạo trùng ở máy chủ: mất mạng giữa chừng thì không tự gửi lại.
      if (e instanceof ApiError && e.status === 0) {
        Alert.alert(
          'Chưa rõ đơn đã tạo chưa',
          'Mất kết nối khi đang gửi đơn. Hãy xem lại danh sách đơn trên web trước khi tạo lại, để tránh tạo trùng.',
        );
      } else {
        toast.error(errorMessage(e));
      }
      return;
    }

    // Phần ghi thêm: lỗi ở đây không làm hỏng đơn đã tạo.
    if (mode === 'order' && paid > 0 && cart.payKind) {
      try {
        await addOrderPayment({
          orderId: sale.id,
          amount: paid,
          paymentMethod: cart.payKind,
          ...(cart.payKind === 'transfer' && cart.accountId ? { accountId: cart.accountId } : null),
        });
      } catch {
        sale.notes.push('Chưa ghi được tiền đặt cọc, hãy ghi lại trên web.');
      }
    }
    const note = paymentNoteOf(state);
    if (note) {
      try {
        await addPaymentNote(mode === 'invoice' ? 'invoices' : 'orders', sale.id, note);
      } catch {
        sale.notes.push('Chưa ghi được hình thức thanh toán, hãy ghi lại trên web.');
      }
    }

    sale.total = cartTotals(cart).total;
    sale.customerName = cart.customer?.name ?? '';
    useLastSale.setState({ sale });
    closeDraft(draftId, { mode: cart.mode, priceBookId: cart.priceBookId, priceBookName: cart.priceBookName });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
    void qc.invalidateQueries({ queryKey: ['sales', 'products'] });
    busyRef.current = false;
    setBusy(false);
    router.replace('/ban-hang/xong');
  };

  return (
    <CheckoutView
      perms={perms}
      bankAccounts={banks.data}
      promotions={promos.data}
      submitting={busy}
      onSubmit={() => void submit()}
      onOpenCustomer={() => router.push('/ban-hang/khach-hang')}
      onCreateCustomer={
        canCreateCustomer
          ? () => {
              startCustomerDraft(newCustomerForm(), null, 'sale');
              router.push('/khach-hang/them' as never);
            }
          : undefined
      }
      onOpenLine={(rowId) => router.push({ pathname: '/ban-hang/dong/[rowId]', params: { rowId } })}
      onOpenDelivery={() => router.push('/ban-hang/giao-hang')}
      onOpenDiscount={() => router.push('/ban-hang/giam-gia')}
      onAddMore={() => router.dismissTo('/ban-hang')}
      draftName={draftName}
      manyDrafts={manyDrafts}
      onClear={() =>
        Alert.alert(
          manyDrafts ? `Xóa ${draftName}?` : 'Xóa giỏ hàng?',
          manyDrafts
            ? 'Toàn bộ hàng, khách và thanh toán của đơn nháp này sẽ bị xóa.'
            : 'Toàn bộ hàng, khách và thanh toán trong giỏ sẽ bị xóa.',
          [
            { text: 'Hủy', style: 'cancel' },
            {
              text: manyDrafts ? 'Xóa đơn' : 'Xóa giỏ',
              style: 'destructive',
              onPress: () => {
                const c = useCart.getState();
                closeDraft(useDrafts.getState().activeId, {
                  mode: c.mode,
                  priceBookId: c.priceBookId,
                  priceBookName: c.priceBookName,
                });
                // Xóa đơn nháp thì về màn chọn hàng của đơn kế bên.
                if (manyDrafts) router.dismissTo('/ban-hang');
              },
            },
          ],
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  pickCustomer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#9CCFD5',
    backgroundColor: '#F2FAFB',
  },
  pickIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customer: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  delivery: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  sum: { paddingHorizontal: 16, paddingVertical: 6 },
  pay: { padding: 16, gap: 12 },
  quick: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: C.brandSoft,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
});
