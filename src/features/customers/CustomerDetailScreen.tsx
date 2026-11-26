import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { dateVN, money } from '@/core/format';
import { errorMessage } from '@/core/http';
import { useSession } from '@/core/session';
import {
  Avatar,
  Button,
  C,
  Card,
  ChipGroup,
  Divider,
  EmptyState,
  ErrorState,
  fonts,
  Icon,
  IconButton,
  LoadingState,
  Page,
  pickFromSheet,
  Pill,
  PressableScale,
  Section,
  SubHeader,
  TabPanel,
  toast,
  toneColors,
  Txt,
} from '@/ui';
import type { DocRow } from '../orders/api';
import { useDocRoutes } from '../orders/editScope';
import { KIND_SLUG, type DocKind } from '../orders/model';
import { KV } from '../products/components';
import {
  saveCustomerNote,
  setCustomerActive,
  updateCustomer,
  useCustomerDetail,
  useCustomerDocs,
  useCustomerReturns,
  useDebtTimeline,
} from './api';
import { DebtRow, HistoryCard, ReturnCard } from './components';
import { startAddressDraft, startCustomerDraft } from './draft';
import { emptyAddress, removeAddress, setDefaultAddress, toAddressForm, toAddressPayload, toCustomerForm, type AddressForm } from './form';
import { customerDetailPaths, useCustomerFormBase, useCustomerFormPaths } from './formPaths';
import {
  addressLine,
  addressTitle,
  customerPerms,
  mergeHistory,
  oldAddressLine,
  toCustomerDetail,
  type CustomerDetail,
  type CustomerPerms,
  type DebtEntry,
  type RawAddress,
  type ReturnRow,
} from './model';

export type CustomerTab = 'info' | 'address' | 'invoice' | 'order' | 'debt' | 'children';
const TAB_ORDER: CustomerTab[] = ['info', 'address', 'invoice', 'order', 'debt', 'children'];

/** Công nợ hiện mỗi lần 30 dòng (backend trả hết 1 lần). */
const DEBT_STEP = 30;

export interface DocList {
  rows: DocRow[];
  total?: number;
  loading: boolean;
  error?: unknown;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onRetry: () => void;
}

/** Phiếu trả hàng của khách (gộp vào tab Hóa đơn). */
export interface ReturnList extends Omit<DocList, 'rows'> {
  rows: ReturnRow[];
}

/** Ô số liệu (lưới 2 cột ở đầu trang). */
function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.stat}>
      <Txt variant="caption" color={C.muted} numberOfLines={1}>
        {label}
      </Txt>
      <Txt variant="heading" weight="bold" numeric numberOfLines={1} color={danger ? toneColors.danger.fg : C.text}>
        {value}
      </Txt>
    </View>
  );
}

function InfoTab({
  d,
  showDebt,
  onSaveNote,
  savingNote,
}: {
  d: CustomerDetail;
  /** Có quyền xem công nợ: hiện chính sách công nợ. */
  showDebt: boolean;
  onSaveNote?: (note: string) => void;
  savingNote?: boolean;
}) {
  const [note, setNote] = useState(d.comments ?? '');
  const changed = note.trim() !== (d.comments ?? '');
  return (
    <View style={{ gap: 12 }}>
      <Card style={styles.block}>
        <KV label="Loại khách" value={d.isCompany ? 'Tổ chức / hộ kinh doanh' : 'Cá nhân'} />
        {d.isCompany && d.organization ? <KV label="Tên công ty" value={d.organization} /> : null}
        <KV label="Điện thoại 1" value={d.phone1 ?? '—'} tone={d.phone1 ? undefined : 'muted'} />
        {d.phone2 ? <KV label="Điện thoại 2" value={d.phone2} /> : null}
        <KV label="Email" value={d.email ?? '—'} tone={d.email ? undefined : 'muted'} />
        <KV label="Nhóm khách" value={d.groups.map((g) => g.name).join(', ') || 'Chưa có'} tone={d.groups.length ? undefined : 'muted'} />
        {showDebt ? (
          <>
            <KV label="Hình thức công nợ" value={d.debtForm ?? 'Chưa chọn'} tone={d.debtForm ? undefined : 'muted'} />
            <KV
              label="Quy tắc công nợ"
              value={[d.debtRule.label, d.debtRule.detail].filter(Boolean).join(' · ')}
              tone={d.debtRule.unset ? 'muted' : undefined}
            />
          </>
        ) : null}
        {d.branchName ? <KV label="Chi nhánh tạo" value={d.branchName} /> : null}
        <KV label="Ngày tạo" value={dateVN(d.createdAt) || '—'} />
        {d.totalInvoiced > 0 ? <KV label="Tổng tiền hóa đơn" value={money(d.totalInvoiced)} /> : null}
      </Card>

      <Card style={styles.text}>
        <Txt variant="label" weight="semibold" color={C.muted}>
          Thông tin xuất hóa đơn
        </Txt>
        {d.invoiceInfo.length ? (
          d.invoiceInfo.map((l) => <KV key={l.label} label={l.label} value={l.value} />)
        ) : (
          <Txt variant="body" color={C.faint}>
            Chưa có
          </Txt>
        )}
      </Card>

      <Card style={styles.text}>
        <Txt variant="label" weight="semibold" color={C.muted}>
          Ghi chú
        </Txt>
        {onSaveNote ? (
          <>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Thêm ghi chú về khách (giờ nhận hàng, lưu ý…)"
              placeholderTextColor={C.faint}
              multiline
              maxLength={1000}
              accessibilityLabel="Ghi chú"
              style={styles.note}
            />
            {changed ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title="Hoàn tác" variant="outline" size="small" onPress={() => setNote(d.comments ?? '')} style={{ flex: 1 }} />
                <Button title="Lưu ghi chú" size="small" loading={savingNote} onPress={() => onSaveNote(note)} style={{ flex: 1 }} />
              </View>
            ) : null}
          </>
        ) : (
          <Txt variant="body" color={d.comments ? C.text : C.faint}>
            {d.comments ?? 'Chưa có ghi chú'}
          </Txt>
        )}
      </Card>
    </View>
  );
}

function AddressCard({ a, index, onPress }: { a: RawAddress; index: number; onPress?: () => void }) {
  const line = addressLine(a);
  const old = oldAddressLine(a);
  const who = [a.receiver, a.contactNumber].map((x) => (x ?? '').trim()).filter(Boolean).join(' · ');
  return (
    <Card onPress={onPress} accessibilityLabel={`${addressTitle(a, index)}${a.isDefault ? ', mặc định' : ''}. ${line}`} style={styles.address}>
      <View style={styles.row}>
        <Icon name="map-pin" size={18} color={a.isDefault ? C.brand : C.muted} />
        <Txt variant="body" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
          {addressTitle(a, index)}
        </Txt>
        {a.isDefault ? <Pill label="Mặc định" tone="brand" /> : null}
        {onPress ? <Icon name="ellipsis" size={18} color={C.faint} /> : null}
      </View>
      {who ? (
        <Txt variant="label" color={C.muted} numberOfLines={1}>
          {who}
        </Txt>
      ) : null}
      <Txt variant="body" color={line ? C.text : C.faint}>
        {line || 'Chưa có địa chỉ chi tiết'}
      </Txt>
      {old ? (
        <Txt variant="caption" color={C.muted}>
          Địa chỉ cũ: {old}
        </Txt>
      ) : null}
    </Card>
  );
}

function DocListView({
  kind,
  data,
  returns,
  showDebt,
  onOpen,
}: {
  kind: DocKind;
  data: DocList;
  /** Có = gộp phiếu trả hàng vào danh sách theo ngày (tab Hóa đơn). */
  returns?: ReturnList;
  showDebt: boolean;
  onOpen?: (id: number) => void;
}) {
  const what = kind === 'invoice' ? 'hóa đơn' : 'đơn đặt hàng';
  if (data.loading || returns?.loading) return <LoadingState />;
  const error = data.error ?? returns?.error;
  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          if (data.error) data.onRetry();
          if (returns?.error) returns.onRetry();
        }}
      />
    );
  }
  const merged = returns
    ? mergeHistory(data, returns)
    : { items: data.rows.map((row) => ({ kind: 'invoice' as const, row })), next: data.hasMore ? ('invoice' as const) : null };
  if (!merged.items.length) {
    const title = returns ? `Chưa có ${what} hoặc phiếu trả hàng` : `Chưa có ${what}`;
    return <EmptyState icon={kind === 'invoice' ? 'receipt-text' : 'clipboard-list'} color="slate" title={title} message={`Khách này chưa có ${returns ? 'giao dịch' : what} nào.`} />;
  }
  const counts = [
    data.total !== undefined ? `${money(data.total)} ${what}` : null,
    returns?.total !== undefined ? `${money(returns.total)} phiếu trả hàng` : null,
  ].filter(Boolean);
  const more = merged.next === 'return' ? returns : merged.next === 'invoice' ? data : null;
  return (
    <View style={{ gap: 8 }}>
      {counts.length ? (
        <Txt variant="label" color={C.muted} numeric>
          {counts.join(' · ')}
        </Txt>
      ) : null}
      {merged.items.map((it) =>
        it.kind === 'invoice' ? (
          <HistoryCard key={`d-${it.row.id}`} kind={kind} row={it.row} showDebt={showDebt} onPress={onOpen ? () => onOpen(it.row.id) : undefined} />
        ) : (
          <ReturnCard key={`r-${it.row.id}`} row={it.row} />
        ),
      )}
      {more ? <Button title="Xem thêm" variant="outline" size="medium" loading={more.loadingMore} onPress={more.onMore} /> : null}
    </View>
  );
}

function DebtTab({
  d,
  entries,
  loading,
  error,
  onRetry,
  withChildren,
  onWithChildren,
  onCollect,
  onOpenInvoice,
}: {
  d: CustomerDetail;
  entries?: DebtEntry[];
  loading: boolean;
  error?: unknown;
  onRetry: () => void;
  withChildren: boolean;
  onWithChildren: (v: boolean) => void;
  onCollect?: () => void;
  onOpenInvoice?: (id: number) => void;
}) {
  const [shown, setShown] = useState(DEBT_STEP);
  const hasChildren = d.children.length > 0;
  const list = entries ?? [];
  return (
    <View style={{ gap: 12 }}>
      {hasChildren ? (
        <ChipGroup
          fill
          options={[
            { value: 'all', label: 'Gồm khách con' },
            { value: 'own', label: 'Chỉ khách này' },
          ]}
          value={withChildren ? 'all' : 'own'}
          onChange={(v) => {
            setShown(DEBT_STEP);
            onWithChildren(v === 'all');
          }}
        />
      ) : null}
      {onCollect ? <Button title="Thu nợ" icon="banknote" onPress={onCollect} size="medium" /> : null}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : !list.length ? (
        <EmptyState icon="wallet" color="slate" title="Chưa có giao dịch" message="Khách chưa phát sinh công nợ." />
      ) : (
        <>
          <Card style={{ paddingVertical: 2 }}>
            {list.slice(0, shown).map((e, i) => (
              <View key={e.key}>
                {i ? <Divider inset={14} /> : null}
                <DebtRow
                  e={e}
                  showCustomer={withChildren && hasChildren}
                  onPress={e.type === 'invoice' && onOpenInvoice ? () => onOpenInvoice(e.id) : undefined}
                />
              </View>
            ))}
          </Card>
          {list.length > shown ? (
            <Button title={`Xem thêm (${list.length - shown})`} variant="outline" size="medium" onPress={() => setShown((n) => n + DEBT_STEP)} />
          ) : null}
        </>
      )}
    </View>
  );
}

export interface CustomerDetailViewProps {
  d: CustomerDetail;
  perms: CustomerPerms;
  tab: CustomerTab;
  onTab: (t: CustomerTab) => void;
  invoices: DocList;
  /** Phiếu trả hàng gộp vào tab Hóa đơn (không có = không có quyền xem trả hàng). */
  returns?: ReturnList;
  orders: DocList;
  debt: { entries?: DebtEntry[]; loading: boolean; error?: unknown; onRetry: () => void; withChildren: boolean; onWithChildren: (v: boolean) => void };
  onEdit?: () => void;
  onSaveNote?: (note: string) => void;
  savingNote?: boolean;
  onAddAddress?: () => void;
  onAddressPress?: (index: number) => void;
  onOpenDoc?: (kind: DocKind, id: number) => void;
  onOpenCustomer: (id: number) => void;
  onCollect?: () => void;
  onToggleActive?: () => void;
  busy?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/** Chi tiết khách hàng: thông tin, địa chỉ, lịch sử mua, công nợ, khách con. */
export function CustomerDetailView(p: CustomerDetailViewProps) {
  const { d, perms } = p;
  const tabs = [
    { value: 'info' as const, label: 'Thông tin' },
    { value: 'address' as const, label: `Địa chỉ (${d.addresses.length})` },
    ...(perms.viewInvoices || perms.viewReturns ? [{ value: 'invoice' as const, label: 'Hóa đơn' }] : []),
    ...(perms.viewOrders ? [{ value: 'order' as const, label: 'Đặt hàng' }] : []),
    ...(perms.viewDebt ? [{ value: 'debt' as const, label: 'Công nợ' }] : []),
    ...(d.children.length ? [{ value: 'children' as const, label: `Khách con (${d.children.length})` }] : []),
  ];
  const tab = tabs.some((t) => t.value === p.tab) ? p.tab : 'info';
  // Dòng hóa đơn trong công nợ chỉ mở được khi có quyền xem hóa đơn (màn hóa đơn còn kiểm người tạo).
  const openInvoice = p.onOpenDoc && perms.viewInvoices ? (id: number) => p.onOpenDoc?.('invoice', id) : undefined;

  return (
    <Page
      stickyHeader
      refreshing={p.refreshing}
      onRefresh={p.onRefresh}
      header={
        <SubHeader
          title={d.code || 'Khách hàng'}
          right={p.onEdit ? <IconButton icon="pencil" label="Sửa khách hàng" onPress={p.onEdit} tint={C.brand} /> : undefined}
        />
      }
      contentStyle={{ paddingBottom: 40 }}>
      <Section index={0} style={{ marginTop: 8 }}>
        <Card style={styles.head}>
          <View style={styles.row}>
            <Avatar name={d.name} size={56} />
            <View style={{ flex: 1, gap: 6 }}>
              <Txt variant="title" style={{ fontSize: 21, lineHeight: 27 }}>
                {d.name}
              </Txt>
              <View style={styles.pills}>
                <Pill label={d.isCompany ? 'Tổ chức' : 'Cá nhân'} tone="brand" />
                <Pill label={d.isActive ? 'Hoạt động' : 'Ngừng hoạt động'} tone={d.isActive ? 'success' : 'danger'} />
              </View>
            </View>
          </View>
          {d.parent ? (
            <PressableScale
              onPress={() => p.onOpenCustomer(d.parent!.id)}
              accessibilityRole="link"
              accessibilityLabel={`Thuộc khách ${d.parent.name}. Mở khách cha`}
              scaleTo={0.98}
              style={styles.parent}>
              <Icon name="users" size={16} color={C.brand} />
              <Txt variant="label" color={C.text} numberOfLines={1} style={{ flex: 1 }}>
                Thuộc {[d.parent.code, d.parent.name].filter(Boolean).join(' · ')}
              </Txt>
              <Icon name="chevron-right" size={16} color={C.faint} />
            </PressableScale>
          ) : null}

          {p.onCollect ? <Button title="Thu nợ" icon="banknote" variant="outline" size="medium" onPress={p.onCollect} /> : null}

          <Divider />
          <View style={styles.grid}>
            {perms.viewDebt ? <Stat label="Nợ hiện tại" value={money(d.totalDebt)} danger={d.totalDebt > 0} /> : null}
            {perms.viewDebt && d.children.length ? (
              <Stat label="Nợ gồm khách con" value={money(d.totalDebt + d.childrenDebt)} danger={d.totalDebt + d.childrenDebt > 0} />
            ) : null}
            <Stat label="Tổng bán" value={money(d.totalPurchased)} />
            <Stat label="Tổng bán trừ trả hàng" value={money(d.totalRevenue)} />
          </View>
        </Card>
      </Section>

      <Section index={1}>
        <ChipGroup options={tabs} value={tab} onChange={p.onTab} />
        <TabPanel value={tab} order={TAB_ORDER}>
          {tab === 'info' ? (
            <InfoTab d={d} showDebt={perms.viewDebt} onSaveNote={p.onSaveNote} savingNote={p.savingNote} />
          ) : tab === 'address' ? (
            <View style={{ gap: 10 }}>
              {d.addresses.length ? (
                d.addresses.map((a, i) => (
                  <AddressCard key={a.id ?? i} a={a} index={i} onPress={p.onAddressPress ? () => p.onAddressPress?.(i) : undefined} />
                ))
              ) : (
                <EmptyState icon="map-pin" color="slate" title="Chưa có địa chỉ" message="Thêm địa chỉ để giao hàng cho khách." />
              )}
              {p.onAddAddress ? <Button title="Thêm địa chỉ" icon="plus" variant="outline" size="medium" onPress={p.onAddAddress} /> : null}
            </View>
          ) : tab === 'invoice' ? (
            <DocListView kind="invoice" data={p.invoices} returns={p.returns} showDebt={perms.viewDebt} onOpen={openInvoice} />
          ) : tab === 'order' ? (
            <DocListView kind="order" data={p.orders} showDebt={false} onOpen={p.onOpenDoc ? (id) => p.onOpenDoc?.('order', id) : undefined} />
          ) : tab === 'debt' ? (
            <DebtTab
              d={d}
              entries={p.debt.entries}
              loading={p.debt.loading}
              error={p.debt.error}
              onRetry={p.debt.onRetry}
              withChildren={p.debt.withChildren}
              onWithChildren={p.debt.onWithChildren}
              onCollect={p.onCollect}
              onOpenInvoice={openInvoice}
            />
          ) : (
            <Card style={{ paddingVertical: 2 }}>
              {d.children.map((c, i) => (
                <View key={c.id}>
                  {i ? <Divider inset={14} /> : null}
                  <PressableScale
                    onPress={() => p.onOpenCustomer(c.id)}
                    accessibilityLabel={`${c.name}, ${c.code}${perms.viewDebt ? `, nợ ${money(c.totalDebt)} đồng` : ''}`}
                    scaleTo={0.985}
                    style={[styles.child, c.isActive ? null : { opacity: 0.6 }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt variant="body" weight="semibold" numberOfLines={1}>
                        {c.name}
                      </Txt>
                      <Txt variant="caption" color={C.muted} numeric numberOfLines={1}>
                        {[c.code, c.phone, c.isActive ? null : 'Ngừng hoạt động'].filter(Boolean).join(' · ')}
                      </Txt>
                    </View>
                    {perms.viewDebt ? (
                      <Txt variant="body" weight="bold" numeric color={c.totalDebt > 0 ? toneColors.danger.fg : C.muted}>
                        {money(c.totalDebt)}
                      </Txt>
                    ) : null}
                    <Icon name="chevron-right" size={16} color={C.faint} />
                  </PressableScale>
                </View>
              ))}
            </Card>
          )}
        </TabPanel>
      </Section>

      {p.onToggleActive ? (
        <View style={{ marginTop: 28 }}>
          <Button
            title={d.isActive ? 'Ngừng hoạt động' : 'Kích hoạt lại'}
            icon="power"
            variant={d.isActive ? 'danger' : 'outline'}
            onPress={p.onToggleActive}
            loading={p.busy}
          />
        </View>
      ) : null}
    </Page>
  );
}

export default function CustomerDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const user = useSession((s) => s.user);
  const perms = customerPerms(user);
  const qc = useQueryClient();
  const detail = useCustomerDetail(id);
  const [tab, setTab] = useState<CustomerTab>('info');
  const [withChildren, setWithChildren] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const invoices = useCustomerDocs('invoice', id, tab === 'invoice' && perms.viewInvoices);
  const orders = useCustomerDocs('order', id, tab === 'order' && perms.viewOrders);
  const returns = useCustomerReturns(id, tab === 'invoice' && perms.viewReturns);
  const hasChildren = !!detail.data?.children?.length;
  const debt = useDebtTimeline(id, withChildren && hasChildren, tab === 'debt' && perms.viewDebt);
  // Đường dẫn theo ngăn đang chứa màn này (tab Khách hàng hoặc phủ lên giỏ hàng).
  const paths = customerDetailPaths(useCustomerFormBase());
  const addressPath = useCustomerFormPaths().address;
  const docPath = useDocRoutes().detail;

  if (detail.isLoading || !detail.data) {
    return (
      <Page stickyHeader scroll={false} header={<SubHeader title="Khách hàng" />}>
        {detail.isError ? <ErrorState error={detail.error} onRetry={() => void detail.refetch()} /> : <LoadingState />}
      </Page>
    );
  }

  const raw = detail.data;
  const d = toCustomerDetail(raw);
  const refresh = () =>
    Promise.all([qc.invalidateQueries({ queryKey: ['customer', id] }), qc.invalidateQueries({ queryKey: ['customers'] })]);

  const docList = (q: typeof invoices): DocList => ({
    rows: q.data?.pages.flatMap((pg) => pg.rows) ?? [],
    total: q.data?.pages[0]?.total,
    loading: q.isLoading,
    error: q.isError ? q.error : undefined,
    hasMore: !!q.hasNextPage,
    loadingMore: q.isFetchingNextPage,
    onMore: () => void q.fetchNextPage(),
    onRetry: () => void q.refetch(),
  });

  const returnList: ReturnList = {
    rows: returns.data?.pages.flatMap((pg) => pg.rows) ?? [],
    total: returns.data?.pages[0]?.total,
    loading: returns.isLoading,
    error: returns.isError ? returns.error : undefined,
    hasMore: !!returns.hasNextPage,
    loadingMore: returns.isFetchingNextPage,
    onMore: () => void returns.fetchNextPage(),
    onRetry: () => void returns.refetch(),
  };

  const addressForms = (): AddressForm[] => d.addresses.map(toAddressForm);

  const saveAddresses = (list: AddressForm[], done: string) => {
    setBusy(true);
    updateCustomer(id, { addresses: list.map(toAddressPayload) })
      .then(async () => {
        toast.success(done);
        await refresh();
      })
      .catch((e: unknown) => toast.error(errorMessage(e)))
      .finally(() => setBusy(false));
  };

  const onAddressPress = (index: number) => {
    const list = addressForms();
    const a = list[index];
    if (!a) return;
    const items: { value: 'edit' | 'default' | 'delete'; label: string; destructive?: boolean }[] = [
      { value: 'edit', label: 'Sửa địa chỉ' },
      ...(a.isDefault ? [] : [{ value: 'default' as const, label: 'Đặt làm mặc định' }]),
      ...(list.length > 1 ? [{ value: 'delete' as const, label: 'Xóa địa chỉ', destructive: true }] : []),
    ];
    pickFromSheet(addressTitle(a, index), items, null, (v) => {
      if (v === 'edit') {
        startAddressDraft(a, { customerId: id, list });
        router.push(addressPath as never);
      } else if (v === 'default') {
        saveAddresses(setDefaultAddress(list, a.key), 'Đã đổi địa chỉ mặc định');
      } else {
        Alert.alert('Xóa địa chỉ này?', addressLine(a) || addressTitle(a, index), [
          { text: 'Hủy bỏ', style: 'cancel' },
          { text: 'Xóa', style: 'destructive', onPress: () => saveAddresses(removeAddress(list, a.key), 'Đã xóa địa chỉ') },
        ]);
      }
    });
  };

  const toggleActive = () => {
    const next = !d.isActive;
    Alert.alert(
      next ? 'Kích hoạt lại khách hàng?' : 'Ngừng hoạt động khách hàng?',
      next ? `${d.name} sẽ chọn được khi bán hàng.` : `${d.name} sẽ không chọn được khi bán hàng nữa. Có thể kích hoạt lại sau.`,
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        {
          text: next ? 'Kích hoạt' : 'Ngừng hoạt động',
          style: next ? 'default' : 'destructive',
          onPress: () => {
            setBusy(true);
            setCustomerActive(id, next)
              .then(async () => {
                toast.success(next ? `Đã kích hoạt ${d.code}` : `Đã ngừng hoạt động ${d.code}`);
                await refresh();
              })
              .catch((e: unknown) => toast.error(errorMessage(e)))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  return (
    <CustomerDetailView
      d={d}
      perms={perms}
      tab={tab}
      onTab={setTab}
      invoices={docList(invoices)}
      returns={perms.viewReturns ? returnList : undefined}
      orders={docList(orders)}
      debt={{
        entries: debt.data,
        loading: debt.isLoading,
        error: debt.isError ? debt.error : undefined,
        onRetry: () => void debt.refetch(),
        withChildren,
        onWithChildren: setWithChildren,
      }}
      onEdit={
        perms.update
          ? () => {
              startCustomerDraft(toCustomerForm(raw), id);
              router.push({ pathname: paths.edit, params: { id: String(id) } } as never);
            }
          : undefined
      }
      onSaveNote={
        perms.editNote
          ? (note) => {
              setSavingNote(true);
              saveCustomerNote(id, note)
                .then(async () => {
                  toast.success('Đã lưu ghi chú');
                  await refresh();
                })
                .catch((e: unknown) => toast.error(errorMessage(e)))
                .finally(() => setSavingNote(false));
            }
          : undefined
      }
      savingNote={savingNote}
      onAddAddress={
        perms.update
          ? () => {
              const list = addressForms();
              startAddressDraft(emptyAddress(list.length === 0, d.name, d.phone1 ?? ''), { customerId: id, list });
              router.push(addressPath as never);
            }
          : undefined
      }
      onAddressPress={perms.update ? onAddressPress : undefined}
      onOpenDoc={(kind, docId) =>
        router.push({ pathname: docPath, params: { kind: KIND_SLUG[kind], id: String(docId) } } as never)
      }
      onOpenCustomer={(cid) => router.push({ pathname: paths.detail, params: { id: String(cid) } } as never)}
      onCollect={
        perms.collect && perms.viewDebt && d.isActive
          ? () => router.push({ pathname: paths.collect, params: { id: String(id) } } as never)
          : undefined
      }
      onToggleActive={perms.changeStatus ? toggleActive : undefined}
      busy={busy}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void Promise.all([
          detail.refetch(),
          tab === 'invoice' && perms.viewInvoices ? invoices.refetch() : null,
          tab === 'invoice' && perms.viewReturns ? returns.refetch() : null,
          tab === 'order' ? orders.refetch() : null,
          tab === 'debt' ? debt.refetch() : null,
        ]).finally(() => setRefreshing(false));
      }}
    />
  );
}

const styles = StyleSheet.create({
  head: { padding: 16, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  parent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.brandSoft,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  stat: { width: '50%', paddingRight: 8, gap: 2 },
  block: { paddingHorizontal: 14, paddingVertical: 4 },
  text: { padding: 14, gap: 6 },
  note: {
    minHeight: 84,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: C.text,
    textAlignVertical: 'top',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#F7F9FB',
  },
  address: { padding: 14, gap: 4 },
  child: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
});
