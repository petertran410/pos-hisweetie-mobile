import { createContext, useContext } from 'react';

/**
 * Nơi chứa form thêm / sửa khách và các sheet chọn của form:
 * - `/khach-hang`: trong tab Khách hàng.
 * - `/sua-khach`: phủ lên trên màn đang làm (giỏ hàng, xử lý đơn, chi tiết
 *   đơn) để sửa hồ sơ khách xong bấm quay lại là về đúng chỗ.
 */
export type CustomerFormBase = '/khach-hang' | '/sua-khach';

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
