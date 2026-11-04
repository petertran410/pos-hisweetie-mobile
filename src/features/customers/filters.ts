import { create } from 'zustand';
import { DEFAULT_FILTERS, type CustomerFilters } from './model';

/** Bộ lọc danh sách khách hàng (giữ trong bộ nhớ khi mở sheet lọc / chi tiết). */
export const useCustomerFilters = create<{ filters: CustomerFilters }>(() => ({ filters: DEFAULT_FILTERS }));

export const setCustomerFilters = (patch: Partial<CustomerFilters>) =>
  useCustomerFilters.setState((s) => ({ filters: { ...s.filters, ...patch } }));
