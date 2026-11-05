import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { http } from '@/core/http';
import { useSession } from '@/core/session';
import {
  CONDITION_TX_LABELS,
  LOG_PAGE_SIZE,
  num,
  PAGE_SIZE,
  productListQuery,
  toConditionSummary,
  toProductRow,
  toStockMove,
  type CategoryLevel,
  type ConditionBucket,
  type ProductFilters,
  type RawComponentProduct,
  type RawProduct,
  type RawStockLog,
} from './model';

// ---------- Danh sách ----------

interface RawPage {
  data: RawProduct[];
  total: number;
}

export function useProductList(search: string, filters: ProductFilters, canViewCost: boolean, enabled: boolean) {
  const branchId = useSession((s) => s.branchId);
  return useInfiniteQuery({
    queryKey: ['products', branchId, search, filters, canViewCost],
    enabled,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const res = await http.get<RawPage>('/products', productListQuery(search, filters, branchId, pageParam, canViewCost));
      return {
        page: pageParam,
        total: num(res.total),
        rows: (res.data ?? []).map((p) => toProductRow(p, branchId)),
      };
    },
    getNextPageParam: (last) => (last.page * PAGE_SIZE < last.total ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

// ---------- Chi tiết ----------

/** Dữ liệu gốc (đổi sang dạng hiển thị theo chi nhánh ở màn chi tiết / form sửa). */
export function useProductDetail(id: number, enabled = true) {
  return useQuery({
    queryKey: ['product', id],
    enabled: enabled && Number.isFinite(id) && id > 0,
    queryFn: async () => {
      const raw = await http.get<RawProduct | null>(`/products/${id}`);
      if (!raw) throw new Error('Không tìm thấy hàng hóa');
      return raw;
    },
    staleTime: 15_000,
  });
}

interface RawLogPage {
  data: RawStockLog[];
  total: number;
}

/** Thẻ kho của 1 chi nhánh, tải dần. */
export function useStockCard(productId: number, branchId: number | null, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['product-logs', productId, branchId],
    enabled: enabled && productId > 0,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const res = await http.get<RawLogPage>(`/products/${productId}/inventory-logs`, {
        branchId: branchId ?? undefined,
        page: pageParam,
        limit: LOG_PAGE_SIZE,
      });
      return { page: pageParam, total: num(res.total), rows: (res.data ?? []).map((r) => toStockMove(r)) };
    },
    getNextPageParam: (last) => (last.page * LOG_PAGE_SIZE < last.total ? last.page + 1 : undefined),
    staleTime: 15_000,
  });
}

/** Tồn theo loại (tốt / bục rách / cận date / khuyến mãi), đọc từ sổ cái. */
export function useConditionSummary(productId: number, branchId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['product-condition', productId, branchId],
    enabled: enabled && productId > 0 && !!branchId,
    queryFn: async () => toConditionSummary(await http.get(`/products/${productId}/condition-summary`, { branchId })),
    staleTime: 15_000,
  });
}

/** Lịch sử 1 loại tồn, tải dần. */
export function useConditionLogs(productId: number, bucket: ConditionBucket, branchId: number | null, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['product-condition-logs', productId, bucket, branchId],
    enabled: enabled && productId > 0 && !!branchId,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const res = await http.get<RawLogPage>(`/products/${productId}/condition-logs`, {
        bucket,
        branchId: branchId ?? undefined,
        page: pageParam,
        limit: LOG_PAGE_SIZE,
      });
      return {
        page: pageParam,
        total: num(res.total),
        rows: (res.data ?? []).map((r) => toStockMove(r, CONDITION_TX_LABELS)),
      };
    },
    getNextPageParam: (last) => (last.page * LOG_PAGE_SIZE < last.total ? last.page + 1 : undefined),
    staleTime: 15_000,
  });
}

// ---------- Danh mục ----------

export interface NamedItem {
  id: number;
  name: string;
}

const toNamed = (list: unknown): NamedItem[] =>
  (Array.isArray(list) ? (list as (Partial<NamedItem> | null)[]) : [])
    .filter((x): x is NamedItem => typeof x?.id === 'number' && typeof x?.name === 'string')
    .map((x) => ({ id: x.id, name: x.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

/** Nhóm hàng 1 cấp (Loại hàng / Nguồn gốc / Danh mục). */
export function useCategories(level: CategoryLevel, enabled: boolean) {
  return useQuery({
    queryKey: ['categories', level],
    enabled,
    queryFn: async () => toNamed(await http.get('/categories', { type: level })),
    staleTime: 5 * 60_000,
  });
}

export function useTrademarks(enabled: boolean) {
  return useQuery({
    queryKey: ['trademarks'],
    enabled,
    queryFn: async () => toNamed(await http.get('/trademarks')),
    staleTime: 5 * 60_000,
  });
}

/** Đơn vị tính đang dùng (không cần quyền riêng). */
export function useUnits(enabled: boolean) {
  return useQuery({
    queryKey: ['units'],
    enabled,
    queryFn: async () => toNamed(await http.get('/units')),
    staleTime: 5 * 60_000,
  });
}

/** Tìm hàng làm thành phần (combo / hàng sản xuất): bỏ combo, bỏ chính nó. */
export function useComponentSearch(search: string, excludeId: number | null, enabled: boolean) {
  const branchId = useSession((s) => s.branchId);
  return useQuery({
    queryKey: ['product-components', branchId, search],
    enabled,
    queryFn: async () => {
      const res = await http.get<RawPage>('/products', {
        page: 1,
        limit: 30,
        search: search || undefined,
        branchId: branchId ?? undefined,
        isActive: true,
        types: '2,3,4',
      });
      return res.data ?? [];
    },
    select: (list: RawComponentProduct[]) => list.filter((p) => p.id !== excludeId),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

// ---------- Thao tác ----------

/** Ngừng hoạt động / kích hoạt lại (chỉ gửi trạng thái). */
export const setProductActive = (id: number, isActive: boolean) => http.put<unknown>(`/products/${id}`, { isActive });

export const createProduct = (body: Record<string, unknown>) => http.post<{ id: number; code: string }>('/products', body);

export const updateProduct = (id: number, body: Record<string, unknown>) => http.put<{ id: number; code: string }>(`/products/${id}`, body);

/** Tải 1 ảnh lên máy chủ, trả về đường dẫn ảnh. */
export async function uploadProductImage(uri: string, index: number): Promise<string> {
  const ext = /\.(png|webp|heic|heif)$/i.exec(uri)?.[1]?.toLowerCase();
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'heic' || ext === 'heif' ? 'image/heic' : 'image/jpeg';
  const form = new FormData();
  // React Native gửi file theo { uri, name, type }.
  form.append('file', { uri, name: `product-${Date.now()}-${index}.${ext ?? 'jpg'}`, type } as unknown as Blob);
  const res = await http.upload<{ url?: string }>('/upload/image?subfolder=products', form);
  if (!res?.url) throw new Error('Tải ảnh lên không thành công');
  return res.url;
}

export const createCategory = (name: string, type: CategoryLevel) => http.post<NamedItem>('/categories', { name, type });
export const createTrademark = (name: string) => http.post<NamedItem>('/trademarks', { name });
export const createUnit = (name: string) => http.post<NamedItem>('/units', { name });
