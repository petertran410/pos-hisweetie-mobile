import { useOrderEditCart, useOrderEditMeta } from '../orders/editScope';
import { cartSnapshot } from '../sales/cart';
import { pauseCartPersistence, resumeCartPersistence } from '../sales/persist';

/**
 * Trang xem trước dùng chung store với app thật (giỏ bán hàng, đơn nháp, đơn
 * đang xử lý) để nạp dữ liệu mẫu. Mở trang: ngừng lưu giỏ xuống máy và nhớ đơn
 * đang xử lý. Hàm trả về chạy khi rời trang: trả đơn đang xử lý như cũ và đọc
 * lại đơn nháp đã lưu, để dữ liệu mẫu không lẫn vào giỏ thật.
 */
export function enterPreviewSandbox(): () => void {
  pauseCartPersistence();
  const editCart = cartSnapshot(useOrderEditCart.getState());
  const editMeta = useOrderEditMeta.getState().meta;
  return () => {
    useOrderEditCart.getState().load(editCart);
    useOrderEditMeta.setState({ meta: editMeta });
    void resumeCartPersistence();
  };
}
