import { create } from 'zustand';
import type { AddressForm, CustomerForm } from './form';

/**
 * Form thêm / sửa khách đang mở. Để trong store riêng để các sheet chọn
 * (khách cha, nhóm, Sale PIC, địa chỉ) ghi thẳng vào form.
 */
interface DraftState {
  form: CustomerForm | null;
  /** Lúc mở form: so sánh để biết đã đổi gì. */
  baseline: CustomerForm | null;
  /** Khách đang sửa; null = thêm mới. */
  customerId: number | null;
  /** Nơi mở form, để lưu xong hoặc quay lại đúng luồng. */
  origin: 'customers' | 'sale';
}

export const useCustomerDraft = create<DraftState>(() => ({
  form: null,
  baseline: null,
  customerId: null,
  origin: 'customers',
}));

export function startCustomerDraft(
  form: CustomerForm,
  customerId: number | null = null,
  origin: DraftState['origin'] = 'customers',
) {
  useCustomerDraft.setState({ form, baseline: form, customerId, origin });
}

export function patchCustomerDraft(patch: Partial<CustomerForm> | ((f: CustomerForm) => Partial<CustomerForm>)) {
  useCustomerDraft.setState((s) => {
    if (!s.form) return s;
    const next = typeof patch === 'function' ? patch(s.form) : patch;
    return { form: { ...s.form, ...next } };
  });
}

/**
 * Sale PIC tải xong sau khi mở form sửa: ghi vào mốc so sánh (và vào form nếu
 * người dùng chưa tự chọn) để không bị tính là "đã đổi".
 */
export function setLoadedSalePic(salePic: CustomerForm['salePic']) {
  useCustomerDraft.setState((s) => {
    if (!s.form || !s.baseline || s.baseline.salePic) return s;
    // Mốc chưa có Sale PIC: form chưa có nghĩa là người dùng chưa tự chọn.
    return { form: s.form.salePic ? s.form : { ...s.form, salePic }, baseline: { ...s.baseline, salePic } };
  });
}

/**
 * Địa chỉ đang mở trong màn sửa địa chỉ.
 * - `customerId` null: ghi vào form thêm / sửa khách (lưu cùng form).
 * - có `customerId`: lưu ngay vào khách đó (mở từ thẻ Địa chỉ ở chi tiết),
 *   `list` là danh sách địa chỉ hiện tại để gửi đủ lên backend.
 */
interface AddressDraftState {
  address: AddressForm | null;
  original: AddressForm | null;
  customerId: number | null;
  list: AddressForm[];
}

export const useAddressDraft = create<AddressDraftState>(() => ({ address: null, original: null, customerId: null, list: [] }));

export function startAddressDraft(address: AddressForm, target: { customerId: number; list: AddressForm[] } | null = null) {
  useAddressDraft.setState({ address, original: address, customerId: target?.customerId ?? null, list: target?.list ?? [] });
}

export function patchAddressDraft(patch: Partial<AddressForm>) {
  useAddressDraft.setState((s) => (s.address ? { address: { ...s.address, ...patch } } : s));
}

export const CUSTOMERS_PATH = '/khach-hang';
export const NEW_CUSTOMER_PATH = '/khach-hang/them';
export const EDIT_CUSTOMER_PATH = '/khach-hang/sua/[id]';
export const ADDRESS_PATH = '/khach-hang/dia-chi';
