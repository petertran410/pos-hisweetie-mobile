import { create } from 'zustand';
import { DEFAULT_PACK_FILTERS, type PackFilters } from './model';

/** Bộ lọc danh sách báo đơn (giữ trong bộ nhớ khi mở sheet lọc / chi tiết). */
export const usePackFilters = create<{ filters: PackFilters }>(() => ({ filters: DEFAULT_PACK_FILTERS }));

export const setPackFilters = (patch: Partial<PackFilters>) => usePackFilters.setState((s) => ({ filters: { ...s.filters, ...patch } }));
