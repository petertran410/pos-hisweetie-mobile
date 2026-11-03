import { create } from 'zustand';
import { DEFAULT_FILTERS, type ProductFilters } from './model';

/** Bộ lọc danh sách hàng hóa (giữ trong bộ nhớ khi mở sheet lọc / chi tiết). */
export const useProductFilters = create<{ filters: ProductFilters }>(() => ({ filters: DEFAULT_FILTERS }));

export const setProductFilters = (patch: Partial<ProductFilters>) =>
  useProductFilters.setState((s) => ({ filters: { ...s.filters, ...patch } }));
