import { create } from 'zustand';
import { DEFAULT_DOC_FILTERS, type DocListFilters } from './model';

/** Bộ lọc danh sách đơn hàng / hóa đơn (giữ trong bộ nhớ khi mở sheet lọc / chi tiết). */
export const useDocFilters = create<{ filters: DocListFilters }>(() => ({ filters: DEFAULT_DOC_FILTERS }));

export const setDocFilters = (patch: Partial<DocListFilters>) =>
  useDocFilters.setState((s) => ({ filters: { ...s.filters, ...patch } }));
