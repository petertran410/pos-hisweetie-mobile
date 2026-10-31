import { canDo } from '@/core/can';
import { useSession } from '@/core/session';

/**
 * Quyền bán hàng (giống web POS). Các quyền `pos_*` chỉ được kiểm ở giao
 * diện, backend không chặn — app phải tự ẩn/khóa.
 */
export function useSalePerms() {
  const user = useSession((s) => s.user);
  const can = (p: string) => canDo(user, p);
  return {
    order: can('orders:create'),
    invoice: can('invoices:create'),
    products: can('products:view'),
    customers: can('customers:view'),
    priceBooks: can('price_books:view'),
    editPrice: can('pos_price:update'),
    editDiscount: can('pos_discount:update'),
    viewStock: can('pos_inventory:view'),
    viewPayment: can('pos_payment:view'),
    editPayment: can('pos_payment:update'),
    viewDebt: can('customers:view_debt'),
    print: can('print_templates:view'),
  };
}

export type SalePerms = ReturnType<typeof useSalePerms>;
