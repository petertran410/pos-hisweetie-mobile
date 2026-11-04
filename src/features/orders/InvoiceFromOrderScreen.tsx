import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { money, qty, vnd } from '@/core/format';
import { ApiError, errorMessage } from '@/core/http';
import { useSession } from '@/core/session';
import { addPaymentNote } from '@/features/sales/api';
import { SumRow } from '@/features/sales/components';
import { useSalePerms } from '@/features/sales/perms';
import {
  Avatar,
  Banner,
  Button,
  C,
  Card,
  ChipGroup,
  Divider,
  EmptyState,
  ErrorState,
  LoadingState,
  MoneyField,
  Page,
  Pill,
  PressableScale,
  QtyStepper,
  Section,
  SubHeader,
  TabPanel,
  toast,
  Txt,
} from '@/ui';
import { createInvoiceFromOrder, refreshAfterDocChange, useInvoiceDraft } from './api';
import { useDocRoutes } from './editScope';
import {
  buildFromOrderPayload,
  defaultQuantities,
  draftTotals,
  hasShortfall,
  paymentNoteFor,
  validateDraft,
  type DraftForm,
  type DraftLine,
  type InvoiceDraft,
  type PayKind,
} from './fromOrder';
import { KIND_SLUG } from './model';

const PAY_ORDER: PayKind[] = ['transfer', 'cash'];

function DraftLineRow({ line, value, onChange }: { line: DraftLine; value: number; onChange: (n: number) => void }) {
  const net = line.price - line.discount;
  const badges = [
    line.gift ? 'Quà tặng' : null,
    line.condition === 'damaged' ? 'Bục rách' : null,
    line.condition === 'near_expiry' ? 'Cận date' : null,
  ].filter(Boolean) as string[];
  const partial = line.remaining < line.ordered;
  return (
    <View style={[styles.line, value === 0 ? { opacity: 0.5 } : null]}>
      <View style={{ flex: 1, gap: 3 }}>
        <Txt variant="body" weight="semibold" numberOfLines={2}>
          {line.name}
        </Txt>
        <Txt variant="caption" color={C.muted} numeric>
          {line.code ? `${line.code} · ` : ''}
          {money(net)}
          {line.unit ? ` / ${line.unit}` : ''}
        </Txt>
        <Txt variant="caption" color={partial ? C.brand : C.muted} numeric>
          {partial ? `Còn xuất ${qty(line.remaining)}/${qty(line.ordered)}` : `Đơn đặt ${qty(line.ordered)}`}
        </Txt>
        {badges.length ? (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
            {badges.map((b) => (
              <Pill key={b} label={b} tone={b === 'Quà tặng' ? 'success' : 'warning'} />
            ))}
          </View>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <Txt variant="body" weight="bold" numeric>
          {money(net * value)}
        </Txt>
        <QtyStepper value={value} onChange={onChange} min={0} max={line.remaining} size="small" label={line.name} />
      </View>
    </View>
  );
}

export interface InvoiceFromOrderViewProps {
  draft: InvoiceDraft;
  perms: { viewPayment: boolean; editPayment: boolean };
  submitting?: boolean;
  onSubmit: (form: DraftForm) => void;
}

/** Tạo hóa đơn từ đơn đặt hàng: chọn số lượng xuất và cách khách trả. */
export function InvoiceFromOrderView({ draft, perms, submitting, onSubmit }: InvoiceFromOrderViewProps) {
  const [qtys, setQtys] = useState(() => defaultQuantities(draft));
  const [payKind, setPayKind] = useState<PayKind | null>(draft.payKind);
  const [paidNow, setPaidNow] = useState(0);
  // Tiền mặt cần thu tự theo số còn phải thu, đến khi người dùng tự sửa.
  const [cashEdited, setCashEdited] = useState<number | null>(null);

  const paid = perms.viewPayment ? paidNow : 0;
  const t = draftTotals(draft, qtys, paid);
  const cashAmount = cashEdited ?? Math.max(0, t.left);
  const due = Math.max(0, t.total - draft.paidOnOrder);
  const shortfall = hasShortfall(draft, qtys);

  if (draft.lines.length === 0) {
    return (
      <Page stickyHeader scroll={false} header={<SubHeader title="Tạo hóa đơn" />}>
        <EmptyState
          icon="circle-check"
          color="teal"
          title="Đã xuất hóa đơn đủ"
          message={`Tất cả hàng của đơn ${draft.orderCode} đã được xuất hóa đơn.`}
        />
      </Page>
    );
  }

  const footer = (
    <View style={styles.footer}>
      <View style={{ flex: 1 }}>
        <Txt variant="caption" color={C.muted}>
          Khách cần trả
        </Txt>
        <Txt variant="title" numeric numberOfLines={1} adjustsFontSizeToFit>
          {money(t.total)} ₫
        </Txt>
      </View>
      <Button
        title="Tạo hóa đơn"
        icon="check"
        loading={submitting}
        disabled={submitting}
        style={{ flex: 1.2 }}
        onPress={() => onSubmit({ qty: qtys, payKind, cashAmount, paidNow: paid })}
      />
    </View>
  );

  return (
    <Page
      stickyHeader
      header={<SubHeader title="Tạo hóa đơn" />}
      footer={footer}
      automaticallyAdjustKeyboardInsets
      contentStyle={{ paddingBottom: 32 }}>
      <Section index={0}>
        <Card style={styles.customer}>
          <Avatar name={draft.customerName} size={44} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="body" weight="semibold" numberOfLines={1}>
              {draft.customerName}
            </Txt>
            <Txt variant="caption" color={C.muted} numberOfLines={1}>
              {[draft.customerCode, `Từ đơn ${draft.orderCode}`].filter(Boolean).join(' · ')}
            </Txt>
          </View>
        </Card>
      </Section>

      <Section index={1} title={`Hàng xuất · ${money(t.itemCount)} món`}>
        <Card>
          {draft.lines.map((l, i) => (
            <View key={l.key}>
              {i > 0 ? <Divider inset={14} /> : null}
              <DraftLineRow line={l} value={qtys[l.key] ?? 0} onChange={(n) => setQtys((q) => ({ ...q, [l.key]: n }))} />
            </View>
          ))}
        </Card>
        {shortfall ? (
          <Banner
            tone="info"
            title="Xuất 1 phần đơn hàng"
            message="Phần còn lại vẫn nằm trên đơn. Khi tạo, app sẽ hỏi kết thúc đơn hay giữ để xuất tiếp."
          />
        ) : null}
      </Section>

      <Section index={2} title="Thanh toán">
        <Card style={styles.sum}>
          <SumRow label="Tổng tiền hàng" value={money(t.subtotal)} />
          <SumRow
            label="Giảm giá"
            hint={draft.discountRatio > 0 ? `${qty(draft.discountRatio)}% theo đơn` : t.discount ? 'Phần giảm giá còn lại của đơn' : undefined}
            value={t.discount ? `-${money(t.discount)}` : '0'}
          />
          <SumRow label="Phí giao hàng" value={money(t.shipping)} />
          <Divider />
          <SumRow label="Khách cần trả" value={`${money(t.total)} ₫`} strong />
          {draft.paidOnOrder > 0 ? <SumRow label="Đã cọc / đã trả trên đơn" value={money(draft.paidOnOrder)} tone="success" /> : null}
        </Card>

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
            value={payKind}
            onChange={setPayKind}
          />
          {payKind ? (
            <TabPanel value={payKind} order={PAY_ORDER} style={{ gap: 12 }}>
              {payKind === 'cash' ? (
                <MoneyField label="Tiền mặt cần thu" value={cashAmount} onChange={setCashEdited} />
              ) : null}
              {perms.viewPayment ? (
                <View style={{ gap: 8 }}>
                  <MoneyField label="Khách trả thêm" value={paidNow} onChange={setPaidNow} editable={perms.editPayment} />
                  {perms.editPayment && due > 0 ? (
                    <View style={styles.quick}>
                      <PressableScale onPress={() => setPaidNow(0)} scaleTo={0.94} style={styles.quickBtn}>
                        <Txt variant="label" weight="semibold" color={C.brand}>
                          Chưa trả
                        </Txt>
                      </PressableScale>
                      <PressableScale onPress={() => setPaidNow(due)} scaleTo={0.94} style={styles.quickBtn}>
                        <Txt variant="label" weight="semibold" color={C.brand}>
                          Trả đủ {money(due)}
                        </Txt>
                      </PressableScale>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </TabPanel>
          ) : (
            <Txt variant="caption" color={C.muted}>
              Chọn khách trả bằng chuyển khoản hay tiền mặt.
            </Txt>
          )}
          {draft.paidOnOrder > 0 || paid > 0 ? (
            <>
              <Divider />
              <SumRow
                label={t.left > 0 ? 'Còn nợ' : t.left < 0 ? 'Tiền thừa' : 'Đã trả đủ'}
                value={t.left === 0 ? '✓' : vnd(Math.abs(t.left))}
                tone={t.left > 0 ? 'danger' : 'success'}
              />
            </>
          ) : null}
        </Card>
      </Section>
    </Page>
  );
}

/** Hỏi khi xuất thiếu: kết thúc đơn hay giữ "Ra 1 phần HĐ" (giống web). */
function askShortfall(): Promise<boolean | null> {
  return new Promise((resolve) => {
    Alert.alert(
      'Đơn hàng chưa xuất đủ số lượng',
      'Có món xuất thiếu so với số lượng đặt. Kết thúc đơn hàng luôn, hay giữ trạng thái "Ra 1 phần HĐ" để xuất tiếp sau?',
      [
        { text: 'Kết thúc đơn hàng', onPress: () => resolve(true) },
        { text: 'Giữ Ra 1 phần HĐ', onPress: () => resolve(false) },
        { text: 'Hủy', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

export default function InvoiceFromOrderScreen() {
  const params = useLocalSearchParams<{ orderId: string }>();
  const orderId = Number(params.orderId);
  const perms = useSalePerms();
  const branchId = useSession((s) => s.branchId);
  const qc = useQueryClient();
  const draft = useInvoiceDraft(orderId);
  const routes = useDocRoutes();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  if (draft.isLoading || !draft.data) {
    return (
      <Page stickyHeader scroll={false} header={<SubHeader title="Tạo hóa đơn" />}>
        {draft.isError ? <ErrorState error={draft.error} onRetry={() => void draft.refetch()} /> : <LoadingState />}
      </Page>
    );
  }
  const d = draft.data;

  const submit = async (form: DraftForm) => {
    if (busyRef.current) return;
    const problem = validateDraft(d, form);
    if (problem) return toast.error(problem);
    // Giống web: chỉ xử lý đơn của chi nhánh đang chọn.
    if (branchId && d.branchId && d.branchId !== branchId) {
      return toast.error('Đơn này thuộc chi nhánh khác. Vui lòng đổi chi nhánh rồi tạo hóa đơn.');
    }
    let forceComplete = false;
    if (hasShortfall(d, form.qty)) {
      const choice = await askShortfall();
      if (choice === null) return;
      forceComplete = choice;
    }

    busyRef.current = true;
    setBusy(true);
    let invoice: { id: number; code: string };
    try {
      invoice = await createInvoiceFromOrder(d.orderId, buildFromOrderPayload(d, form, forceComplete));
    } catch (e) {
      busyRef.current = false;
      setBusy(false);
      // Không có chống tạo trùng ở máy chủ: mất mạng giữa chừng thì không tự gửi lại.
      if (e instanceof ApiError && e.status === 0) {
        Alert.alert(
          'Chưa rõ hóa đơn đã tạo chưa',
          'Mất kết nối khi đang gửi. Hãy mở lại đơn hàng để xem hóa đơn đã có chưa trước khi tạo lại, để tránh tạo trùng.',
        );
      } else {
        toast.error(errorMessage(e));
      }
      return;
    }

    let noteFailed = false;
    try {
      await addPaymentNote('invoices', invoice.id, paymentNoteFor(form));
    } catch {
      noteFailed = true;
    }
    toast.success(`Đã tạo hóa đơn ${invoice.code}`);
    if (noteFailed) toast.error('Chưa ghi được hình thức thanh toán, hãy ghi lại trên web.');
    await refreshAfterDocChange(qc);
    busyRef.current = false;
    setBusy(false);
    // Thay màn tạo bằng chi tiết hóa đơn vừa tạo; quay lại là về đơn hàng.
    router.replace({ pathname: routes.detail, params: { kind: KIND_SLUG.invoice, id: String(invoice.id) } } as never);
  };

  return (
    <InvoiceFromOrderView
      draft={d}
      perms={{ viewPayment: perms.viewPayment, editPayment: perms.editPayment }}
      submitting={busy}
      onSubmit={(f) => void submit(f)}
    />
  );
}

const styles = StyleSheet.create({
  customer: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
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
