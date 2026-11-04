import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { C, Divider, Select, SheetHeader } from '@/ui';
import { FormCard, TextRow } from '../products/formParts';
import { addressToDelivery, type CustomerAddress, type Delivery, type SaleCustomer } from './cart';
import { useSaleScope, useScopedCart } from './scope';

const addressLine = (a: CustomerAddress) =>
  [a.address, a.newWardName || a.wardName, a.newCityName || a.locationName || a.cityName].filter(Boolean).join(', ');

/** Sửa thông tin giao hàng; khách có nhiều địa chỉ thì chọn nhanh trong danh sách. */
export function DeliveryView({
  customer,
  initial,
  onSave,
}: {
  customer: SaleCustomer | null;
  initial: Delivery;
  onSave: (d: Delivery) => void;
}) {
  const [d, setD] = useState(initial);
  const set = (patch: Partial<Delivery>) => setD((prev) => ({ ...prev, ...patch }));
  const addresses = customer?.addresses ?? [];
  const current = customer
    ? addresses.find((a) => {
        const picked = addressToDelivery(customer, a);
        return picked.address === d.address && picked.receiver === d.receiver;
      })
    : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Giao hàng" actionLabel="Lưu" onAction={() => onSave(d)} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets>
        {customer && addresses.length > 1 ? (
          <Select
            variant="field"
            label="Địa chỉ của khách"
            placeholder="Chọn địa chỉ đã lưu"
            options={addresses.map((a) => ({
              value: a.id,
              label: `${a.label || a.receiver || customer.name}${a.isDefault ? ' · Mặc định' : ''}`,
              sub: addressLine(a) || 'Chưa có địa chỉ',
            }))}
            value={current?.id ?? null}
            onChange={(id) => {
              const a = addresses.find((x) => x.id === id);
              if (a) setD({ ...addressToDelivery(customer, a), noteForDriver: d.noteForDriver });
            }}
          />
        ) : null}

        <FormCard title="Người nhận">
          <TextRow label="Tên" value={d.receiver} onChange={(t) => set({ receiver: t })} textContentType="name" placeholder="Người nhận hàng" />
          <Divider />
          <TextRow
            label="Điện thoại"
            value={d.contactNumber}
            onChange={(t) => set({ contactNumber: t })}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            placeholder="Số liên hệ"
          />
        </FormCard>

        <FormCard title="Địa chỉ giao">
          <TextRow label="Địa chỉ" value={d.address} onChange={(t) => set({ address: t })} textContentType="fullStreetAddress" placeholder="Số nhà, đường" />
          <Divider />
          <TextRow label="Phường / xã" value={d.wardName} onChange={(t) => set({ wardName: t })} />
          <Divider />
          <TextRow label="Tỉnh / TP" value={d.locationName} onChange={(t) => set({ locationName: t })} />
        </FormCard>

        <FormCard>
          <TextRow
            label="Ghi chú cho tài xế"
            value={d.noteForDriver}
            onChange={(t) => set({ noteForDriver: t })}
            placeholder="Không bắt buộc"
            maxLength={1000}
            multiline
          />
        </FormCard>
      </ScrollView>
    </View>
  );
}

export default function DeliveryScreen() {
  const { store } = useSaleScope();
  const customer = useScopedCart((s) => s.customer);
  const delivery = useScopedCart((s) => s.delivery);
  return (
    <DeliveryView
      customer={customer}
      initial={delivery}
      onSave={(d) => {
        store.getState().setDelivery({
          ...d,
          receiver: d.receiver.trim(),
          contactNumber: d.contactNumber.trim(),
          address: d.address.trim(),
          noteForDriver: d.noteForDriver.trim(),
        });
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 18, paddingBottom: 40 },
});
