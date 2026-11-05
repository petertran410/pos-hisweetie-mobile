import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dateVN, money, parseMoney } from '@/core/format';
import { errorMessage } from '@/core/http';
import { useSession } from '@/core/session';
import {
  Button,
  C,
  ChipGroup,
  Divider,
  EmptyState,
  ErrorState,
  fonts,
  LoadingState,
  MoneyField,
  PressableScale,
  radius,
  Select,
  SheetHeader,
  toast,
  toneColors,
  Txt,
} from '@/ui';
import { refreshAfterDocChange } from '../orders/api';
import { FormCard, Note, SwitchRow, TextRow } from '../products/formParts';
import { bankOptions, useBankAccounts, type BankAccount } from '../sales/api';
import { createCustomerPayment, useCustomerDetail, useUnpaidInvoices } from './api';
import {
  allocatePayment,
  availableCredit,
  customerPerms,
  defaultOffsets,
  payableOf,
  setInvoiceOffset,
  setInvoicePay,
  sumAmounts,
  toAllocItems,
  toCustomerDetail,
  type InvoiceAmounts,
  type UnpaidInvoice,
} from './model';

type Method = 'cash' | 'transfer';
const METHODS: { value: Method; label: string }[] = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'transfer', label: 'Chuyển khoản' },
];

/** Số hóa đơn hiện mỗi lần (bấm "Xem thêm" để hiện tiếp). */
const INVOICE_STEP = 10;

export interface PaymentViewProps {
  name: string;
  debt: number;
  hasChildren: boolean;
  amount: number;
  onAmount: (n: number) => void;
  method: Method;
  onMethod: (m: Method) => void;
  accounts: BankAccount[];
  accountId: number | null;
  onAccount: (id: number | null) => void;
  note: string;
  onNote: (t: string) => void;
  invoices: UnpaidInvoice[];
  invoicesLoading?: boolean;
  /** Gắn tiền thu vào hóa đơn (tắt: chỉ trừ vào công nợ khách). */
  allocate: boolean;
  onAllocate: (v: boolean) => void;
  /** Tiền thu từng hóa đơn. */
  payments: InvoiceAmounts;
  onPay: (invoiceId: number, n: number) => void;
  /** Bỏ hết tiền thu vào hóa đơn để tự chọn từng hóa đơn. */
  onClearPayments: () => void;
  /** Khoản có thể cấn trừ; > 0 thì mỗi hóa đơn có thêm ô "Cấn trừ". */
  credit: number;
  offsets: InvoiceAmounts;
  onOffset: (invoiceId: number, n: number) => void;
  onSubmit: () => void;
  busy?: boolean;
  onCancel?: () => void;
}

/** Ô nhập tiền nhỏ trong dòng hóa đơn (nhãn trái, số phải). */
function AmountInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.amountBox, focused ? styles.amountFocused : null]}>
      <Txt variant="caption" color={C.muted} numberOfLines={1} style={{ flexShrink: 0 }}>
        {label}
      </Txt>
      <TextInput
        value={value ? money(value) : ''}
        onChangeText={(t) => onChange(parseMoney(t))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={C.faint}
        selectTextOnFocus
        accessibilityLabel={label}
        style={styles.amountInput}
      />
      <Txt variant="caption" color={C.muted}>
        ₫
      </Txt>
    </View>
  );
}

function SmallLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} hitSlop={8} scaleTo={0.95} accessibilityRole="button">
      <Txt variant="label" weight="semibold" color={C.brand}>
        {label}
      </Txt>
    </PressableScale>
  );
}

function InvoiceRow({
  inv,
  pay,
  offset,
  credit,
  hasChildren,
  onPay,
  onOffset,
}: {
  inv: UnpaidInvoice;
  pay: number;
  offset: number;
  credit: number;
  hasChildren: boolean;
  onPay: (n: number) => void;
  onOffset: (n: number) => void;
}) {
  const max = payableOf(inv, { [inv.id]: offset });
  const full = max > 0 && pay >= max;
  const paidBefore = Math.max(0, inv.total - inv.debt);
  return (
    <View style={styles.inv}>
      <View style={styles.invHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="label" weight="semibold" numeric>
            {inv.code}
          </Txt>
          <Txt variant="caption" color={C.muted} numeric numberOfLines={2}>
            {[dateVN(inv.date), inv.total ? `tổng ${money(inv.total)}` : null, paidBefore ? `đã thu ${money(paidBefore)}` : null, hasChildren ? inv.customerName : null]
              .filter(Boolean)
              .join(' · ')}
          </Txt>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt variant="caption" color={C.muted}>
            Còn nợ
          </Txt>
          <Txt variant="body" weight="bold" numeric color={toneColors.danger.fg}>
            {money(inv.debt)}
          </Txt>
        </View>
      </View>
      {credit > 0 ? <AmountInput label="Cấn trừ" value={offset} onChange={onOffset} /> : null}
      <View style={styles.payRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AmountInput label="Tiền thu" value={pay} onChange={onPay} />
        </View>
        <Button
          title={full ? 'Bỏ' : 'Trả đủ'}
          variant="outline"
          size="small"
          onPress={() => onPay(full ? 0 : max)}
          disabled={max <= 0}
          style={{ width: 84 }}
        />
      </View>
    </View>
  );
}

/** Thu nợ khách: chọn tiền trả vào từng hóa đơn và cấn trừ nợ (giống web). */
export function PaymentView(p: PaymentViewProps) {
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState(INVOICE_STEP);
  const allocated = p.allocate ? sumAmounts(p.payments) : 0;
  const offsetTotal = p.allocate ? sumAmounts(p.offsets) : 0;
  const extra = Math.max(0, p.amount - allocated);
  const remaining = p.invoices.reduce((s, i) => s + i.debt, 0);
  const list = p.invoices.slice(0, shown);
  const canSubmit = p.amount > 0 || offsetTotal > 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Thu nợ" onCancel={p.onCancel} />
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.body, { paddingBottom: 24 }]}>
        <View style={styles.head}>
          <Txt variant="heading" numberOfLines={2}>
            {p.name}
          </Txt>
          <Txt variant="label" color={C.muted}>
            {p.hasChildren ? 'Nợ hiện tại (gồm khách con)' : 'Nợ hiện tại'}
          </Txt>
          <Txt variant="display" numeric color={p.debt > 0 ? toneColors.danger.fg : C.text}>
            {money(p.debt)} ₫
          </Txt>
        </View>

        <View style={{ gap: 10 }}>
          <MoneyField label="Số tiền thu" value={p.amount} onChange={p.onAmount} />
          {p.debt > 0 && p.amount !== Math.round(p.debt) ? (
            <Button
              title={`Thu hết ${money(p.debt)} ₫`}
              variant="outline"
              size="small"
              onPress={() => p.onAmount(Math.round(p.debt))}
              style={{ alignSelf: 'flex-start' }}
            />
          ) : null}
        </View>

        <View style={{ gap: 10 }}>
          <Txt variant="label" weight="semibold">
            Hình thức
          </Txt>
          <ChipGroup fill options={METHODS} value={p.method} onChange={p.onMethod} />
          {p.method === 'transfer' ? (
            p.accounts.length ? (
              <Select
                variant="field"
                label="Tài khoản nhận"
                placeholder="Chọn tài khoản ngân hàng"
                options={bankOptions(p.accounts)}
                value={p.accountId}
                onChange={p.onAccount}
              />
            ) : (
              <Note tone="warning" text="Chưa có tài khoản ngân hàng nhận tiền. Thêm tài khoản trên web hoặc thu tiền mặt." />
            )
          ) : null}
        </View>

        <FormCard>
          <TextRow label="Ghi chú" value={p.note} onChange={p.onNote} placeholder="Thu tiền khách hàng" maxLength={1000} />
        </FormCard>

        <View style={{ gap: 8 }}>
          <FormCard>
            <SwitchRow
              label="Phân bổ vào hóa đơn"
              sub={p.allocate ? 'Đổi số tiền thu sẽ chia lại từ hóa đơn cũ nhất.' : 'Tiền thu chỉ trừ vào công nợ khách, hóa đơn vẫn để nợ.'}
              value={p.allocate}
              onChange={p.onAllocate}
            />
          </FormCard>
          {p.allocate && p.credit > 0 && !p.invoicesLoading ? (
            <Note
              text={`Có thể cấn trừ tối đa ${money(p.credit)} ₫ vào hóa đơn (phần khách đã được giảm nợ nhưng chưa trừ vào hóa đơn nào, vd do trả hàng). Đang cấn trừ ${money(offsetTotal)} ₫.`}
            />
          ) : null}
        </View>

        {p.allocate ? (
          <View style={{ gap: 8 }}>
            <View style={styles.listHead}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="heading">Hóa đơn còn nợ</Txt>
                {p.invoices.length ? (
                  <Txt variant="caption" color={C.muted} numeric>
                    {`${p.invoices.length} hóa đơn · còn cần thu ${money(remaining)} ₫`}
                  </Txt>
                ) : null}
              </View>
              {allocated > 0 ? <SmallLink label="Bỏ hết" onPress={p.onClearPayments} /> : null}
            </View>
            <View style={styles.card}>
              {p.invoicesLoading ? (
                <LoadingState />
              ) : p.invoices.length === 0 ? (
                <Txt variant="body" color={C.faint} style={{ paddingVertical: 14 }}>
                  Khách không còn hóa đơn nợ.
                </Txt>
              ) : (
                list.map((inv, i) => (
                  <View key={inv.id}>
                    {i ? <Divider /> : null}
                    <InvoiceRow
                      inv={inv}
                      pay={p.payments[inv.id] ?? 0}
                      offset={p.offsets[inv.id] ?? 0}
                      credit={p.credit}
                      hasChildren={p.hasChildren}
                      onPay={(n) => p.onPay(inv.id, n)}
                      onOffset={(n) => p.onOffset(inv.id, n)}
                    />
                  </View>
                ))
              )}
              {p.invoices.length > shown && !p.invoicesLoading ? (
                <>
                  <Divider />
                  <View style={styles.more}>
                    <SmallLink
                      label={`Xem thêm ${Math.min(INVOICE_STEP, p.invoices.length - shown)} hóa đơn (${shown}/${p.invoices.length})`}
                      onPress={() => setShown((n) => n + INVOICE_STEP)}
                    />
                  </View>
                </>
              ) : null}
            </View>
          </View>
        ) : null}

        {p.allocate && extra > 0 && !p.invoicesLoading ? (
          <Note tone="warning" text={`Còn ${money(extra)} ₫ không gắn hóa đơn nào, chỉ trừ vào công nợ của khách.`} />
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          title={p.amount > 0 ? `Thu ${money(p.amount)} ₫` : offsetTotal > 0 ? `Cấn trừ ${money(offsetTotal)} ₫` : 'Nhập số tiền thu'}
          icon="banknote"
          onPress={p.onSubmit}
          disabled={!canSubmit}
          loading={p.busy}
        />
      </View>
    </View>
  );
}

export default function PaymentScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const user = useSession((s) => s.user);
  const branchId = useSession((s) => s.branchId);
  const perms = customerPerms(user);
  const qc = useQueryClient();
  const detail = useCustomerDetail(id);
  const d = detail.data ? toCustomerDetail(detail.data) : null;
  const ids = d ? [d.id, ...d.children.map((c) => c.id)] : [];
  // Thu nợ hiện số nợ: cần cả quyền thu tiền và xem công nợ (mở thẳng bằng link cũng vậy).
  const allowed = perms.collect && perms.viewDebt;
  const unpaid = useUnpaidInvoices(ids, !!d && allowed);
  const accounts = useBankAccounts(allowed);
  const debt = d ? d.totalDebt + d.childrenDebt : 0;
  // Tiền thu để trống cho người dùng tự nhập (có nút "Thu hết").
  const [amount, setAmount] = useState(0);
  // null = chưa sửa: chia tự động, cấn trừ mặc định.
  const [manual, setManual] = useState<InvoiceAmounts | null>(null);
  const [offsetIn, setOffsetIn] = useState<InvoiceAmounts | null>(null);
  const [allocate, setAllocate] = useState(true);
  const [method, setMethod] = useState<Method>('cash');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  if (!allowed) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SheetHeader title="Thu nợ" />
        <EmptyState
          icon="lock"
          color="slate"
          title="Chưa có quyền thu nợ"
          message="Cần quyền “Tạo phiếu thu chi” và “Xem công nợ khách hàng”. Nhờ quản trị viên cấp quyền."
        />
      </View>
    );
  }
  if (!d) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SheetHeader title="Thu nợ" />
        {detail.isError ? <ErrorState error={detail.error} onRetry={() => void detail.refetch()} /> : <LoadingState />}
      </View>
    );
  }

  const invoices = unpaid.data ?? [];
  const credit = availableCredit(invoices, debt);
  // Cấn trừ mặc định (giống web) chỉ áp khi đã nhập tiền thu, để mở màn ra không có sẵn thao tác cấn trừ.
  const offsets = credit > 0 ? (offsetIn ?? (amount > 0 ? defaultOffsets(invoices, credit) : {})) : {};
  const payments = allocate ? (manual ?? allocatePayment(amount, invoices, offsets)) : {};

  const changeAmount = (n: number) => {
    setAmount(n);
    setManual(null);
  };
  // Sửa từng hóa đơn: số tiền thu đổi theo, phần không gắn hóa đơn giữ nguyên.
  const changePay = (invoiceId: number, n: number) => {
    const next = setInvoicePay(invoices, payments, offsets, invoiceId, n);
    setManual(next);
    setAmount(Math.max(0, amount + sumAmounts(next) - sumAmounts(payments)));
  };
  const clearPayments = () => {
    setManual({});
    setAmount(Math.max(0, amount - sumAmounts(payments)));
  };
  const changeOffset = (invoiceId: number, n: number) => {
    const next = setInvoiceOffset(invoices, offsets, credit, invoiceId, n);
    setOffsetIn(next);
    if (manual) {
      // Tiền thu của hóa đơn này không được vượt phần còn nợ sau cấn trừ.
      const capped = setInvoicePay(invoices, manual, next, invoiceId, manual[invoiceId] ?? 0);
      setManual(capped);
      setAmount(Math.max(0, amount + sumAmounts(capped) - sumAmounts(manual)));
    }
  };

  const submit = () => {
    const payItems = allocate ? toAllocItems(payments, invoices) : [];
    const offsetItems = allocate ? toAllocItems(offsets, invoices) : [];
    const offsetTotal = offsetItems.reduce((s, x) => s + x.amount, 0);
    const total = Math.max(amount, payItems.reduce((s, x) => s + x.amount, 0));
    if (busyRef.current || (total <= 0 && offsetTotal <= 0)) return;
    if (!branchId) {
      Alert.alert('Chưa chọn chi nhánh', 'Chọn chi nhánh ở tab Thêm rồi thử lại.');
      return;
    }
    if (total > 0 && method === 'transfer' && !accountId) {
      Alert.alert('Chưa chọn tài khoản', 'Chọn tài khoản ngân hàng nhận tiền.');
      return;
    }
    const parts = [
      total > 0 ? (method === 'cash' ? 'tiền mặt' : 'chuyển khoản') : null,
      payItems.length ? `trả vào ${payItems.length} hóa đơn` : null,
      offsetTotal > 0 ? `cấn trừ ${money(offsetTotal)} ₫ vào ${offsetItems.length} hóa đơn` : null,
    ].filter(Boolean);
    Alert.alert(
      total > 0 ? `Thu ${money(total)} ₫?` : `Cấn trừ ${money(offsetTotal)} ₫?`,
      `${total > 0 ? 'Từ' : 'Cho'} ${d.name}${parts.length ? `, ${parts.join(', ')}` : ''}.${total > 0 ? '' : ' Không tạo phiếu thu.'}`,
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        {
          text: total > 0 ? 'Thu tiền' : 'Cấn trừ',
          onPress: () => {
            busyRef.current = true;
            setBusy(true);
            createCustomerPayment({
              customerId: d.id,
              totalAmount: total,
              branchId,
              method,
              accountId: method === 'transfer' && total > 0 ? (accountId ?? undefined) : undefined,
              transDate: new Date().toISOString(),
              description: note.trim() || undefined,
              allocateToInvoices: allocate,
              invoices: payItems.length ? payItems : undefined,
              debtOffsets: offsetItems.length ? offsetItems : undefined,
            })
              .then(async (res) => {
                toast.success(
                  res?.cashFlow?.code ? `Đã thu tiền (${res.cashFlow.code})` : total > 0 ? 'Đã thu tiền' : 'Đã cấn trừ công nợ',
                );
                await refreshAfterDocChange(qc, [['customer-unpaid'], ['cashflows']]);
                router.back();
              })
              .catch((e: unknown) => toast.error(errorMessage(e)))
              .finally(() => {
                busyRef.current = false;
                setBusy(false);
              });
          },
        },
      ],
    );
  };

  return (
    <PaymentView
      name={d.name}
      debt={debt}
      hasChildren={d.children.length > 0}
      amount={amount}
      onAmount={changeAmount}
      method={method}
      onMethod={setMethod}
      accounts={accounts.data ?? []}
      accountId={accountId}
      onAccount={setAccountId}
      note={note}
      onNote={setNote}
      invoices={invoices}
      invoicesLoading={unpaid.isLoading}
      allocate={allocate}
      onAllocate={(v) => {
        setAllocate(v);
        setManual(null);
      }}
      payments={payments}
      onPay={changePay}
      onClearPayments={clearPayments}
      credit={credit}
      offsets={offsets}
      onOffset={changeOffset}
      onSubmit={submit}
      busy={busy}
    />
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 18 },
  head: { gap: 4, padding: 16, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  listHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 6 },
  card: {
    backgroundColor: C.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    paddingHorizontal: 14,
  },
  inv: { gap: 8, paddingVertical: 12 },
  invHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: '#D5DEE6',
    backgroundColor: C.card,
  },
  amountFocused: { borderColor: C.brand, borderWidth: 1.6 },
  amountInput: { flex: 1, minWidth: 0, textAlign: 'right', fontSize: 16, fontFamily: fonts.semibold, color: C.text, paddingVertical: 10 },
  more: { paddingVertical: 14, alignItems: 'center' },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
});
