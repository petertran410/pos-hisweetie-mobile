import { router, usePreventRemove } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money, qty } from '@/core/format';
import { errorMessage } from '@/core/http';
import { useSession } from '@/core/session';
import { Button, C, ChipGroup, Divider, EmptyState, ErrorState, Icon, ImageViewer, LoadingState, MoneyField, MultiSelect, Page, PressableScale, Select, SubHeader, toast, Txt } from '@/ui';
import { useStaff } from '../customers/api';
import { isImageFile } from '../packing/model';
import { pickDocuments, pickPhotos, takePhoto } from '../packing/pick';
import { FormCard, Note, NumRow, TextRow } from '../products/formParts';
import { createKho, useFinanceAccess, useKhoVehicles } from './api';
import { DateRow, FileGroup, OptionalDateRow, dateToDay, dayToDate } from './components';
import {
  addKhoRecent,
  clearKhoDraft,
  enqueueKhoFiles,
  patchKhoDraft,
  presetKhoDraft,
  removeKhoFile,
  retryKhoFile,
  startKhoDraft,
  useKhoDraft,
  waitForKhoUploads,
} from './draft';
import {
  branchName,
  createBranches,
  EXPENSE_ITEMS,
  FILE_GROUPS,
  fuelLiters,
  isKhoDirty,
  KHO_TYPES,
  khoAmount,
  lineTotal,
  nextKhoForm,
  OFFICE_BRANCH_IDS,
  ownVehicle,
  pendingFiles,
  toKhoCreated,
  validateKhoForm,
  VEHICLE_SERVICE_TYPES,
  type KhoFile,
  type KhoForm,
  type ReceiptKind,
  type VehicleOpt,
} from './model';

/** Ảnh tối đa trên 1 phiếu. */
const MAX_FILES = 30;

const RECEIPT_KINDS: { value: ReceiptKind; label: string }[] = [
  { value: 'CUSTOMER', label: 'Thu khách' },
  { value: 'WAREHOUSE_SALE', label: 'Bán đồ kho' },
];

export interface KhoFormViewProps {
  form: KhoForm;
  branches: { id: number; name: string }[];
  staff: { id: number; name: string }[];
  staffLoading?: boolean;
  vehicles: VehicleOpt[];
  vehiclesLoading?: boolean;
  saving?: string | null;
  onChange: (patch: Partial<KhoForm>) => void;
  onPickCustomers: () => void;
  onAddFiles: (kind: string, from: 'camera' | 'library' | 'file') => void;
  onRetryFile: (f: KhoFile) => void;
  onRemoveFile: (f: KhoFile) => void;
  onSave: () => void;
}

/** Form tạo phiếu kho: tiền mặt kho, khoản chi khác, xăng dầu, chăm sóc xe (giống web /phieu-kho). */
export function KhoFormView(p: KhoFormViewProps) {
  const f = p.form;
  const t = KHO_TYPES[f.type];
  const insets = useSafeAreaInsets();
  const [viewer, setViewer] = useState<{ images: string[]; start: number } | null>(null);
  const vehicle = f.type === 'xang-dau' || f.type === 'cham-soc-xe';
  const total = khoAmount(f);
  const line = lineTotal(f);
  const liters = f.type === 'xang-dau' ? fuelLiters(f) : null;
  const office = f.type === 'chi-khac' && f.branchId !== null && OFFICE_BRANCH_IDS.includes(f.branchId);
  // Người chi đang chọn luôn có trong danh sách (kể cả khi danh sách nhân viên chưa tải xong).
  const staffOptions = [...(f.payer && !p.staff.some((u) => u.id === f.payer?.id) ? [f.payer] : []), ...p.staff].map((u) => ({ value: u.id, label: u.name }));

  const view = (uri: string) => {
    const imgs = f.files.filter((a) => isImageFile({ type: a.type, name: a.name, url: a.url })).map((a) => a.uri);
    setViewer({ images: imgs, start: Math.max(0, imgs.indexOf(uri)) });
  };

  const branchSelect = (
    <Select
      label="Chi nhánh"
      options={p.branches.map((b) => ({ value: b.id, label: b.name }))}
      value={f.branchId}
      onChange={(id) => {
        if (id === null || id === f.branchId) return;
        // Xe thuộc từng kho: đổi kho thì chọn lại xe (giống web).
        p.onChange(vehicle ? { branchId: id, vehicleId: null } : { branchId: id });
      }}
      disabled={p.branches.length < 2}
      placeholder="Chọn chi nhánh"
    />
  );
  const payerSelect = (
    <Select
      label="Người chi"
      options={staffOptions}
      value={f.payer?.id ?? null}
      onChange={(id) => {
        const u = p.staff.find((x) => x.id === id);
        if (u) p.onChange({ payer: u });
      }}
      placeholder={p.staffLoading ? 'Đang tải…' : 'Chọn người chi'}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SubHeader title={t.title} />
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.body, { paddingBottom: 24 }]}>
        <Txt variant="caption" color={C.muted}>
          {office ? 'Phiếu văn phòng: kế toán bấm Đã chi trên web để trừ quỹ văn phòng.' : t.hint}
        </Txt>

        {f.type === 'tien-mat' ? (
          <>
            <FormCard>
              {branchSelect}
              <Divider />
              <DateRow label="Ngày thu" mode="date" value={dayToDate(f.date)} maximumDate={new Date()} onChange={(d) => p.onChange({ date: dateToDay(d) })} />
            </FormCard>
            <MoneyField label="Số tiền" bold value={f.amount} onChange={(amount) => p.onChange({ amount })} />
            <View style={{ gap: 8 }}>
              <Txt variant="heading">Loại phiếu</Txt>
              <ChipGroup fill options={RECEIPT_KINDS} value={f.receiptKind} onChange={(receiptKind) => p.onChange({ receiptKind })} />
            </View>
            {f.receiptKind === 'CUSTOMER' ? (
              <FormCard title="Khách hàng">
                {f.customers.map((c) => (
                  <View key={c.id}>
                    <View style={styles.customer}>
                      <View style={{ flex: 1, gap: 1 }}>
                        <Txt variant="body" weight="semibold" numberOfLines={1}>
                          {c.name}
                        </Txt>
                        {c.code ? (
                          <Txt variant="caption" color={C.muted} numeric>
                            {c.code}
                          </Txt>
                        ) : null}
                      </View>
                      <PressableScale
                        onPress={() => p.onChange({ customers: f.customers.filter((x) => x.id !== c.id) })}
                        accessibilityLabel={`Bỏ khách hàng ${c.name}`}
                        hitSlop={10}
                        scaleTo={0.85}
                        style={styles.remove}>
                        <Icon name="x" size={16} color={C.muted} />
                      </PressableScale>
                    </View>
                    <Divider />
                  </View>
                ))}
                <View style={{ paddingVertical: 12 }}>
                  <Button title={f.customers.length ? 'Thêm khách hàng' : 'Chọn khách hàng'} icon="search" variant="outline" size="small" onPress={p.onPickCustomers} />
                </View>
              </FormCard>
            ) : null}
            <FormCard>
              <TextRow label="Nội dung" value={f.description} onChange={(description) => p.onChange({ description })} placeholder="Không bắt buộc" maxLength={500} />
              <Divider />
              <TextRow label="Ghi chú" value={f.note} onChange={(note) => p.onChange({ note })} placeholder="Không bắt buộc" maxLength={1000} multiline />
            </FormCard>
          </>
        ) : null}

        {f.type === 'chi-khac' ? (
          <>
            <FormCard>
              {branchSelect}
              <Divider />
              <Select
                label="Khoản mục"
                options={EXPENSE_ITEMS.map((x) => ({ value: x as string, label: x }))}
                value={f.expenseItem}
                onChange={(expenseItem) => p.onChange({ expenseItem })}
                placeholder="Chọn khoản mục"
              />
              <Divider />
              <DateRow label="Ngày chi" mode="date" value={dayToDate(f.date)} maximumDate={new Date()} onChange={(d) => p.onChange({ date: dateToDay(d) })} />
            </FormCard>
            <FormCard title="Số tiền" hint="Nhập số lượng × đơn giá, hoặc bỏ trống cả hai rồi nhập số tiền.">
              <NumRow label="Số lượng" decimal value={f.quantity ?? 0} onChange={(n) => p.onChange({ quantity: n > 0 ? n : null })} placeholder="Không bắt buộc" />
              <Divider />
              <NumRow label="Đơn giá" money value={f.unitPrice ?? 0} onChange={(n) => p.onChange({ unitPrice: n > 0 ? n : null })} placeholder="Không bắt buộc" suffix="₫" />
              <Divider />
              {line !== null ? (
                <View style={styles.readRow}>
                  <Txt variant="body" color={C.muted} style={{ flex: 1 }}>
                    Thành tiền
                  </Txt>
                  <Txt variant="body" weight="bold" numeric>
                    {money(line)} ₫
                  </Txt>
                </View>
              ) : (
                <NumRow label="Số tiền" money value={f.amount} onChange={(amount) => p.onChange({ amount })} placeholder="Bắt buộc" suffix="₫" />
              )}
            </FormCard>
            <FormCard>
              <TextRow
                label="Nội dung"
                value={f.description}
                onChange={(description) => p.onChange({ description })}
                placeholder="Bắt buộc"
                maxLength={1000}
                multiline
              />
              <Divider />
              <TextRow label="Ghi chú" value={f.note} onChange={(note) => p.onChange({ note })} placeholder="Không bắt buộc" maxLength={1000} />
              <Divider />
              {payerSelect}
            </FormCard>
          </>
        ) : null}

        {vehicle ? (
          <>
            <FormCard>
              {branchSelect}
              <Divider />
              <Select
                label="Xe"
                options={p.vehicles.map((v) => ({ value: v.id, label: v.label, sub: v.driverName ? `Lái xe: ${v.driverName}` : null }))}
                value={f.vehicleId}
                onChange={(vehicleId) => p.onChange({ vehicleId })}
                placeholder={p.vehiclesLoading ? 'Đang tải…' : 'Chọn xe'}
                disabled={p.vehiclesLoading}
              />
              {f.type === 'cham-soc-xe' ? (
                <>
                  <Divider />
                  {/* Gọn trong 1 dòng chọn (mở sheet chọn nhiều), không trải danh sách nút ra form. */}
                  <MultiSelect
                    label="Loại dịch vụ"
                    options={VEHICLE_SERVICE_TYPES.map((s) => ({ value: s as string, label: s }))}
                    value={f.serviceTypes}
                    onChange={(serviceTypes) => p.onChange({ serviceTypes })}
                    placeholder="Bắt buộc"
                    clearLabel={null}
                  />
                </>
              ) : null}
              <Divider />
              <DateRow label="Thời gian" mode="datetime" value={new Date(f.at)} maximumDate={new Date()} onChange={(d) => p.onChange({ at: d.toISOString() })} />
            </FormCard>
            {!p.vehiclesLoading && f.branchId && p.vehicles.length === 0 ? <Note tone="warning" text="Chi nhánh chưa có xe. Nhờ quản lý thêm xe ở Danh sách xe trên web." /> : null}
            <FormCard>
              <NumRow label={f.type === 'xang-dau' ? 'Số tiền' : 'Chi phí'} money value={f.amount} onChange={(amount) => p.onChange({ amount })} placeholder="Bắt buộc" suffix="₫" />
              <Divider />
              <NumRow label="ODO" money value={f.odo ?? 0} onChange={(n) => p.onChange({ odo: n > 0 ? n : null })} placeholder="Số km trên đồng hồ" suffix="km" />
              {f.type === 'xang-dau' ? (
                <>
                  <Divider />
                  <NumRow label="Đơn giá" money value={f.unitPrice ?? 0} onChange={(n) => p.onChange({ unitPrice: n > 0 ? n : null })} placeholder="Bắt buộc" suffix="₫/lít" />
                  <Divider />
                  <View style={styles.readRow}>
                    <Txt variant="body" color={C.muted} style={{ flex: 1 }}>
                      Số lít
                    </Txt>
                    <Txt variant="body" weight={liters ? 'semibold' : 'regular'} color={liters ? C.text : C.faint} numeric>
                      {liters ? `${qty(Math.round(liters * 100) / 100)} lít` : '= Số tiền / Đơn giá'}
                    </Txt>
                  </View>
                </>
              ) : (
                <>
                  <Divider />
                  <OptionalDateRow label="Hạn đăng kiểm / bảo hiểm" value={f.dueAt} onChange={(dueAt) => p.onChange({ dueAt })} />
                </>
              )}
            </FormCard>
            <FormCard>
              <TextRow label="Địa điểm" value={f.location} onChange={(location) => p.onChange({ location })} placeholder="Không bắt buộc" maxLength={300} />
              <Divider />
              {payerSelect}
              <Divider />
              <TextRow label="Ghi chú" value={f.note} onChange={(note) => p.onChange({ note })} placeholder="Không bắt buộc" maxLength={1000} multiline />
            </FormCard>
          </>
        ) : null}

        {FILE_GROUPS[f.type].map((g) => {
          // Ảnh chưa rõ nhóm (không thuộc nhóm nào của loại phiếu) xếp chung với nhóm cuối (Hóa đơn / Chứng từ), giống web.
          const groups = FILE_GROUPS[f.type];
          const last = groups[groups.length - 1].kind;
          const files = f.files.filter((a) => a.kind === g.kind || (g.kind === last && !groups.some((x) => x.kind === a.kind)));
          return (
            <FileGroup
              key={g.kind}
              label={g.label}
              files={files}
              onCamera={() => p.onAddFiles(g.kind, 'camera')}
              onLibrary={() => p.onAddFiles(g.kind, 'library')}
              onFile={() => p.onAddFiles(g.kind, 'file')}
              onView={view}
              onRetry={p.onRetryFile}
              onRemove={p.onRemoveFile}
            />
          );
        })}
        <Txt variant="caption" color={C.muted}>
          Ảnh được thu nhỏ và tải lên ngay khi chọn, nên lúc lưu không phải chờ lâu.
        </Txt>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          title={p.saving === 'uploading' ? 'Đang tải ảnh, sẽ lưu ngay…' : total > 0 ? `Tạo phiếu · ${money(total)} ₫` : 'Tạo phiếu'}
          icon="check"
          onPress={p.onSave}
          loading={!!p.saving}
          disabled={!!p.saving}
        />
      </View>
      <ImageViewer images={viewer?.images ?? []} start={viewer?.start ?? 0} visible={!!viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

export default function KhoFormScreen() {
  const form = useKhoDraft((s) => s.form);
  const baseline = useKhoDraft((s) => s.baseline);
  const user = useSession((s) => s.user);
  const sessionBranches = useSession((s) => s.branches);
  const access = useFinanceAccess(!!form);
  const isVehicle = form?.type === 'xang-dau' || form?.type === 'cham-soc-xe';
  const staff = useStaff(!!form && form.type !== 'tien-mat');
  const vehicles = useKhoVehicles(form?.branchId ?? null, !!isVehicle);
  const [saving, setSaving] = useState<string | null>(null);
  const [exit, setExit] = useState<{ go: () => void } | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const busyRef = useRef(false);

  // Lái xe mở phiếu xe: chọn sẵn xe đang giao cho chính họ.
  const vehicleList = vehicles.data;
  const formVehicle = form?.vehicleId ?? null;
  useEffect(() => {
    if (!isVehicle || formVehicle !== null || !vehicleList) return;
    const own = ownVehicle(vehicleList, user?.id);
    if (own) presetKhoDraft({ vehicleId: own });
  }, [isVehicle, formVehicle, vehicleList, user?.id]);

  const dirty = form && baseline ? isKhoDirty(form, baseline) : false;
  usePreventRemove(dirty && !exit && !discarding, ({ repeat }) => {
    Alert.alert('Bỏ phiếu đang nhập?', 'Những gì bạn đã nhập (kể cả ảnh) sẽ không được lưu.', [
      { text: 'Ở lại', style: 'cancel' },
      {
        text: 'Bỏ phiếu',
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

  if (!form) {
    return (
      <Page scroll={false} header={<SubHeader title="Phiếu kho" />}>
        <EmptyState icon="clipboard-list" color="slate" title="Không có phiếu đang nhập" message="Quay lại Phiếu kho rồi chọn loại phiếu để tạo." />
      </Page>
    );
  }
  const t = KHO_TYPES[form.type];
  if (access.isLoading) {
    return (
      <Page scroll={false} header={<SubHeader title={t.title} />}>
        <LoadingState />
      </Page>
    );
  }
  if (access.isError) {
    return (
      <Page scroll={false} header={<SubHeader title={t.title} />}>
        <ErrorState error={access.error} onRetry={() => void access.refetch()} />
      </Page>
    );
  }
  const allowed = access.data ? createBranches(access.data, form.type) : [];
  if (!allowed.length) {
    return (
      <Page scroll={false} header={<SubHeader title={t.title} />}>
        <EmptyState icon="lock" color="slate" title="Chưa có quyền" message={`Bạn chưa có quyền tạo ${t.label.toLowerCase()} ở kho nào.`} />
      </Page>
    );
  }
  const branches = allowed.map((id) => ({ id, name: branchName(id, sessionBranches) }));

  const addFiles = async (kind: string, from: 'camera' | 'library' | 'file') => {
    try {
      const left = MAX_FILES - form.files.length;
      if (left <= 0) {
        toast.info(`Mỗi phiếu tối đa ${MAX_FILES} ảnh / tệp`);
        return;
      }
      const picked = from === 'camera' ? await takePhoto('chụp ảnh chứng từ') : from === 'library' ? await pickPhotos(left) : await pickDocuments();
      enqueueKhoFiles(kind, picked.slice(0, left));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const askRetry = (a: KhoFile) =>
    Alert.alert('Chưa tải lên được', a.error || 'Có lỗi xảy ra, vui lòng thử lại.', [
      { text: 'Bỏ', style: 'destructive', onPress: () => removeKhoFile(a.key) },
      { text: 'Thử lại', onPress: () => retryKhoFile(a.key) },
    ]);

  const save = async () => {
    if (busyRef.current) return;
    const err = validateKhoForm(form);
    if (err) {
      Alert.alert('Chưa lưu được', err);
      return;
    }
    busyRef.current = true;
    try {
      // Ảnh đang tải dở: chờ xong rồi lưu luôn (không bắt người dùng bấm lại).
      if (pendingFiles(form).some((a) => a.state !== 'error')) setSaving('uploading');
      const latest = await waitForKhoUploads();
      if (!latest) return;
      const failed = pendingFiles(latest).filter((a) => a.state === 'error');
      if (failed.length) {
        setSaving(null);
        Alert.alert(`${failed.length} ảnh / tệp tải lên lỗi`, 'Bấm vào ảnh lỗi để thử lại, hoặc lưu phiếu không kèm các ảnh đó.', [
          { text: 'Để thử lại', style: 'cancel' },
          {
            text: 'Lưu không kèm',
            onPress: () => {
              for (const a of failed) removeKhoFile(a.key);
              busyRef.current = false;
              void save();
            },
          },
        ]);
        return;
      }
      setSaving('saving');
      const created = await createKho(latest);
      const item = toKhoCreated(created, latest, branchName(latest.branchId as number, sessionBranches));
      addKhoRecent(item);
      // Giống web: tạo xong làm trống form để nhập phiếu tiếp (giữ chi nhánh, xe, người chi).
      Alert.alert(`Đã tạo ${item.code}`, `${t.label} · ${money(item.amount)} ₫. Làm tiếp phiếu khác?`, [
        {
          text: 'Xong',
          style: 'cancel',
          onPress: () =>
            setExit({
              go: () => {
                clearKhoDraft();
                router.back();
              },
            }),
        },
        { text: 'Tạo phiếu tiếp', onPress: () => startKhoDraft(nextKhoForm(latest)) },
      ]);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      busyRef.current = false;
      setSaving(null);
    }
  };

  return (
    <KhoFormView
      form={form}
      branches={branches}
      staff={staff.data ?? []}
      staffLoading={staff.isLoading}
      vehicles={vehicles.data ?? []}
      vehiclesLoading={vehicles.isLoading && vehicles.fetchStatus !== 'idle'}
      saving={saving}
      onChange={(patch) => patchKhoDraft(() => patch)}
      onPickCustomers={() => router.push('/phieu-kho/chon-khach' as never)}
      onAddFiles={(kind, from) => void addFiles(kind, from)}
      onRetryFile={askRetry}
      onRemoveFile={(a) => removeKhoFile(a.key)}
      onSave={() => void save()}
    />
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 18 },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingVertical: 8 },
  customer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  remove: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2F6' },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
});
