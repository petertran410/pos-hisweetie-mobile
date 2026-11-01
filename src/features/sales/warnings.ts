export interface StockShortage {
  name: string;
  have?: string;
  need?: string;
}

/**
 * Cảnh báo thiếu hàng của backend khi tạo đơn đặt hàng:
 * "Sản phẩm <tên> không đủ tồn kho (Có: 0, Cần: 1)". Dạng lạ thì giữ nguyên câu.
 */
export function parseStockWarning(text: string): StockShortage {
  const m = text.trim().match(/^Sản phẩm (.+) không đủ tồn kho \(Có: ([^,]+), Cần: ([^)]+)\)$/);
  if (!m) return { name: text.trim() };
  return { name: m[1].trim(), have: m[2].trim(), need: m[3].trim() };
}
