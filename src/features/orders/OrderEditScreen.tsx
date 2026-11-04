import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { canDo } from '@/core/can';
import { money, vnd } from '@/core/format';
import { errorMessage } from '@/core/http';
import { useSession } from '@/core/session';
import {
  addOrderPayment,
  addPaymentNote,
  bankOptions,
  useBankAccounts,
  usePromotionCheck,
  type BankAccount,
  type EligiblePromotion,
} from '@/features/sales/api';
import { cartTotals, type PayKind } from '@/features/sales/cart';
import { CustomerCard, DeliveryCard } from '@/features/sales/CheckoutScreen';
import { LineRow, SumRow } from '@/features/sales/components';
import { useSalePerms, type SalePerms } from '@/features/sales/perms';
import { useSaleScope, useScopedCart } from '@/features/sales/scope';
import { lineTotal } from '@/features/sales/totals';
import {
  Banner,
  Button,
  C,
  Card,
  ChipGroup,
  Divider,
  EmptyState,
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
import { addInvoicePayment, fetchInvoiceForEdit, fetchOrderForEdit, refreshAfterDocChange, updateInvoice, updateOrder } from './api';
import {
  buildInvoiceUpdate,
  buildOrderUpdate,
  editChanges,
  editPaymentNote,
  hasOrderFields,
  invoiceEditProblem,
  validateOrderEdit,
  type OrderEditMeta,
} from './editOrder';
import { markEditOpen, useDocRoutes, useOrderEditMeta, withOrderEdit } from './editScope';
import { kindFromSlug, KIND_SLUG, ORDER_STATUS, statusOf } from './model';

const PAY_ORDER: PayKind[] = ['transfer', 'cash'];

export type EditBusy = 'save' | 'invoice' | null;

export interface OrderEditViewProps {
  meta: OrderEditMeta;
  perms: SalePerms;
  canInvoice: boolean;
  busy: EditBusy;
  bankAccounts?: BankAccount[];
  promotions?: EligiblePromotion[];
  onSave: () => void;
  onInvoice: () => void;
  onOpenCustomer: () => void;
  onOpenLine: (rowId: string) => void;
  onOpenDelivery: () => void;
  onOpenDiscount: () => void;
  onAddMore?: () => void;
}

/** Tiền: hình thức thanh toán (bắt buộc), tiền mặt cần thu, khách trả thêm. */
function EditPaymentCard({ perms, paidBefore, bankAccounts }: { perms: SalePerms; paidBefore: number; bankAccounts?: BankAccount[] }) {
  const { store } = useSaleScope();
  const cart = useScopedCart((s) => s);
  const t = cartTotals(cart);
  const due = Math.max(0, t.total - paidBefore);
  const paid = perms.viewPayment ? cart.paidAmount : 0;

  const pickKind = (kind: PayKind) => {
    const s = store.getState();
    s.setPayKind(kind);
    // Tiền mặt cần thu: phần còn lại sau tiền khách đã trả/đặt cọc.
    if (kind === 'cash') s.setCashAmount(due);
  };

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
        onChange={pickKind}
      />
      {cart.payKind ? (
        <TabPanel value={cart.payKind} order={PAY_ORDER} style={{ gap: 12 }}>
          {cart.payKind === 'cash' ? <MoneyField label="Tiền mặt cần thu" value={cart.cashAmount} onChange={cart.setCashAmount} /> : null}

          {perms.viewPayment ? (
            <View style={{ gap: 8 }}>
              <MoneyField label="Khách trả thêm" value={cart.paidAmount} onChange={(n) => cart.setPaid(n)} editable={perms.editPayment} />
              {perms.editPayment ? (
                <View style={styles.quick}>
                  <PressableScale onPress={() => cart.setPaid(0)} scaleTo={0.94} style={styles.quickBtn}>
                    <Txt variant="label" weight="semibold" color={C.brand}>
                      Chưa trả
                    </Txt>
                  </PressableScale>
                  {due > 0 ? (
                    <PressableScale onPress={() => cart.setPaid(due)} scaleTo={0.94} style={styles.quickBtn}>
                      <Txt variant="label" weight="semibold" color={C.brand}>
                        Trả hết {money(due)}
                      </Txt>
                    </PressableScale>
                  ) : null}
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
    </Card>
  );
}

/**
 * Xử lý đơn hàng (giống web): sửa hàng, khách, giao hàng, giảm giá, thanh
 * toán rồi Lưu; hoặc bấm Tạo hóa đơn để chuyển sang xuất hóa đơn từ đơn.
 */
export function OrderEditView(p: OrderEditViewProps) {
  const cart = useScopedCart((s) => s);
  const t = cartTotals(cart);
  const locked = p.meta.promoLocked;
  const invoice = p.meta.kind === 'invoice';
  const noun = invoice ? 'hóa đơn' : 'đơn';
  const status = statusOf(p.meta.kind, p.meta.status);
  const paidBefore = p.perms.viewPayment ? p.meta.paidBefore : 0;
  const paidNow = p.perms.viewPayment ? cart.paidAmount : 0;
  const left = t.total - paidBefore - paidNow;
  const disabled = p.busy !== null;

  const footer = (
    <View style={styles.footer}>
      {p.canInvoice && !invoice ? (
        <Button
          title="Tạo hóa đơn"
          icon="receipt"
          variant="outline"
          onPress={p.onInvoice}
          loading={p.busy === 'invoice'}
          disabled={disabled || cart.lines.length === 0}
          style={{ flex: 1 }}
        />
      ) : null}
      <Button
        title="Lưu"
        icon="check"
        onPress={p.onSave}
        loading={p.busy === 'save'}
        disabled={disabled || cart.lines.length === 0}
        style={{ flex: 1 }}
      />
    </View>
  );

  return (
    <Page
      stickyHeader
      header={
        <SubHeader title={invoice ? 'Xử lý hóa đơn' : 'Xử lý đơn hàng'}>
          <View style={styles.headRow}>
            <Txt variant="label" weight="semibold" color={C.muted}>
              {p.meta.code}
            </Txt>
            <Pill label={status.label} tone={status.tone} />
          </View>
        </SubHeader>
      }
      footer={footer}
      automaticallyAdjustKeyboardInsets
      contentStyle={{ paddingBottom: 32 }}>
      {locked ? (
        <Banner
          tone="info"
          icon="tag"
          title={invoice ? 'Hóa đơn có khuyến mãi' : 'Đơn có khuyến mãi'}
          message={
            invoice
              ? 'Để giữ đúng khuyến mãi, app chưa đổi được hàng, khách, giảm giá và bảng giá của hóa đơn này. Muốn đổi, hãy sửa trên web.'
              : 'Để giữ đúng khuyến mãi, app chưa đổi được hàng và khách của đơn này. Muốn đổi hàng, hãy sửa trên web.'
          }
        />
      ) : null}

      <Section index={0} title="Khách hàng">
        <CustomerCard perms={p.perms} onPress={locked ? undefined : p.onOpenCustomer} />
      </Section>

      <Section
        index={1}
        title={`Hàng hóa · ${cart.lines.length}`}
        actionLabel={!locked && p.onAddMore ? 'Thêm hàng' : undefined}
        onAction={!locked ? p.onAddMore : undefined}>
        {cart.lines.length ? (
          <Card>
            {cart.lines.map((l, i) => (
              <View key={l.rowId}>
                {i > 0 ? <Divider inset={14} /> : null}
                <LineRow
                  line={l}
                  locked={locked}
                  total={lineTotal({ price: l.price, quantity: l.quantity, discount: { type: 'amount', value: l.discount } })}
                  onPress={() => p.onOpenLine(l.rowId)}
                  onChangeQty={(n) => cart.setQuantity(l.rowId, n)}
                />
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState
            icon="package"
            color="slate"
            title={invoice ? 'Hóa đơn chưa có hàng' : 'Đơn chưa có hàng'}
            message={`Thêm ít nhất 1 món trước khi lưu ${noun}.`}
            action={p.onAddMore ? <Button title="Thêm hàng" variant="outline" size="medium" onPress={p.onAddMore} /> : undefined}
          />
        )}
      </Section>

      <Section index={2} title="Giao hàng">
        <DeliveryCard onPress={p.onOpenDelivery} />
      </Section>

      {p.promotions?.length ? (
        <Banner
          tone="warning"
          icon="tag"
          title={invoice ? 'Hóa đơn này có khuyến mãi' : 'Đơn này có khuyến mãi'}
          message={`${p.promotions.map((x) => x.name).join(', ')}. App chưa áp dụng khuyến mãi; muốn khách được hưởng, hãy sửa ${noun} trên web.`}
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
          {paidBefore > 0 ? <SumRow label="Khách đã trả" value={money(paidBefore)} /> : null}
          {p.perms.viewPayment && (paidBefore > 0 || paidNow > 0) ? (
            <SumRow
              label={left > 0 ? 'Còn lại' : left < 0 ? 'Trả thừa' : 'Đã trả đủ'}
              value={left === 0 ? '✓' : vnd(Math.abs(left))}
              tone={left > 0 ? 'danger' : 'success'}
            />
          ) : null}
        </Card>
        <EditPaymentCard perms={p.perms} paidBefore={paidBefore} bankAccounts={p.bankAccounts} />
      </Section>

      <Section index={4} title="Ghi chú">
        <TextField
          label={invoice ? 'Ghi chú cho hóa đơn' : 'Ghi chú cho đơn'}
          value={cart.note}
          onChangeText={cart.setNote}
          placeholder="Không bắt buộc"
          multiline
          maxLength={1000}
          style={{ minHeight: 64, textAlignVertical: 'top' }}
        />
      </Section>
    </Page>
  );
}

/** Hỏi Có/Không bằng hộp thoại hệ thống. */
const ask = (title: string, message: string, ok: string) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: 'Hủy', style: 'cancel', onPress: () => resolve(false) },
        { text: ok, onPress: () => resolve(true) },
      ],
      { cancelable: false },
    ),
  );

function OrderEditScreen() {
  const params = useLocalSearchParams<{ id: string; kind?: string }>();
  const kind = kindFromSlug(params.kind);
  const meta = useOrderEditMeta((s) => s.meta);
  const { store, paths } = useSaleScope();
  const routes = useDocRoutes();
  const cart = useScopedCart((s) => s);
  const perms = useSalePerms();
  const user = useSession((s) => s.user);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<EditBusy>(null);
  // Sau khi lưu xong: rời màn mà không hỏi "bỏ thay đổi".
  const [exit, setExit] = useState<{ go: () => void } | null>(null);
  // Đã chọn "Bỏ thay đổi": thôi chặn rời màn.
  const [discarding, setDiscarding] = useState(false);
  const busyRef = useRef(false);

  // Cho màn chi tiết ở tab khác biết đơn này đang mở để hỏi trước khi ghi đè.
  useEffect(() => markEditOpen(), []);

  const banks = useBankAccounts(perms.viewPayment && cart.payKind === 'transfer' && cart.paidAmount > 0);
  const changes = meta ? editChanges(cart, meta.original) : null;
  const promos = usePromotionCheck(
    {
      customerId: cart.customer?.id,
      userId: user?.id,
      items: cart.lines.map((l) => ({ productId: l.product.id, quantity: l.quantity, price: l.price, discount: l.discount })),
    },
    !!changes?.lines && !meta?.promoLocked,
  );

  // Phải gọi `repeat()` (tắt chặn rồi đi tiếp); tự dispatch lại hành động thì
  // màn vẫn đang bị chặn nên hộp hỏi hiện lại mãi.
  usePreventRemove(!!changes?.any && !exit && !discarding, ({ repeat }) => {
    Alert.alert('Bỏ thay đổi?', `Những thay đổi chưa lưu của ${kind === 'invoice' ? 'hóa đơn' : 'đơn'} này sẽ mất.`, [
      { text: 'Ở lại', style: 'cancel' },
      {
        text: 'Bỏ thay đổi',
        style: 'destructive',
        onPress: () => {
          setDiscarding(true);
          repeat();
        },
      },
    ]);
  });

  useEffect(() => {
    if (exit) exit.go();
  }, [exit]);

  if (!meta || meta.docId !== Number(params.id) || meta.kind !== kind) {
    const invoice = kind === 'invoice';
    return (
      <Page scroll={false} header={<SubHeader title={invoice ? 'Xử lý hóa đơn' : 'Xử lý đơn hàng'} />}>
        <EmptyState
          icon="clipboard-list"
          color="slate"
          title={invoice ? 'Không có hóa đơn đang xử lý' : 'Không có đơn đang xử lý'}
          message={
            invoice
              ? 'Mở lại hóa đơn ở danh sách Đơn hàng rồi bấm “Xử lý hóa đơn”.'
              : 'Mở lại đơn ở danh sách Đơn hàng rồi bấm “Xử lý đơn hàng”.'
          }
        />
      </Page>
    );
  }

  /** Ghi tiền khách trả thêm và ghi chú thanh toán; lỗi ở đây không làm hỏng phần đã lưu. */
  const savePayments = async (docId: number, forceNote: boolean) => {
    const c = store.getState();
    const paid = perms.viewPayment ? c.paidAmount : 0;
    if (paid > 0 && c.payKind) {
      const account = c.payKind === 'transfer' && c.accountId ? { accountId: c.accountId } : null;
      try {
        if (meta.kind === 'invoice') await addInvoicePayment({ invoiceId: docId, amount: paid, paymentMethod: c.payKind, ...account });
        else await addOrderPayment({ orderId: docId, amount: paid, paymentMethod: c.payKind, ...account });
      } catch {
        toast.error('Chưa ghi được tiền khách trả thêm, hãy ghi lại trên web.');
      }
    }
    // Hóa đơn mới (.01) không mang theo ghi chú thanh toán: ghi lại.
    const note =
      forceNote && c.payKind
        ? c.payKind === 'cash'
          ? { paymentType: 'cash', amount: c.cashAmount }
          : { paymentType: 'transfer' }
        : editPaymentNote(c, meta.original);
    if (note) {
      try {
        await addPaymentNote(meta.kind === 'invoice' ? 'invoices' : 'orders', docId, note);
      } catch {
        toast.error('Chưa ghi được hình thức thanh toán, hãy ghi lại trên web.');
      }
    }
  };

  const refresh = () => refreshAfterDocChange(qc);

  /**
   * Lưu đơn đặt hàng: chỉ gửi phần đã sửa, rồi ghi tiền khách trả thêm và
   * ghi chú thanh toán. `confirm` chuyển Phiếu tạm sang Đã xác nhận.
   */
  const persistOrder = async (confirm: boolean): Promise<boolean> => {
    const c = store.getState();
    const changed = editChanges(c, meta.original);
    if (changed.any) {
      const problem = validateOrderEdit(c, { canPay: perms.viewPayment });
      if (problem) {
        toast.error(problem);
        return false;
      }
    }
    try {
      // Giống web: đơn vừa được xuất hóa đơn (kho xử lý) thì không lưu đè.
      const fresh = await fetchOrderForEdit(meta.docId);
      if ((fresh.invoices ?? []).some((i) => i.status !== 2)) {
        toast.error('Đơn hàng đã ra hóa đơn, không thể lưu thay đổi. Quay lại để xem trạng thái mới nhất.');
        return false;
      }
      if (fresh.status === ORDER_STATUS.completed.code || fresh.status === ORDER_STATUS.cancelled.code) {
        toast.error(`Đơn đã chuyển sang ${statusOf('order', fresh.status).label}, không lưu thay đổi được nữa.`);
        return false;
      }
      if (changed.any && fresh.updatedAt && meta.updatedAt && fresh.updatedAt !== meta.updatedAt) {
        const go = await ask(
          'Đơn vừa được sửa ở nơi khác',
          'Lưu bây giờ sẽ ghi đè thay đổi đó bằng nội dung đang thấy trên màn hình.',
          'Vẫn lưu',
        );
        if (!go) return false;
      }

      const body = buildOrderUpdate(c, meta, { confirm });
      if (hasOrderFields(body)) await updateOrder(meta.docId, body);
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    }
    await savePayments(meta.docId, false);
    await refresh();
    return true;
  };

  /**
   * Lưu hóa đơn: chỉ gửi phần đã sửa. Đổi hàng / giảm giá / bảng giá thì
   * backend tạo hóa đơn mới → trả về hóa đơn mới để mở ra xem.
   */
  const persistInvoice = async (): Promise<{ id: number; code: string } | null> => {
    const c = store.getState();
    const problem = validateOrderEdit(c, { canPay: perms.viewPayment, kind: 'invoice' }) ?? invoiceEditProblem(c, meta);
    if (problem) {
      toast.error(problem);
      return null;
    }

    let result = { id: meta.docId, code: meta.code };
    try {
      const fresh = await fetchInvoiceForEdit(meta.docId);
      if (Number(fresh.status) === 2) {
        toast.error('Hóa đơn đã bị hủy (có thể đã được sửa thành hóa đơn mới). Quay lại để xem hóa đơn mới nhất.');
        return null;
      }
      const finalized = Number(fresh.status) === 1 || Number(fresh.status) === 7;
      if (finalized && !canDo(user, 'invoices:update_finalized')) {
        toast.error(`Hóa đơn đã chuyển sang ${statusOf('invoice', fresh.status).label}, bạn không có quyền sửa nữa.`);
        return null;
      }
      if (fresh.updatedAt && meta.updatedAt && fresh.updatedAt !== meta.updatedAt) {
        const go = await ask(
          'Hóa đơn vừa được sửa ở nơi khác',
          'Lưu bây giờ sẽ ghi đè thay đổi đó bằng nội dung đang thấy trên màn hình.',
          'Vẫn lưu',
        );
        if (!go) return null;
      }
      const body = buildInvoiceUpdate(c, meta);
      if (hasOrderFields(body)) {
        const saved = await updateInvoice(meta.docId, body);
        if (saved?.id) result = { id: saved.id, code: saved.code ?? meta.code };
      }
    } catch (e) {
      toast.error(errorMessage(e));
      return null;
    }
    await savePayments(result.id, result.id !== meta.docId);
    await refresh();
    return result;
  };

  const runOnce = async (kind: Exclude<EditBusy, null>, task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(kind);
    try {
      await task();
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const onSave = () =>
    void runOnce('save', async () => {
      if (!changes?.any) {
        setExit({ go: () => router.back() });
        return;
      }
      if (meta.kind === 'invoice') {
        const saved = await persistInvoice();
        if (!saved) return;
        if (saved.id !== meta.docId) {
          toast.success(`Đã lưu thành hóa đơn mới ${saved.code}`);
          setExit({
            go: () =>
              router.replace({ pathname: routes.detail, params: { kind: KIND_SLUG.invoice, id: String(saved.id) } } as never),
          });
          return;
        }
        toast.success(`Đã lưu hóa đơn ${meta.code}`);
        setExit({ go: () => router.back() });
        return;
      }
      if (await persistOrder(false)) {
        toast.success(`Đã lưu đơn ${meta.code}`);
        setExit({ go: () => router.back() });
      }
    });

  const toInvoice = (confirm: boolean) =>
    void runOnce('invoice', async () => {
      if (changes?.any || confirm) {
        if (!(await persistOrder(confirm))) return;
        toast.success(confirm ? `Đã xác nhận đơn ${meta.code}` : 'Đã lưu thay đổi của đơn');
      }
      setExit({ go: () => router.replace({ pathname: routes.invoiceDraft, params: { orderId: String(meta.docId) } } as never) });
    });

  const onInvoice = () => {
    // Giống backend: chỉ tạo hóa đơn từ đơn đã xác nhận.
    if (meta.status !== ORDER_STATUS.pending.code) return toInvoice(false);
    Alert.alert(
      'Xác nhận đơn hàng?',
      `Đơn ${meta.code} đang là Phiếu tạm. Cần xác nhận đơn trước khi tạo hóa đơn${changes?.any ? ', thay đổi của bạn cũng sẽ được lưu' : ''}.`,
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        { text: 'Xác nhận đơn', onPress: () => toInvoice(true) },
      ],
    );
  };

  return (
    <OrderEditView
      meta={meta}
      perms={perms}
      canInvoice={meta.kind === 'order' && canDo(user, 'invoices:create')}
      busy={busy}
      bankAccounts={banks.data}
      promotions={promos.data}
      onSave={onSave}
      onInvoice={onInvoice}
      onOpenCustomer={() => router.push(paths.customer as never)}
      onOpenLine={(rowId) => router.push({ pathname: paths.line, params: { rowId } } as never)}
      onOpenDelivery={() => router.push(paths.delivery as never)}
      onOpenDiscount={() => router.push(paths.discount as never)}
      onAddMore={perms.products ? () => router.push(routes.editPicker as never) : undefined}
    />
  );
}

export default withOrderEdit(OrderEditScreen);

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
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
