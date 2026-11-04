import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '@/core/http';
import { useSession } from '@/core/session';
import { Button, C, ChipGroup, Divider, EmptyState, Icon, Page, Pill, PressableScale, SubHeader, toast, toneColors, Txt } from '@/ui';
import { FormCard, Note, PickRow, TextRow } from '../products/formParts';
import { createCustomer, lookupTaxCode, updateCustomer, useSalePicId, useStaff } from './api';
import { ADDRESS_PATH, patchCustomerDraft, setLoadedSalePic, startAddressDraft, useCustomerDraft } from './draft';
import {
  buildCustomerCreate,
  buildCustomerUpdate,
  emptyAddress,
  isFormDirty,
  isTaxCode,
  validateCustomerForm,
  type AddressForm,
  type CustomerForm,
} from './form';
import { addressLine, addressTitle, customerPerms, type CustomerPerms } from './model';

export type FormPick = 'parent' | 'groups' | 'salePic';
const PICK_PATH: Record<FormPick, string> = {
  parent: '/khach-hang/chon-cha',
  groups: '/khach-hang/chon-nhom',
  salePic: '/khach-hang/chon-sale',
};

const TYPES: { value: '0' | '1'; label: string }[] = [
  { value: '0', label: 'Cá nhân' },
  { value: '1', label: 'Tổ chức / Hộ KD' },
];

function AddressItem({ a, index, onPress }: { a: AddressForm; index: number; onPress: () => void }) {
  const line = addressLine(a);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${addressTitle(a, index)}${a.isDefault ? ', mặc định' : ''}. ${line}. Bấm để sửa`}
      scaleTo={0.985}
      style={styles.address}>
      <Icon name="map-pin" size={18} color={a.isDefault ? C.brand : C.muted} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.row}>
          <Txt variant="body" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {addressTitle(a, index)}
          </Txt>
          {a.isDefault ? <Pill label="Mặc định" tone="brand" /> : null}
        </View>
        <Txt variant="caption" color={line ? C.muted : toneColors.danger.fg} numberOfLines={2}>
          {line || 'Chưa đủ địa chỉ'}
        </Txt>
      </View>
      <Icon name="chevron-right" size={16} color={C.faint} />
    </PressableScale>
  );
}

export interface CustomerFormViewProps {
  form: CustomerForm;
  editing: boolean;
  code?: string;
  perms: CustomerPerms;
  /** Khách đang sửa là khách cha (có khách con): không cho chọn khách cha. */
  hasChildren?: boolean;
  onChange: (patch: Partial<CustomerForm>) => void;
  onPick: (t: FormPick) => void;
  onAddress: (a: AddressForm | null) => void;
  onLookupTax?: () => void;
  lookingUp?: boolean;
  salePicLoading?: boolean;
  onSave: () => void;
  busy?: boolean;
}

/** Form thêm / sửa khách hàng (giống form của web, gọn cho điện thoại). */
export function CustomerFormView(p: CustomerFormViewProps) {
  const { form, perms } = p;
  const insets = useSafeAreaInsets();
  const company = form.type === 1;
  // Giống web: khách con không đổi khách cha; khách cha không thể thành khách con.
  const parentEditable = !p.hasChildren && !(p.editing && form.parent);
  const canTaxLookup = isTaxCode(form.taxCode);

  return (
    <Page
      stickyHeader
      automaticallyAdjustKeyboardInsets
      header={<SubHeader title={p.editing ? `Sửa ${p.code ?? 'khách hàng'}` : 'Thêm khách hàng'} />}
      footer={
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Button title={p.editing ? 'Lưu thay đổi' : 'Lưu khách hàng'} icon="check" onPress={p.onSave} loading={p.busy} />
        </View>
      }
      contentStyle={{ gap: 18, paddingTop: 4, paddingBottom: 40 }}>
      <FormCard title="Loại khách hàng">
        <View style={{ paddingVertical: 10 }}>
          <ChipGroup
            fill
            options={TYPES}
            value={form.type === null ? null : (String(form.type) as '0' | '1')}
            onChange={(v) => p.onChange({ type: v === '1' ? 1 : 0 })}
          />
        </View>
      </FormCard>

      <FormCard>
        <TextRow label="Tên khách" value={form.name} onChange={(t) => p.onChange({ name: t })} placeholder="Bắt buộc" autoCapitalize="words" />
        <Divider />
        <TextRow
          label="Mã khách"
          value={form.code}
          onChange={(t) => p.onChange({ code: t })}
          placeholder={p.editing ? 'Bắt buộc' : 'Để trống để tự tạo mã'}
          autoCapitalize="characters"
        />
        <Divider />
        <TextRow
          label="Điện thoại 1"
          value={form.contactNumber}
          onChange={(t) => p.onChange({ contactNumber: t })}
          placeholder="Bắt buộc"
          keyboardType="phone-pad"
        />
        <Divider />
        <TextRow label="Điện thoại 2" value={form.phone} onChange={(t) => p.onChange({ phone: t })} placeholder="Không bắt buộc" keyboardType="phone-pad" />
        <Divider />
        <TextRow
          label="Email"
          value={form.email}
          onChange={(t) => p.onChange({ email: t })}
          placeholder="Không bắt buộc"
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </FormCard>

      <FormCard title="Phân loại">
        <PickRow
          label="Khách cha"
          value={form.parent ? `${form.parent.code} · ${form.parent.name}` : ''}
          placeholder={parentEditable ? 'Không có' : '—'}
          onPress={parentEditable ? () => p.onPick('parent') : undefined}
        />
        {parentEditable && form.parent ? (
          <PressableScale onPress={() => p.onChange({ parent: null })} hitSlop={6} scaleTo={0.95} style={styles.inlineLink} accessibilityRole="button">
            <Txt variant="label" weight="semibold" color={C.brand}>
              Bỏ khách cha
            </Txt>
          </PressableScale>
        ) : null}
        {perms.viewGroups ? (
          <>
            <Divider />
            <PickRow label="Nhóm khách" value={form.groups.map((g) => g.name).join(', ')} placeholder="Chưa chọn" onPress={() => p.onPick('groups')} />
          </>
        ) : null}
        {perms.assignSalePic ? (
          <>
            <Divider />
            {p.salePicLoading ? (
              <View style={[styles.row, { minHeight: 50 }]}>
                <Txt variant="body" color={C.muted} style={{ flex: 1 }}>
                  Sale PIC
                </Txt>
                <ActivityIndicator color={C.brand} />
              </View>
            ) : (
              <PickRow
                label={p.editing ? 'Sale PIC' : 'Sale PIC *'}
                value={form.salePic?.name ?? ''}
                placeholder={p.editing ? 'Chưa có' : 'Bắt buộc'}
                onPress={() => p.onPick('salePic')}
              />
            )}
          </>
        ) : null}
      </FormCard>

      <FormCard title="Địa chỉ giao hàng" hint="Bắt buộc ít nhất 1 địa chỉ. Địa chỉ mặc định được chọn sẵn khi lên đơn.">
        {form.addresses.map((a, i) => (
          <View key={a.key}>
            {i ? <Divider /> : null}
            <AddressItem a={a} index={i} onPress={() => p.onAddress(a)} />
          </View>
        ))}
        {form.addresses.length ? <Divider /> : null}
        <PressableScale onPress={() => p.onAddress(null)} accessibilityRole="button" scaleTo={0.98} style={styles.addRow}>
          <Icon name="plus" size={18} color={C.brand} />
          <Txt variant="body" weight="semibold" color={C.brand}>
            Thêm địa chỉ
          </Txt>
        </PressableScale>
      </FormCard>

      <FormCard title="Thông tin xuất hóa đơn" hint={company ? 'Điền MST thì cần thêm địa chỉ và email nhận hóa đơn.' : 'Điền 1 ô chính thì cần đủ người mua, MST, địa chỉ và email.'}>
        <TextRow
          label="MST"
          value={form.taxCode}
          onChange={(t) => p.onChange({ taxCode: t })}
          placeholder="10 hoặc 13 số"
          keyboardType="numbers-and-punctuation"
          right={
            p.onLookupTax ? (
              <PressableScale
                onPress={p.onLookupTax}
                disabled={!canTaxLookup || p.lookingUp}
                hitSlop={6}
                scaleTo={0.94}
                accessibilityRole="button"
                accessibilityLabel="Tra cứu mã số thuế"
                style={[styles.lookup, !canTaxLookup ? { opacity: 0.45 } : null]}>
                {p.lookingUp ? (
                  <ActivityIndicator size="small" color={C.brand} />
                ) : (
                  <Txt variant="label" weight="semibold" color={C.brand}>
                    Tra cứu
                  </Txt>
                )}
              </PressableScale>
            ) : undefined
          }
        />
        <Divider />
        {company ? (
          <>
            <TextRow label="Tên công ty" value={form.organization} onChange={(t) => p.onChange({ organization: t })} autoCapitalize="words" />
            <Divider />
          </>
        ) : null}
        <TextRow label="Người mua" value={form.invoiceBuyerName} onChange={(t) => p.onChange({ invoiceBuyerName: t })} autoCapitalize="words" />
        <Divider />
        <TextRow label="Địa chỉ" value={form.invoiceAddress} onChange={(t) => p.onChange({ invoiceAddress: t })} />
        <Divider />
        <TextRow
          label="Email nhận"
          value={form.invoiceEmail}
          onChange={(t) => p.onChange({ invoiceEmail: t })}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Divider />
        <TextRow label="Điện thoại" value={form.invoicePhone} onChange={(t) => p.onChange({ invoicePhone: t })} keyboardType="phone-pad" />
        <Divider />
        <TextRow label="Số CCCD" value={form.invoiceCccdCmnd} onChange={(t) => p.onChange({ invoiceCccdCmnd: t })} keyboardType="number-pad" />
        <Divider />
        {company ? (
          <TextRow label="Mã ĐVQHNS" value={form.invoiceDvqhnsCode} onChange={(t) => p.onChange({ invoiceDvqhnsCode: t })} />
        ) : (
          <TextRow
            label="Hộ chiếu"
            value={form.invoiceBankAccount}
            onChange={(t) => p.onChange({ invoiceBankAccount: t })}
            autoCapitalize="characters"
          />
        )}
      </FormCard>

      <FormCard>
        <TextRow label="Ghi chú" value={form.comments} onChange={(t) => p.onChange({ comments: t })} multiline maxLength={1000} placeholder="Giờ nhận hàng, lưu ý khi giao…" />
      </FormCard>

      {!p.editing ? <Note text="Công nợ của khách mới mặc định là “Chuyển khoản ngay”. Đổi hình thức công nợ trên web." /> : null}
    </Page>
  );
}

export default function CustomerFormScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : null;
  const form = useCustomerDraft((s) => s.form);
  const baseline = useCustomerDraft((s) => s.baseline);
  const customerId = useCustomerDraft((s) => s.customerId);
  const user = useSession((s) => s.user);
  const branchId = useSession((s) => s.branchId);
  const perms = customerPerms(user);
  const qc = useQueryClient();
  const staff = useStaff(perms.assignSalePic);
  const [busy, setBusy] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [exit, setExit] = useState<{ go: () => void } | null>(null);
  // Đã chọn "Bỏ thay đổi": thôi chặn rời màn.
  const [discarding, setDiscarding] = useState(false);
  const busyRef = useRef(false);

  const editing = editId !== null;
  const valid = !!form && !!baseline && customerId === editId;
  const dirty = valid ? isFormDirty(form, baseline) : false;
  const hasChildren = editing ? !!qc.getQueryData<{ children?: unknown[] }>(['customer', editId])?.children?.length : false;

  // Sale PIC nằm trong chính sách công nợ: tải khi mở form sửa, tên lấy từ danh sách nhân viên.
  const salePic = useSalePicId(editId, editing && perms.assignSalePic);
  const picId = salePic.data ?? null;
  const staffList = staff.data;
  useEffect(() => {
    if (!picId || !staffList) return;
    const hit = staffList.find((u) => u.id === picId);
    setLoadedSalePic({ id: picId, name: hit?.name ?? `Nhân viên #${picId}` });
  }, [picId, staffList]);
  const salePicLoading = salePic.isLoading || (!!picId && staff.isLoading);

  // Phải gọi `repeat()` (tắt chặn rồi đi tiếp); tự dispatch lại hành động thì
  // màn vẫn đang bị chặn nên hộp hỏi hiện lại mãi.
  usePreventRemove(dirty && !exit && !discarding, ({ repeat }) => {
    Alert.alert('Bỏ thay đổi?', 'Những gì bạn đã nhập sẽ không được lưu.', [
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

  if (!valid || !form || !baseline) {
    return (
      <Page scroll={false} header={<SubHeader title="Khách hàng" />}>
        <EmptyState
          icon="users"
          color="slate"
          title="Không có khách đang nhập"
          message="Quay lại danh sách Khách hàng rồi bấm “+” để thêm hoặc mở khách rồi bấm “Sửa”."
        />
      </Page>
    );
  }

  const lookupTax = async () => {
    setLookingUp(true);
    try {
      const hit = await lookupTaxCode(form.taxCode);
      if (!hit) {
        toast.error('Không tìm thấy mã số thuế này');
        return;
      }
      patchCustomerDraft((f) => ({
        ...(f.type === 1 ? { organization: hit.name } : { invoiceBuyerName: hit.name }),
        invoiceAddress: hit.address || f.invoiceAddress,
        name: f.name.trim() ? f.name : hit.name,
      }));
      toast.success('Đã điền theo mã số thuế');
    } catch {
      toast.error('Chưa tra cứu được, kiểm tra mạng rồi thử lại');
    } finally {
      setLookingUp(false);
    }
  };

  const save = async () => {
    if (busyRef.current) return;
    const err = validateCustomerForm(form, { editing, requireSalePic: perms.assignSalePic });
    if (err) {
      Alert.alert('Chưa lưu được', err);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      if (editing && editId) {
        const body = buildCustomerUpdate(form, baseline, { assignSalePic: perms.assignSalePic });
        if (Object.keys(body).length) await updateCustomer(editId, body);
        toast.success(`Đã lưu ${form.name.trim()}`);
        await Promise.all([qc.invalidateQueries({ queryKey: ['customer'] }), qc.invalidateQueries({ queryKey: ['customers'] })]);
        setExit({ go: () => router.back() });
      } else {
        const created = await createCustomer(buildCustomerCreate(form, { branchId, assignSalePic: perms.assignSalePic }));
        toast.success(created?.code ? `Đã thêm ${created.code}` : 'Đã thêm khách hàng');
        void qc.invalidateQueries({ queryKey: ['customers'] });
        setExit({
          go: () =>
            created?.id
              ? router.replace({ pathname: '/khach-hang/[id]', params: { id: String(created.id) } } as never)
              : router.back(),
        });
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <CustomerFormView
      form={form}
      editing={editing}
      code={baseline.code}
      perms={perms}
      hasChildren={hasChildren}
      onChange={patchCustomerDraft}
      onPick={(t) => router.push(PICK_PATH[t] as never)}
      onAddress={(a) => {
        startAddressDraft(a ?? emptyAddress(form.addresses.length === 0, form.name.trim(), form.contactNumber.trim()));
        router.push(ADDRESS_PATH as never);
      }}
      onLookupTax={() => void lookupTax()}
      lookingUp={lookingUp}
      salePicLoading={salePicLoading}
      onSave={() => void save()}
      busy={busy}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  address: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50 },
  inlineLink: { alignSelf: 'flex-end', paddingBottom: 10, marginTop: -4 },
  lookup: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: C.brandSoft, minWidth: 64, alignItems: 'center' },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
});
