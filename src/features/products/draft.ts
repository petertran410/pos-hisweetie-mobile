import { create } from 'zustand';
import type { ProductForm } from './form';

/**
 * Form thêm / sửa hàng đang mở. Để trong store riêng để các sheet chọn
 * (nhóm hàng, thương hiệu, đơn vị, thành phần) ghi thẳng vào form.
 */
interface DraftState {
  form: ProductForm | null;
  /** Lúc mở form: so sánh để biết đã đổi gì. */
  baseline: ProductForm | null;
  /** Hàng đang sửa; null = thêm mới. */
  productId: number | null;
}

export const useProductDraft = create<DraftState>(() => ({ form: null, baseline: null, productId: null }));

export function startDraft(form: ProductForm, productId: number | null = null) {
  useProductDraft.setState({ form, baseline: form, productId });
}

export function patchDraft(patch: Partial<ProductForm> | ((f: ProductForm) => Partial<ProductForm>)) {
  useProductDraft.setState((s) => {
    if (!s.form) return s;
    const next = typeof patch === 'function' ? patch(s.form) : patch;
    return { form: { ...s.form, ...next } };
  });
}

export const NEW_PRODUCT_PATH = '/hang-hoa/them';
export const EDIT_PRODUCT_PATH = '/hang-hoa/sua/[id]';
