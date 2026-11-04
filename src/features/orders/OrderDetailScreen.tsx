import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, StyleSheet, View } from 'react-native';
import { canDo } from '@/core/can';
import { dateTimeVN, money, qty, shortWhen } from '@/core/format';
import { errorMessage } from '@/core/http';
import { useSession } from '@/core/session';
import {
  Avatar,
  Button,
  C,
  Card,
  Divider,
  ErrorState,
  Icon,
  IconButton,
  LoadingState,
  Page,
  Pill,
  PressableScale,
  Section,
  SubHeader,
  toast,
  toneColors,
  Txt,
} from '@/ui';
import {
  cancelInvoice,
  cancelOrder,
  fetchInvoiceForEdit,
  fetchOrderForEdit,
  PAYMENT_METHOD,
  refreshAfterDocChange,
  updateInvoiceStatus,
  updateOrderStatus,
  useCashPackingLock,
  useDocDetail,
  type DocDetail,
  type DocLine,
} from './api';
import { toInvoiceEdit, toOrderEdit } from './editOrder';
import { confirmReplaceEdit, startOrderEdit, useDocRoutes } from './editScope';
import {
  INVOICE_STATUS,
  INVOICE_STEPS,
  invoiceActions,
  isCancelled,
  kindFromSlug,
  KIND_SLUG,
  ORDER_STATUS,
  orderActions,
  statusOf,
  type DocKind,
} from './model';

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'danger' | 'success' }) {
  const color = tone === 'danger' ? '#B91C1C' : tone === 'success' ? '#15803D' : C.text;
  return (
    <View style={styles.row}>
      <Txt
        variant={strong ? 'body' : 'label'}
        weight={strong ? 'semibold' : 'regular'}
        color={strong ? C.text : C.muted}
        style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt
        variant={strong ? 'heading' : 'body'}
        weight={strong ? 'bold' : 'medium'}
        color={color}
        numeric
        numberOfLines={1}
        style={{ flexShrink: 1 }}>
        {value}
      </Txt>
    </View>
  );
}

function LineItem({ line, kind }: { line: DocLine; kind: DocKind }) {
  const badges = [
    line.gift ? 'Quà tặng' : null,
    line.condition === 'damaged' ? 'Bục rách' : null,
    line.condition === 'near_expiry' ? 'Cận date' : null,
  ].filter(Boolean) as string[];
  return (
    <View style={styles.line}>
      <View style={{ flex: 1, gap: 3 }}>
        <Txt variant="body" weight="semibold" numberOfLines={2}>
          {line.name}
        </Txt>
        <Txt variant="caption" color={C.muted} numeric>
          {line.code ? `${line.code} · ` : ''}
          {qty(line.quantity)}
          {line.unit ? ` ${line.unit}` : ''} × {money(line.price)}
          {line.discount > 0 ? ` (giảm ${money(line.discount)})` : ''}
        </Txt>
        {kind === 'order' && line.invoicedQty !== undefined && line.invoicedQty > 0 ? (
          <Txt variant="caption" color={C.brand} numeric>
            Đã ra hóa đơn {qty(line.invoicedQty)}/{qty(line.quantity)}
          </Txt>
        ) : null}
        {line.note ? (
          <Txt variant="caption" color={C.muted} numberOfLines={2}>
            Ghi chú: {line.note}
          </Txt>
        ) : null}
        {badges.length ? (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
            {badges.map((b) => (
              <Pill key={b} label={b} tone={b === 'Quà tặng' ? 'success' : 'warning'} />
            ))}
          </View>
        ) : null}
      </View>
      <Txt variant="body" weight="bold" numeric>
        {money(line.total)}
      </Txt>
    </View>
  );
}

export interface OrderDetailViewProps {
  doc: DocDetail;
  canPrint: boolean;
  onPrint: () => void;
  onOpenOrder: (id: number) => void;
  onOpenInvoice: (id: number) => void;
  /** Thao tác đổi trạng thái / kết thúc / hủy. */
  actions?: {
    /** "Xử lý đơn hàng" / "Xử lý hóa đơn": mở màn sửa. */
    canProcess?: boolean;
    onProcess?: () => void;
    canChangeStatus: boolean;
    canComplete: boolean;
    canCancel: boolean;
    busy?: boolean;
    onChangeStatus: () => void;
    onComplete: () => void;
    onCancel: () => void;
  };
}

/** Chi tiết hóa đơn / đơn đặt hàng. */
export function OrderDetailView({ doc, canPrint, onPrint, onOpenOrder, onOpenInvoice, actions }: OrderDetailViewProps) {
  const st = statusOf(doc.kind, doc.status);
  const cancelled = isCancelled(doc.kind, doc.status);
  const discountLabel = doc.discountRatio > 0 ? `Giảm giá (${qty(doc.discountRatio)}%)` : 'Giảm giá';
  const activePayments = doc.payments.filter((p) => !p.cancelled);
  const noun = doc.kind === 'invoice' ? 'hóa đơn' : 'đơn hàng';

  return (
    <Page
      stickyHeader
      header={
        <SubHeader
          title={doc.code}
          right={canPrint ? <IconButton icon="printer" label="Xem và in phiếu" onPress={onPrint} /> : undefined}
        />
      }
      footer={
        actions?.canProcess && actions.onProcess ? (
          <View style={styles.footer}>
            <Button
              title={doc.kind === 'invoice' ? 'Xử lý hóa đơn' : 'Xử lý đơn hàng'}
              icon="receipt"
              onPress={actions.onProcess}
              disabled={actions.busy}
            />
          </View>
        ) : undefined
      }
      contentStyle={{ paddingBottom: 40 }}>
      <Section index={0}>
        <Card style={styles.head}>
          {actions?.canChangeStatus ? (
            <PressableScale
              onPress={actions.onChangeStatus}
              disabled={actions.busy}
              accessibilityLabel={`Trạng thái: ${st.label}`}
              accessibilityHint="Bấm để đổi trạng thái"
              hitSlop={10}
              scaleTo={0.94}
              style={[styles.statusBtn, { backgroundColor: toneColors[st.tone].bg }]}>
              <Txt variant="caption" weight="semibold" color={toneColors[st.tone].fg} numberOfLines={1}>
                {st.label}
              </Txt>
              <Icon name="chevron-down" size={14} color={toneColors[st.tone].fg} />
            </PressableScale>
          ) : (
            <Pill label={st.label} tone={st.tone} />
          )}
          <Txt variant="display" numeric style={cancelled ? styles.strike : null}>
            {money(doc.grandTotal)} ₫
          </Txt>
          <Txt variant="caption" color={C.muted}>
            {[doc.kind === 'invoice' ? 'Ngày bán' : 'Ngày đặt', dateTimeVN(doc.date)].join(': ')}
          </Txt>
          <Divider />
          {doc.branchName ? <Row label="Chi nhánh" value={doc.branchName} /> : null}
          {doc.sellerName ? <Row label="Người bán" value={doc.sellerName} /> : null}
          {doc.creatorName ? <Row label="Người tạo" value={doc.creatorName} /> : null}
          <Row label="Bảng giá" value={doc.priceBookName ?? 'Bảng giá chung'} />
        </Card>
      </Section>

      {doc.customer ? (
        <Section index={1} title="Khách hàng">
          <Card style={styles.customer}>
            <Avatar name={doc.customer.name} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="body" weight="semibold" numberOfLines={1}>
                {doc.customer.name}
              </Txt>
              <Txt variant="caption" color={C.muted} numberOfLines={1}>
                {[doc.customer.code, doc.customer.phone].filter(Boolean).join(' · ')}
              </Txt>
            </View>
          </Card>
          {doc.delivery ? (
            <Card style={styles.delivery}>
              <Icon name="truck" size={20} color={C.brand} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="label" weight="semibold" numberOfLines={1}>
                  {[doc.delivery.receiver, doc.delivery.phone].filter(Boolean).join(' · ') || 'Giao hàng'}
                </Txt>
                {doc.delivery.address ? (
                  <Txt variant="caption" color={C.muted}>
                    {doc.delivery.address}
                  </Txt>
                ) : null}
                {doc.delivery.note ? (
                  <Txt variant="caption" color={C.muted}>
                    Ghi chú tài xế: {doc.delivery.note}
                  </Txt>
                ) : null}
              </View>
            </Card>
          ) : null}
        </Section>
      ) : null}

      <Section index={2} title={`Hàng hóa · ${doc.lines.length}`}>
        <Card>
          {doc.lines.map((l, i) => (
            <View key={l.key}>
              {i > 0 ? <Divider inset={14} /> : null}
              <LineItem line={l} kind={doc.kind} />
            </View>
          ))}
        </Card>
      </Section>

      <Section index={3} title="Thanh toán">
        <Card style={styles.sum}>
          <Row label="Tổng tiền hàng" value={money(doc.totalAmount)} />
          <Row label={discountLabel} value={doc.discount ? `-${money(doc.discount)}` : '0'} />
          <Row label="Phí giao hàng" value={money(doc.shippingFee)} />
          <Divider />
          <Row label="Khách cần trả" value={`${money(doc.grandTotal)} ₫`} strong />
          <Row label={doc.kind === 'order' ? 'Đã cọc / đã trả' : 'Đã thu'} value={money(doc.paidAmount)} tone="success" />
          {!cancelled && doc.debtAmount > 0 ? <Row label="Còn nợ" value={money(doc.debtAmount)} tone="danger" /> : null}
        </Card>
        {activePayments.length ? (
          <Card>
            {activePayments.map((p, i) => (
              <View key={p.key}>
                {i > 0 ? <Divider inset={14} /> : null}
                <View style={styles.payment}>
                  <Icon name={p.method === 'cash' ? 'banknote' : 'landmark'} size={18} color={C.muted} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="label" weight="semibold">
                      {PAYMENT_METHOD[p.method ?? ''] ?? 'Thanh toán'}
                    </Txt>
                    <Txt variant="caption" color={C.muted}>
                      {[p.code, shortWhen(p.date)].filter(Boolean).join(' · ')}
                    </Txt>
                  </View>
                  <Txt variant="body" weight="semibold" numeric>
                    {money(p.amount)}
                  </Txt>
                </View>
              </View>
            ))}
          </Card>
        ) : null}
      </Section>

      {doc.sourceOrderId || doc.invoices.length ? (
        <Section index={4} title={doc.kind === 'invoice' ? 'Đơn đặt hàng gốc' : 'Hóa đơn đã ra'}>
          <Card>
            {doc.sourceOrderId ? (
              <PressableScale
                onPress={() => onOpenOrder(doc.sourceOrderId as number)}
                accessibilityLabel="Xem đơn đặt hàng gốc"
                style={styles.link}>
                <Icon name="receipt-text" size={18} color={C.brand} />
                <Txt variant="body" weight="semibold" color={C.brand} style={{ flex: 1 }}>
                  Xem đơn đặt hàng
                </Txt>
                <Icon name="chevron-right" size={16} color={C.faint} />
              </PressableScale>
            ) : null}
            {doc.invoices.map((inv, i) => {
              const s = statusOf('invoice', inv.status);
              return (
                <View key={inv.id}>
                  {i > 0 ? <Divider inset={14} /> : null}
                  <PressableScale onPress={() => onOpenInvoice(inv.id)} accessibilityLabel={`Xem hóa đơn ${inv.code}`} style={styles.link}>
                    <Icon name="receipt" size={18} color={C.brand} />
                    <Txt variant="body" weight="semibold" style={{ flex: 1 }} numeric>
                      {inv.code}
                    </Txt>
                    <Pill label={s.label} tone={s.tone} />
                    <Icon name="chevron-right" size={16} color={C.faint} />
                  </PressableScale>
                </View>
              );
            })}
          </Card>
        </Section>
      ) : null}

      {doc.note ? (
        <Section index={5} title="Ghi chú">
          <Card style={{ padding: 14 }}>
            <Txt variant="body">{doc.note}</Txt>
          </Card>
        </Section>
      ) : null}

      {canPrint || actions?.canComplete || actions?.canCancel ? (
        <View style={{ marginTop: 24, gap: 10 }}>
          {canPrint ? <Button title="Xem, in và gửi phiếu" icon="printer" variant="outline" onPress={onPrint} /> : null}
          {actions?.canComplete ? (
            <Button title={`Kết thúc ${noun}`} icon="circle-check" variant="outline" onPress={actions.onComplete} disabled={actions.busy} />
          ) : null}
          {actions?.canCancel ? (
            <Button title={`Hủy ${noun}`} icon="circle-x" variant="danger" onPress={actions.onCancel} disabled={actions.busy} />
          ) : null}
        </View>
      ) : null}
    </Page>
  );
}

type OrderStep = 'pending' | 'confirmed';
const ORDER_STEPS: OrderStep[] = ['pending', 'confirmed'];

/** Bảng chọn trạng thái theo kiểu iOS; trạng thái hiện tại có dấu ✓. */
function pickStatus<T>(title: string, steps: readonly T[], label: (s: T) => string, isCurrent: (s: T) => boolean, onPick: (s: T) => void) {
  const labels = steps.map((k) => `${isCurrent(k) ? '✓ ' : ''}${label(k)}`);
  const pick = (k: T) => {
    if (!isCurrent(k)) onPick(k);
  };
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions({ title, options: [...labels, 'Hủy'], cancelButtonIndex: labels.length }, (i) => {
      if (i < steps.length) pick(steps[i]);
    });
    return;
  }
  Alert.alert(title, undefined, [
    ...steps.map((k, i) => ({ text: labels[i], onPress: () => pick(k) })),
    { text: 'Hủy', style: 'cancel' as const },
  ]);
}

/** Hỏi trước khi hủy; có phiếu thu thì cho chọn hủy kèm hay giữ. */
function confirmCancel(noun: string, code: string, paymentCount: number, cancel: (withPayments: boolean) => void) {
  if (paymentCount > 0) {
    Alert.alert(
      `Hủy ${noun} ${code}?`,
      `${noun[0].toUpperCase()}${noun.slice(1)} có ${paymentCount} phiếu thu.\n• Hủy kèm phiếu thu: phiếu thu và sổ quỹ cũng bị hủy.\n• Giữ phiếu thu: tiền đã thu vẫn được ghi nhận cho khách.`,
      [
        { text: 'Hủy kèm phiếu thu', style: 'destructive', onPress: () => cancel(true) },
        { text: 'Hủy, giữ phiếu thu', onPress: () => cancel(false) },
        { text: 'Không hủy', style: 'cancel' },
      ],
    );
    return;
  }
  Alert.alert(`Hủy ${noun} ${code}?`, `${noun[0].toUpperCase()}${noun.slice(1)} đã hủy không khôi phục lại được.`, [
    { text: 'Không hủy', style: 'cancel' },
    { text: `Hủy ${noun}`, style: 'destructive', onPress: () => cancel(false) },
  ]);
}

export default function OrderDetailScreen() {
  const params = useLocalSearchParams<{ kind: string; id: string }>();
  const kind = kindFromSlug(params.kind);
  const id = Number(params.id);
  const user = useSession((s) => s.user);
  const branchId = useSession((s) => s.branchId);
  const qc = useQueryClient();
  const doc = useDocDetail(kind, id);
  const routes = useDocRoutes();
  const [busy, setBusy] = useState(false);
  const isAdmin = !!user?.roles?.some((r) => r === 'Super Admin' || r === 'Admin');
  const invoicePerms = {
    update: canDo(user, 'invoices:update'),
    cancel: canDo(user, 'invoices:cancel'),
    updateFinalized: canDo(user, 'invoices:update_finalized'),
  };
  // Chỉ cần kiểm tra phiếu đóng hàng khi người dùng có thể thao tác hóa đơn.
  const cashLocked = useCashPackingLock(id, kind === 'invoice' && !isAdmin && (invoicePerms.update || invoicePerms.cancel));
  const canPrint = canDo(user, kind === 'invoice' ? 'invoices:print' : 'orders:print') && canDo(user, 'print_templates:view');

  if (doc.isLoading || !doc.data) {
    return (
      <Page stickyHeader scroll={false} header={<SubHeader title={kind === 'invoice' ? 'Hóa đơn' : 'Đơn đặt hàng'} />}>
        {doc.isError ? <ErrorState error={doc.error} onRetry={() => void doc.refetch()} /> : <LoadingState />}
      </Page>
    );
  }

  const data = doc.data;
  const open = (k: DocKind, docId: number) =>
    router.push({ pathname: routes.detail, params: { kind: KIND_SLUG[k], id: String(docId) } } as never);

  /** Gọi API, báo kết quả, làm mới chi tiết + danh sách + tổng quan. */
  const run = async (task: () => Promise<unknown>, done: string): Promise<boolean> => {
    setBusy(true);
    try {
      await task();
      toast.success(done);
      // Đổi hóa đơn cũng làm đổi đơn đặt hàng gốc: làm mới mọi chi tiết.
      await refreshAfterDocChange(qc);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const paymentCount = data.payments.filter((p) => !p.cancelled).length;
  const cancelDone = (withPayments: boolean) =>
    paymentCount > 0 && withPayments ? `Đã hủy ${data.code} và phiếu thu` : `Đã hủy ${data.code}`;

  const orderAllowed =
    kind === 'order'
      ? orderActions(data, {
          update: canDo(user, 'orders:update'),
          cancel: canDo(user, 'orders:cancel'),
        })
      : null;
  const openInvoiceDraft = () => router.push({ pathname: routes.invoiceDraft, params: { orderId: String(data.id) } } as never);
  const invoiceAllowed = kind === 'invoice' ? invoiceActions(data, invoicePerms, cashLocked) : null;

  /**
   * "Xử lý đơn hàng" (giống web): tải đơn mới nhất rồi mở màn sửa đơn (Lưu /
   * Tạo hóa đơn). Đơn đã có hóa đơn thì không sửa nữa, chuyển thẳng sang tạo
   * tiếp hóa đơn từ phần còn lại.
   */
  const processOrder = async () => {
    setBusy(true);
    try {
      const { cart, meta } = toOrderEdit(await fetchOrderForEdit(data.id), branchId);
      if (![ORDER_STATUS.pending.code, ORDER_STATUS.confirmed.code, ORDER_STATUS.partially_invoiced.code].includes(meta.status)) {
        toast.error(`Đơn đang ở trạng thái ${statusOf('order', meta.status).label}, không xử lý được nữa.`);
        void qc.invalidateQueries({ queryKey: ['doc'] });
        return;
      }
      if (meta.invoiced) {
        if (!canDo(user, 'invoices:create')) {
          Alert.alert('Đơn đã ra hóa đơn', 'Đơn này chỉ còn xuất tiếp hóa đơn. Bạn chưa có quyền tạo hóa đơn.');
          return;
        }
        openInvoiceDraft();
        return;
      }
      if (!(await confirmReplaceEdit())) return;
      startOrderEdit(cart, meta);
      router.push({ pathname: routes.edit, params: { id: String(data.id) } } as never);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  /**
   * "Xử lý hóa đơn" (giống web): tải hóa đơn mới nhất rồi mở màn sửa (dùng
   * chung màn với Xử lý đơn hàng).
   */
  const processInvoice = async () => {
    setBusy(true);
    try {
      const { cart, meta } = toInvoiceEdit(await fetchInvoiceForEdit(data.id), branchId);
      const now = invoiceActions(meta, invoicePerms, false);
      if (!now.process) {
        toast.error(
          meta.status === 2
            ? 'Hóa đơn đã bị hủy, không sửa được nữa.'
            : `Hóa đơn đang ở trạng thái ${statusOf('invoice', meta.status).label}, bạn không có quyền sửa.`,
        );
        void qc.invalidateQueries({ queryKey: ['doc'] });
        return;
      }
      if (!(await confirmReplaceEdit())) return;
      startOrderEdit(cart, meta);
      router.push({ pathname: routes.edit, params: { id: String(data.id), kind: KIND_SLUG.invoice } } as never);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const actions: OrderDetailViewProps['actions'] = orderAllowed
    ? {
        canProcess: orderAllowed.process,
        onProcess: () => {
          if (branchId && data.branchId && data.branchId !== branchId) {
            Alert.alert('Đơn của chi nhánh khác', `Vui lòng đổi sang ${data.branchName ?? 'chi nhánh của đơn'} để xử lý đơn này.`);
            return;
          }
          void processOrder();
        },
        canChangeStatus: orderAllowed.changeStatus,
        canComplete: orderAllowed.complete,
        canCancel: orderAllowed.cancel,
        busy,
        onChangeStatus: () =>
          pickStatus(
            'Đổi trạng thái đơn',
            ORDER_STEPS,
            (k) => ORDER_STATUS[k].label,
            (k) => ORDER_STATUS[k].code === data.status,
            (next) => void run(() => updateOrderStatus(data.id, next), `Đã chuyển sang ${ORDER_STATUS[next].label}`),
          ),
        onComplete: () =>
          Alert.alert('Kết thúc đơn hàng', `Chuyển đơn ${data.code} sang Hoàn thành?`, [
            { text: 'Hủy bỏ', style: 'cancel' },
            {
              text: 'Xác nhận',
              onPress: () => void run(() => updateOrderStatus(data.id, 'completed'), 'Đã chuyển đơn sang Hoàn thành'),
            },
          ]),
        onCancel: () => {
          if (orderAllowed.cancelBlocked) {
            Alert.alert('Chưa hủy được', 'Đơn hàng có hóa đơn. Vui lòng hủy tất cả hóa đơn trước khi hủy đơn hàng.');
            return;
          }
          confirmCancel(
            'đơn',
            data.code,
            paymentCount,
            (withPayments) => void run(() => cancelOrder(data.id, withPayments), cancelDone(withPayments)),
          );
        },
      }
    : invoiceAllowed
      ? {
          canProcess: invoiceAllowed.process,
          onProcess: () => {
            if (branchId && data.branchId && data.branchId !== branchId) {
              Alert.alert('Hóa đơn của chi nhánh khác', `Vui lòng đổi sang ${data.branchName ?? 'chi nhánh của hóa đơn'} để xử lý hóa đơn này.`);
              return;
            }
            void processInvoice();
          },
          canChangeStatus: invoiceAllowed.changeStatus,
          canComplete: invoiceAllowed.complete,
          canCancel: invoiceAllowed.cancel,
          busy,
          onChangeStatus: () =>
            pickStatus(
              'Đổi trạng thái hóa đơn',
              INVOICE_STEPS,
              (k) => INVOICE_STATUS[k].label,
              (k) => k === data.status,
              (next) => {
                const change = () => void run(() => updateInvoiceStatus(data.id, next), `Đã chuyển sang ${INVOICE_STATUS[next].label}`);
                // Hoàn thành là trạng thái cuối: hỏi lại trước.
                if (next === 1) {
                  Alert.alert('Kết thúc hóa đơn', `Chuyển hóa đơn ${data.code} sang Hoàn thành? Sau đó không đổi trạng thái được nữa.`, [
                    { text: 'Hủy bỏ', style: 'cancel' },
                    { text: 'Xác nhận', onPress: change },
                  ]);
                  return;
                }
                change();
              },
            ),
          onComplete: () =>
            Alert.alert('Kết thúc hóa đơn', `Chuyển hóa đơn ${data.code} sang Hoàn thành? Sau đó không đổi trạng thái được nữa.`, [
              { text: 'Hủy bỏ', style: 'cancel' },
              {
                text: 'Xác nhận',
                onPress: () => void run(() => updateInvoiceStatus(data.id, 1), 'Đã chuyển hóa đơn sang Hoàn thành'),
              },
            ]),
          onCancel: () =>
            confirmCancel(
              'hóa đơn',
              data.code,
              paymentCount,
              (withPayments) => void run(() => cancelInvoice(data.id, withPayments), cancelDone(withPayments)),
            ),
        }
      : undefined;

  return (
    <OrderDetailView
      doc={data}
      canPrint={canPrint}
      onPrint={() => router.push({ pathname: routes.print, params: { kind, id: String(data.id), code: data.code } } as never)}
      onOpenOrder={(orderId) => open('order', orderId)}
      onOpenInvoice={(invoiceId) => open('invoice', invoiceId)}
      actions={actions}
    />
  );
}

const styles = StyleSheet.create({
  head: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 30 },
  strike: { textDecorationLine: 'line-through', color: C.muted },
  customer: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  delivery: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  sum: { paddingHorizontal: 16, paddingVertical: 8 },
  payment: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 14 },
  // Cùng kích thước với Pill, thêm mũi tên để biết bấm được.
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  statusBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
});
