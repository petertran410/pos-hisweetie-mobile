import { createContext, useContext } from 'react';

/**
 * Nơi chứa form thêm / sửa khách và các sheet chọn của form:
 * - `/khach-hang`: trong tab Khách hàng.
 * - `/sua-khach`: phủ lên trên màn đang làm (giỏ hàng, xử lý đơn, chi tiết
 *   đơn) để sửa hồ sơ khách xong bấm quay lại là về đúng chỗ.
 * - `/xem-khach`: chi tiết khách mở từ giỏ hàng (phủ lên trên giỏ), có đủ
 *   form sửa, sửa địa chỉ và các sheet chọn như tab Khách hàng.
 */
export type CustomerFormBase = '/khach-hang' | '/sua-khach' | '/xem-khach';

const BaseContext = createContext<CustomerFormBase>('/khach-hang');

/** Đặt ở ngăn xếp chứa form để các màn bên trong mở sheet chọn của chính ngăn đó. */
export const CustomerFormBaseProvider = BaseContext.Provider;

export function customerFormPaths(base: CustomerFormBase) {
  return {
    address: `${base}/dia-chi`,
    parent: `${base}/chon-cha`,
    groups: `${base}/chon-nhom`,
    salePic: `${base}/chon-sale`,
    newCity: `${base}/chon-tinh`,
    newWard: `${base}/chon-xa`,
    oldCity: `${base}/chon-tinh-cu`,
    district: `${base}/chon-huyen`,
    oldWard: `${base}/chon-xa-cu`,
  };
}

/** Đường dẫn các sheet của form khách trong ngăn xếp đang mở. */
export function useCustomerFormPaths() {
  return customerFormPaths(useContext(BaseContext));
}

/** Ngăn xếp đang chứa màn khách (tab Khách hàng / phủ lên giỏ hàng...). */
export function useCustomerFormBase() {
  return useContext(BaseContext);
}

/**
 * Mở chi tiết khách phủ lên màn đang làm (ngăn `/xem-khach`). `from`: màn mở
 * nó, để cập nhật theo hồ sơ khách mới tải — giỏ bán hàng (`sale`), đơn /
 * hóa đơn đang xử lý (`edit`) hoặc chi tiết chứng từ (`doc`, tải lại chứng từ).
 */
export function customerViewHref(id: number, from: 'sale' | 'edit' | 'doc' = 'sale') {
  const gio = from === 'edit' ? 'xu-ly' : from === 'doc' ? 'chung-tu' : null;
  return { pathname: '/xem-khach/[id]', params: gio ? { id: String(id), gio } : { id: String(id) } };
}

/** Các màn mở từ chi tiết khách, trong ngăn đang chứa màn chi tiết. */
export function customerDetailPaths(base: CustomerFormBase) {
  return {
    /** Có tham số `[id]`. */
    detail: `${base}/[id]`,
    /** Có tham số `[id]`. */
    edit: `${base}/sua/[id]`,
    /** Có tham số `[id]`. */
    collect: `${base}/thu-no/[id]`,
  };
}
