import { createContext, useContext, type ComponentType } from 'react';
import { Alert } from 'react-native';
import { create } from 'zustand';
import { createCartStore, type CartState } from '../sales/cart';
import { SaleScopeProvider, type SaleScope } from '../sales/scope';
import { editChanges, type OrderEditMeta } from './editOrder';

/** Giỏ riêng của đơn đang xử lý (không đụng giỏ của tab Bán hàng). */
export const useOrderEditCart = createCartStore();

/** Thông tin đơn đang xử lý; null khi chưa mở đơn nào. */
export const useOrderEditMeta = create<{ meta: OrderEditMeta | null }>(() => ({ meta: null }));

/**
 * Nơi chứa các màn chứng từ (chi tiết, xử lý đơn, tạo hóa đơn, in phiếu):
 * tab Đơn hàng, tab Khách hàng (mở từ lịch sử của khách) và mục Hàng hóa (mở
 * từ thẻ kho) đều có đủ các màn này, để thao tác xong bấm quay lại vẫn về đúng
 * chỗ đã mở.
 */
export type DocBase = '/don-hang' | '/khach-hang' | '/hang-hoa' | '/bao-don';

function makeScope(base: DocBase): SaleScope {
  return {
    store: useOrderEditCart,
    editing: true,
    paths: {
      cart: `${base}/xu-ly`,
      customer: `${base}/xu-ly/khach-hang`,
      line: `${base}/xu-ly/dong/[rowId]`,
      delivery: `${base}/xu-ly/giao-hang`,
      discount: `${base}/xu-ly/giam-gia`,
      priceBook: `${base}/xu-ly/bang-gia`,
      scan: `${base}/xu-ly/quet-ma`,
    },
  };
}

export const ORDER_EDIT_SCOPE = makeScope('/don-hang');
const SCOPES: Record<DocBase, SaleScope> = {
  '/don-hang': ORDER_EDIT_SCOPE,
  '/khach-hang': makeScope('/khach-hang'),
  '/hang-hoa': makeScope('/hang-hoa'),
  '/bao-don': makeScope('/bao-don'),
};

const DocBaseContext = createContext<DocBase>('/don-hang');

/** Đặt ở ngăn xếp (tab / mục) để các màn chứng từ bên trong dùng đường dẫn của nơi đó. */
export const DocBaseProvider = DocBaseContext.Provider;

export function docRoutes(base: DocBase) {
  return {
    /** Có tham số `[kind]`, `[id]`. */
    detail: base === '/don-hang' ? '/don-hang/[kind]/[id]' : `${base}/chung-tu/[kind]/[id]`,
    edit: `${base}/xu-ly`,
    editPicker: `${base}/xu-ly/them-hang`,
    invoiceDraft: `${base}/tao-hoa-don`,
    print: `${base}/phieu-in`,
  };
}

/** Đường dẫn các màn chứng từ trong tab đang mở. */
export function useDocRoutes() {
  return docRoutes(useContext(DocBaseContext));
}

/** Số màn "Xử lý đơn" đang mở (mỗi nơi có thể mở 1 màn). */
let openEdits = 0;

/** Gọi khi màn xử lý đơn mở; trả về hàm gọi khi màn đóng. */
export function markEditOpen() {
  openEdits += 1;
  return () => {
    openEdits -= 1;
  };
}

/**
 * Giỏ xử lý đơn dùng chung cho tab Đơn hàng và tab Khách hàng. Nếu đang sửa dở
 * 1 đơn (màn xử lý còn mở ở tab kia, chưa lưu) thì hỏi trước khi mở đơn khác.
 */
export function confirmReplaceEdit(): Promise<boolean> {
  const meta = useOrderEditMeta.getState().meta;
  const dirty = openEdits > 0 && !!meta && editChanges(useOrderEditCart.getState(), meta.original).any;
  if (!dirty || !meta) return Promise.resolve(true);
  return new Promise((resolve) => {
    Alert.alert(
      `Đang xử lý dở ${meta.code}`,
      `${meta.kind === 'invoice' ? 'Hóa đơn' : 'Đơn'} ${meta.code} đang sửa ở màn khác và chưa lưu. Mở cái này sẽ bỏ các thay đổi đó.`,
      [
        { text: 'Hủy bỏ', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Bỏ và mở', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** Nạp đơn vừa tải vào giỏ xử lý đơn. */
export function startOrderEdit(cart: CartState, meta: OrderEditMeta) {
  useOrderEditCart.getState().load(cart);
  useOrderEditMeta.setState({ meta });
}

/** Cho 1 màn bán hàng (chọn khách, sửa dòng...) làm việc trên đơn đang xử lý. */
export function withOrderEdit<P extends object>(Screen: ComponentType<P>) {
  function OrderEditScoped(props: P) {
    const base = useContext(DocBaseContext);
    return (
      <SaleScopeProvider value={SCOPES[base]}>
        <Screen {...props} />
      </SaleScopeProvider>
    );
  }
  return OrderEditScoped;
}
