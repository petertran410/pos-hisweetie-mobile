import { useQueryClient } from '@tanstack/react-query';
import { router, usePreventRemove } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '@/core/http';
import { Button, C, Divider, EmptyState, Icon, PressableScale, radius, SheetHeader, toast, Txt } from '@/ui';
import { FormCard, PickRow, SwitchRow, TextRow } from '../products/formParts';
import { updateCustomer } from './api';
import { patchAddressDraft, patchCustomerDraft, useAddressDraft, useCustomerDraft } from './draft';
import { OLD_ADDRESS_CLEARED, removeAddress, toAddressPayload, upsertAddress, validateAddress, type AddressForm } from './form';
import { useCustomerFormPaths } from './formPaths';

/** Cấp địa giới để chọn: tỉnh / xã mới (2 cấp), tỉnh / huyện / xã cũ (3 cấp). */
export type PlaceLevel = 'newCity' | 'newWard' | 'oldCity' | 'district' | 'oldWard';

const hasOld = (a: AddressForm) => !!(a.cityCode || a.cityName || a.districtName || a.wardName || a.locationName);
const hasNew = (a: AddressForm) => !!(a.newCityCode || a.newCityName);

function ClearLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} hitSlop={6} scaleTo={0.95} accessibilityRole="button" style={styles.clear}>
      <Txt variant="label" weight="semibold" color={C.brand}>
        {label}
      </Txt>
    </PressableScale>
  );
}

export interface AddressFormViewProps {
  address: AddressForm;
  isNew: boolean;
  /** Địa chỉ đang là mặc định từ trước: không tắt được (phải chọn địa chỉ khác làm mặc định). */
  lockedDefault: boolean;
  onChange: (patch: Partial<AddressForm>) => void;
  onPick: (level: PlaceLevel) => void;
  onSave: () => void;
  onDelete?: () => void;
  onCancel?: () => void;
  busy?: boolean;
}

export function AddressFormView(p: AddressFormViewProps) {
  const { address: a } = p;
  const insets = useSafeAreaInsets();
  // Địa chỉ cũ: mở sẵn khi đã có, không thì thu gọn (giống web).
  const [showOld, setShowOld] = useState(() => hasOld(a));
  const oldCity = a.cityName || (a.cityCode ? '' : (a.locationName ?? ''));
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader
        title={p.isNew ? 'Thêm địa chỉ' : 'Sửa địa chỉ'}
        onCancel={p.onCancel}
        actionLabel={p.busy ? 'Đang lưu…' : 'Lưu'}
        onAction={p.onSave}
        actionDisabled={p.busy}
      />
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <FormCard title="Người nhận">
          <TextRow label="Tên gợi nhớ" value={a.label ?? ''} onChange={(t) => p.onChange({ label: t })} placeholder="VD: Kho, Cửa hàng 2" />
          <Divider />
          <TextRow label="Người nhận" value={a.receiver ?? ''} onChange={(t) => p.onChange({ receiver: t })} autoCapitalize="words" />
          <Divider />
          <TextRow label="Điện thoại" value={a.contactNumber ?? ''} onChange={(t) => p.onChange({ contactNumber: t })} keyboardType="phone-pad" />
        </FormCard>

        <FormCard title="Địa chỉ mới" hint="Theo đơn vị hành chính sau sáp nhập (2 cấp).">
          <TextRow label="Số nhà, đường" value={a.address ?? ''} onChange={(t) => p.onChange({ address: t })} placeholder="Bắt buộc" />
          <Divider />
          <PickRow label="Tỉnh / thành" value={a.newCityName ?? ''} placeholder="Chọn" onPress={() => p.onPick('newCity')} />
          <Divider />
          <PickRow
            label="Phường / xã"
            value={a.newWardName ?? ''}
            placeholder={a.newCityCode ? 'Chọn' : 'Chọn tỉnh trước'}
            onPress={a.newCityCode ? () => p.onPick('newWard') : undefined}
          />
          {hasNew(a) && hasOld(a) ? (
            <ClearLink
              label="Bỏ địa chỉ mới"
              onPress={() => p.onChange({ newCityCode: null, newCityName: null, newWardCode: null, newWardName: null })}
            />
          ) : null}
        </FormCard>

        <View style={{ gap: 8 }}>
          <PressableScale
            onPress={() => setShowOld((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showOld }}
            accessibilityLabel="Địa chỉ cũ, trước sáp nhập"
            scaleTo={0.98}
            style={styles.oldHead}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="heading">Địa chỉ cũ</Txt>
              <Txt variant="caption" color={C.muted}>
                Trước sáp nhập (tỉnh, quận / huyện, phường / xã). {hasNew(a) ? 'Không bắt buộc.' : 'Dùng khi chưa có địa chỉ mới.'}
              </Txt>
            </View>
            <View style={{ transform: [{ rotate: showOld ? '180deg' : '0deg' }] }}>
              <Icon name="chevron-down" size={20} color={C.muted} />
            </View>
          </PressableScale>
          {showOld ? (
            <View style={styles.card}>
              <PickRow label="Tỉnh / thành" value={oldCity} placeholder="Chọn" onPress={() => p.onPick('oldCity')} />
              <Divider />
              <PickRow
                label="Quận / huyện"
                value={a.districtName ?? ''}
                placeholder={a.cityCode ? 'Chọn' : 'Chọn tỉnh trước'}
                onPress={a.cityCode ? () => p.onPick('district') : undefined}
              />
              <Divider />
              <PickRow
                label="Phường / xã"
                value={a.wardName ?? ''}
                placeholder={a.districtCode ? 'Chọn' : 'Chọn quận / huyện trước'}
                onPress={a.cityCode && a.districtCode ? () => p.onPick('oldWard') : undefined}
              />
              {hasOld(a) ? <ClearLink label="Bỏ địa chỉ cũ" onPress={() => p.onChange(OLD_ADDRESS_CLEARED)} /> : null}
            </View>
          ) : null}
        </View>

        <FormCard>
          <SwitchRow
            label="Địa chỉ mặc định"
            sub={p.lockedDefault ? 'Muốn đổi, hãy đặt địa chỉ khác làm mặc định.' : 'Chọn sẵn khi lên đơn cho khách.'}
            value={!!a.isDefault}
            onChange={(v) => {
              if (!p.lockedDefault) p.onChange({ isDefault: v });
            }}
          />
        </FormCard>

        {p.onDelete ? <Button title="Xóa địa chỉ" icon="trash" variant="danger" size="medium" onPress={p.onDelete} /> : null}
      </ScrollView>
    </View>
  );
}

export default function AddressFormScreen() {
  const address = useAddressDraft((s) => s.address);
  const original = useAddressDraft((s) => s.original);
  const customerId = useAddressDraft((s) => s.customerId);
  const list = useAddressDraft((s) => s.list);
  const formAddresses = useCustomerDraft((s) => s.form?.addresses);
  const paths = useCustomerFormPaths();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const dirty = !!address && !!original && JSON.stringify(toAddressPayload(address)) !== JSON.stringify(toAddressPayload(original));
  usePreventRemove(dirty && !done && !discarding, ({ repeat }) => {
    Alert.alert('Bỏ thay đổi địa chỉ?', 'Những gì bạn đã nhập sẽ không được lưu.', [
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
    if (done) router.back();
  }, [done]);

  if (!address || !original) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SheetHeader title="Địa chỉ" />
        <EmptyState icon="map-pin" color="slate" title="Không có địa chỉ đang sửa" message="Quay lại rồi mở địa chỉ cần sửa." />
      </View>
    );
  }

  // Ghi vào form (thêm / sửa khách) hay lưu thẳng vào khách (từ màn chi tiết).
  const source = customerId ? list : (formAddresses ?? []);
  const isNew = !source.some((x) => x.key === address.key);
  const lockedDefault = !isNew && !!original.isDefault;

  const commit = (next: AddressForm[], message: string) => {
    if (!customerId) {
      patchCustomerDraft({ addresses: next });
      setDone(true);
      return;
    }
    setBusy(true);
    updateCustomer(customerId, { addresses: next.map(toAddressPayload) })
      .then(async () => {
        toast.success(message);
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['customer', customerId] }),
          qc.invalidateQueries({ queryKey: ['customers'] }),
        ]);
        setDone(true);
      })
      .catch((e: unknown) => toast.error(errorMessage(e)))
      .finally(() => setBusy(false));
  };

  return (
    <AddressFormView
      address={address}
      isNew={isNew}
      lockedDefault={lockedDefault}
      onChange={patchAddressDraft}
      onPick={(level) => router.push(paths[level] as never)}
      busy={busy}
      onSave={() => {
        if (busy) return;
        const err = validateAddress(address);
        if (err) {
          Alert.alert('Chưa lưu được', err);
          return;
        }
        // Địa chỉ đầu tiên luôn là mặc định.
        const a = source.length === 0 ? { ...address, isDefault: true } : address;
        commit(upsertAddress(source, a), isNew ? 'Đã thêm địa chỉ' : 'Đã lưu địa chỉ');
      }}
      onDelete={
        !isNew && source.length > 1
          ? () =>
              Alert.alert('Xóa địa chỉ này?', undefined, [
                { text: 'Hủy bỏ', style: 'cancel' },
                { text: 'Xóa', style: 'destructive', onPress: () => commit(removeAddress(source, address.key), 'Đã xóa địa chỉ') },
              ])
          : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 18 },
  card: {
    backgroundColor: C.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    paddingHorizontal: 14,
  },
  oldHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  clear: { alignSelf: 'flex-end', paddingTop: 2, paddingBottom: 12 },
});
