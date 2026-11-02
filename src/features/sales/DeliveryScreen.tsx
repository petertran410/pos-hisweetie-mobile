import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { C, Icon, PressableScale, SheetHeader, TextField, Txt } from '@/ui';
import { addressToDelivery, type CustomerAddress, type Delivery, type SaleCustomer } from './cart';
import { useSaleScope, useScopedCart } from './scope';

const addressLine = (a: CustomerAddress) =>
  [a.address, a.newWardName || a.wardName, a.newCityName || a.locationName || a.cityName].filter(Boolean).join(', ');

/** Sửa thông tin giao hàng; khách có nhiều địa chỉ thì chọn nhanh. */
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

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Giao hàng" actionLabel="Lưu" onAction={() => onSave(d)} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets>
        {customer && addresses.length > 1 ? (
          <View style={{ gap: 8 }}>
            <Txt variant="label" weight="semibold">
              Địa chỉ của khách
            </Txt>
            {addresses.map((a) => {
              const picked = addressToDelivery(customer, a);
              const on = picked.address === d.address && picked.receiver === d.receiver;
              return (
                <PressableScale
                  key={a.id}
                  onPress={() => setD({ ...picked, noteForDriver: d.noteForDriver })}
                  haptic="selection"
                  accessibilityLabel={`${a.label ?? 'Địa chỉ'}: ${addressLine(a)}`}
                  scaleTo={0.98}
                  style={[styles.address, on ? styles.addressOn : null]}>
                  <Icon name={on ? 'circle-check' : 'store'} size={20} color={on ? C.brand : C.muted} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="body" weight="semibold" numberOfLines={1}>
                      {a.label || a.receiver || customer.name}
                      {a.isDefault ? ' · Mặc định' : ''}
                    </Txt>
                    <Txt variant="caption" color={C.muted} numberOfLines={2}>
                      {addressLine(a) || 'Chưa có địa chỉ'}
                    </Txt>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        ) : null}

        <TextField label="Người nhận" value={d.receiver} onChangeText={(t) => set({ receiver: t })} textContentType="name" />
        <TextField
          label="Số điện thoại"
          value={d.contactNumber}
          onChangeText={(t) => set({ contactNumber: t })}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
        />
        <TextField
          label="Địa chỉ"
          value={d.address}
          onChangeText={(t) => set({ address: t })}
          textContentType="fullStreetAddress"
          multiline
        />
        <TextField label="Phường / xã" value={d.wardName} onChangeText={(t) => set({ wardName: t })} />
        <TextField label="Tỉnh / thành phố" value={d.locationName} onChangeText={(t) => set({ locationName: t })} />
        <TextField
          label="Ghi chú cho tài xế"
          value={d.noteForDriver}
          onChangeText={(t) => set({ noteForDriver: t })}
          placeholder="Không bắt buộc"
          maxLength={1000}
          multiline
        />
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
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  address: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  addressOn: { borderColor: C.brand, borderWidth: 1.5 },
});
