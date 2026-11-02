// Dữ liệu MẪU cho trang xem trước khi dev (không phải dữ liệu thật).
import type { Branch } from '@/core/session';
import type { DashboardData } from '../dashboard/DashboardView';
import type { TaskRow } from '../dashboard/api';
import type { DocDetail, DocRow } from '../orders/api';
import type { BankAccount } from '../sales/api';
import type { SaleCustomer, SaleProduct } from '../sales/cart';
import type { SalePerms } from '../sales/perms';
import { toOrderEdit, type RawOrderForEdit } from '../orders/editOrder';
import { toInvoiceDraft, type InvoiceDraft } from '../orders/fromOrder';

export const sampleUser = {
  name: 'Nguyễn Thị Lan',
  email: 'lan@example.com',
  roles: ['Super Admin'],
  permissions: [] as string[],
};

export const sampleBranches: Branch[] = [
  { id: 1, name: 'Chi nhánh mẫu A', address: '12 Đường Mẫu, Quận 1' },
  { id: 2, name: 'Chi nhánh mẫu B', address: '88 Đường Thử, Quận 7' },
];

const hours = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19'];
const revenue = [1.2, 2.4, 3.1, 1.8, 0.9, 1.5, 2.8, 3.6, 2.2, 1.4, 0.8, 0.5];

export const sampleDashboard: DashboardData = {
  stats: {
    currentRevenue: 22_200_000,
    lastRevenue: 19_760_000,
    revenueChange: 12.3,
    invoiceCount: 24,
    invoiceChange: 8,
    aov: 925_000,
    aovChange: -2.1,
    profit: 5_120_000,
    profitChange: 15.4,
    marginAvg: 23.1,
    totalCustomerDebt: 48_350_000,
    totalSupplierDebt: 120_400_000,
    unpaidInvoices: 35,
    unpaidAmount: 31_200_000,
    codAmount: 4_650_000,
    codCount: 4,
    lowStockProducts: 9,
    outOfStockProducts: 2,
    negativeStock: 0,
  },
  trend: hours.map((label, i) => ({ label, revenue: revenue[i] * 1_000_000, profit: revenue[i] * 230_000 })),
  counts: { orders: 12, debt: 35, cod: 4, stock: 9 },
  products: [
    { productId: 1, code: 'SP001', name: 'Trà đen 1kg', totalQuantity: 42, totalRevenue: 7_770_000 },
    { productId: 2, code: 'SP002', name: 'Siro đào 2,5L', totalQuantity: 30, totalRevenue: 2_880_000 },
    { productId: 3, code: 'SP003', name: 'Trân châu đen 3kg', totalQuantity: 28, totalRevenue: 2_184_000 },
    { productId: 4, code: 'SP004', name: 'Bột sữa béo 1kg', totalQuantity: 25, totalRevenue: 1_625_000 },
    { productId: 5, code: 'SP005', name: 'Thạch dừa 2,5kg', totalQuantity: 18, totalRevenue: 990_000 },
  ],
  buyers: [
    { id: 1, code: 'KH001', name: 'Quán mẫu Trà Mây', totalRevenue: 6_400_000, invoiceCount: 5 },
    { id: 2, code: 'KH002', name: 'Quán mẫu Gió Chiều', totalRevenue: 4_100_000, invoiceCount: 3 },
    { id: 3, code: 'KH003', name: 'Tiệm mẫu Lối Nhỏ', totalRevenue: 2_950_000, invoiceCount: 2 },
  ],
  recent: [
    { id: 1, code: 'DH000101', customerName: 'Quán mẫu Trà Mây', grandTotal: 3_400_000, createdAt: new Date().toISOString() },
    { id: 2, code: 'DH000100', customerName: 'Tiệm mẫu Lối Nhỏ', grandTotal: 1_650_000, createdAt: new Date(Date.now() - 3_600_000).toISOString() },
  ],
};

export const sampleTasks: TaskRow[] = [
  { code: 'DH000101', partner: 'Quán mẫu Trà Mây', branchName: 'Chi nhánh mẫu A', value: 3_400_000, time: new Date().toISOString(), status: 'pending' },
  { code: 'DH000099', partner: 'Quán mẫu Gió Chiều', branchName: 'Chi nhánh mẫu A', value: 5_120_000, time: new Date(Date.now() - 86_400_000).toISOString(), status: 'confirmed' },
  { code: 'DH000097', partner: 'Tiệm mẫu Lối Nhỏ', branchName: 'Chi nhánh mẫu B', value: 7_800_000, time: new Date(Date.now() - 2 * 86_400_000).toISOString(), status: 'partially_invoiced' },
];

// ---------- Bán hàng (mẫu) ----------

export const sampleSalePerms: SalePerms = {
  order: true,
  invoice: true,
  products: true,
  customers: true,
  priceBooks: true,
  editPrice: true,
  editDiscount: true,
  viewStock: true,
  viewPayment: true,
  editPayment: true,
  viewDebt: true,
  printInvoice: true,
  printOrder: true,
};

export const sampleProducts: SaleProduct[] = [
  { id: 1, code: 'SP001', name: 'Trà đen mẫu 1kg', unit: 'gói', basePrice: 185_000, onHand: 42, weightGrams: 1000 },
  { id: 2, code: 'SP002', name: 'Siro đào mẫu 2,5L', unit: 'chai', basePrice: 96_000, onHand: 18, conversionValue: 6 },
  { id: 3, code: 'SP003', name: 'Trân châu đen mẫu 3kg', unit: 'gói', basePrice: 78_000, onHand: 0 },
  { id: 4, code: 'SP004', name: 'Bột sữa béo mẫu 1kg', unit: 'gói', basePrice: 65_000, onHand: 125 },
  { id: 5, code: 'SP005', name: 'Thạch dừa mẫu 2,2kg', unit: 'hũ', basePrice: 54_000, onHand: 9 },
  { id: 6, code: 'SP006', name: 'Ly nhựa mẫu 500ml (50 cái)', unit: 'cây', basePrice: 38_000, onHand: 300 },
];

export const sampleCustomers: SaleCustomer[] = [
  {
    id: 11,
    code: 'KH0011',
    name: 'Quán mẫu Trà Mây',
    contactNumber: '0900 000 111',
    totalDebt: 1_250_000,
    addresses: [
      { id: 1, label: 'Quán', receiver: 'Chị Mây', contactNumber: '0900 000 111', address: '25 Đường Mẫu', wardName: 'Phường Mẫu', locationName: 'TP. Mẫu', isDefault: true },
      { id: 2, label: 'Kho', receiver: 'Anh Nam', contactNumber: '0900 000 222', address: '9 Đường Thử', wardName: 'Phường Thử', locationName: 'TP. Mẫu' },
    ],
  },
  { id: 12, code: 'KH0012', name: 'Tiệm mẫu Gió Chiều', contactNumber: '0900 000 333', totalDebt: -300_000, requireFullPayment: true, addresses: [] },
  { id: 13, code: 'KH0013', name: 'Quán mẫu Lối Nhỏ', phone: '0900 000 444', totalDebt: 0, parentName: 'Chuỗi mẫu Lối', addresses: [] },
];

export const sampleBanks: BankAccount[] = [
  { id: 1, bankCode: 'VCB', accountNumber: '0000001234' },
  { id: 2, bankCode: 'TCB', accountNumber: '0000005678' },
];

/** Nội dung mẫu in giả (giống cấu trúc phiếu đặt hàng của hệ thống). */
export const samplePrintContent = `
<p style="text-align:center;font-size:11px;margin:0">Chi nhánh mẫu A</p>
<h2 style="text-align:center;margin:4px 0">PHIẾU ĐẶT HÀNG</h2>
<p style="text-align:center;margin:0">Ngày 01/11/2026 · Mã đơn: DH000123</p>
<p><b>Khách hàng:</b> Quán mẫu Trà Mây · 0900 000 111<br/><b>Địa chỉ:</b> 25 Đường Mẫu, Phường Mẫu, TP. Mẫu<br/><b>Nhân viên:</b> Nguyễn Thị Lan</p>
<table border="1">
<tr><th>Sản phẩm</th><th>Đơn giá</th><th>SL</th><th>Đơn vị</th><th>Thành tiền</th></tr>
<tr><td>Trà đen mẫu 1kg</td><td>170.000</td><td>2</td><td>Gói</td><td>340.000</td></tr>
<tr><td>Siro đào mẫu 2,5L</td><td>96.000</td><td>6</td><td>Chai</td><td>576.000</td></tr>
<tr><td>Bột sữa béo mẫu 1kg</td><td>65.000</td><td>1</td><td>Gói</td><td>65.000</td></tr>
</table>
<p style="text-align:right"><b>Tổng tiền hàng:</b> 981.000<br/><b>Cần thanh toán:</b> 981.000</p>`;

// ---------- Đơn hàng (mẫu) ----------
const ago = (days: number, h: number, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export const sampleDocRows: DocRow[] = [
  { id: 1, code: 'DH000131', date: ago(0, 10, 42), status: 1, customerName: 'Quán mẫu Trà Mây', customerPhone: '0900000111', sellerName: 'Nguyễn Thị Lan', grandTotal: 1_250_000, paidAmount: 0, debtAmount: 1_250_000 },
  { id: 2, code: 'DH000130', date: ago(0, 9, 5), status: 5, customerName: 'Tiệm mẫu Gió Chiều', customerPhone: null, sellerName: 'Trần Văn Nam', grandTotal: 865_000, paidAmount: 300_000, debtAmount: 565_000 },
  { id: 3, code: 'DH000129', date: ago(1, 16, 20), status: 6, customerName: 'Quán mẫu Lối Nhỏ', customerPhone: null, sellerName: 'Nguyễn Thị Lan', grandTotal: 2_400_000, paidAmount: 2_400_000, debtAmount: 0 },
  { id: 4, code: 'DH000128', date: ago(1, 11, 2), status: 4, customerName: 'Quán mẫu Trà Mây', customerPhone: null, sellerName: 'Nguyễn Thị Lan', grandTotal: 455_000, paidAmount: 0, debtAmount: 0 },
  { id: 5, code: 'DH000127', date: ago(3, 14, 30), status: 3, customerName: 'Tiệm mẫu Gió Chiều', customerPhone: null, sellerName: 'Trần Văn Nam', grandTotal: 1_980_000, paidAmount: 1_980_000, debtAmount: 0 },
];

export const sampleDocCounts = { all: 24, pending: 6, confirmed: 5, partially_invoiced: 3, completed: 8, cancelled: 2 };

export const sampleDocDetail: DocDetail = {
  kind: 'order',
  id: 2,
  code: 'DH000130',
  date: ago(0, 9, 5),
  status: 5,
  branchId: 1,
  branchName: 'Chi nhánh mẫu A',
  sellerName: 'Trần Văn Nam',
  creatorName: 'Nguyễn Thị Lan',
  priceBookName: null,
  customer: { name: 'Tiệm mẫu Gió Chiều', code: 'KH0012', phone: '0900 000 333' },
  delivery: { receiver: 'Chị Gió', phone: '0900 000 333', address: '9 Đường Thử, Phường Thử, TP. Mẫu', note: 'Gọi trước khi giao' },
  note: 'Giao buổi sáng',
  lines: [
    { key: '1', code: 'SP001', name: 'Trà đen mẫu 1kg', unit: 'Gói', quantity: 3, price: 185_000, discount: 15_000, total: 510_000, note: null, gift: false, condition: 'normal', invoicedQty: 2 },
    { key: '2', code: 'SP002', name: 'Siro đào mẫu 2,5L', unit: 'Chai', quantity: 3, price: 96_000, discount: 0, total: 288_000, note: 'Giao chai mới', gift: false, condition: 'near_expiry', invoicedQty: 0 },
    { key: '3', code: 'SP009', name: 'Ly nhựa mẫu (quà tặng)', unit: 'Cây', quantity: 1, price: 0, discount: 0, total: 0, note: null, gift: true, condition: 'normal', invoicedQty: 0 },
  ],
  totalAmount: 798_000,
  discount: 0,
  discountRatio: 0,
  shippingFee: 67_000,
  grandTotal: 865_000,
  paidAmount: 300_000,
  debtAmount: 565_000,
  payments: [{ key: 'p1', code: 'TTDH000130-1', amount: 300_000, method: 'transfer', date: ago(0, 9, 10), cancelled: false }],
  sourceOrderId: null,
  invoices: [{ id: 20, code: 'HD000210', status: 3 }],
};

export const sampleInvoiceDetail: DocDetail = {
  ...sampleDocDetail,
  kind: 'invoice',
  id: 20,
  code: 'HD000210',
  status: 6,
  lines: sampleDocDetail.lines.map((l) => ({ ...l, invoicedQty: undefined })),
  payments: [{ key: 'p2', code: 'TTHD000210', amount: 300_000, method: 'transfer', date: ago(0, 9, 10), cancelled: false }],
  sourceOrderId: 2,
  invoices: [],
};

export const sampleInvoiceDraft: InvoiceDraft = toInvoiceDraft({
  id: 2,
  code: 'DH000130',
  status: 6,
  branchId: 1,
  discount: 0,
  discountRatio: 0,
  shippingFee: 67_000,
  customer: { name: 'Tiệm mẫu Gió Chiều', code: 'KH0012' },
  items: [
    { id: 1, productId: 1, productCode: 'SP001', productName: 'Trà đen mẫu 1kg', quantity: 3, price: 185_000, discount: 15_000, product: { unit: 'Gói' } },
    { id: 2, productId: 2, productCode: 'SP002', productName: 'Siro đào mẫu 2,5L', quantity: 3, price: 96_000, discount: 0, conditionType: 'near_expiry', product: { unit: 'Chai' } },
    { id: 3, productId: 9, productCode: 'SP009', productName: 'Ly nhựa mẫu', quantity: 1, price: 0, discount: 0, isGift: true, lineType: 'gift', product: { unit: 'Cây' } },
  ],
  payments: [{ amount: 300_000, status: 1 }],
  paymentNotes: [{ paymentType: 'cash' }],
  invoices: [{ status: 3, discount: 0, shippingFee: 0, details: [{ productId: 1, quantity: 1 }] }],
});

const sampleRawOrder: RawOrderForEdit = {
  id: 1,
  code: 'DH000126',
  status: 5,
  branchId: 1,
  updatedAt: '2026-11-01T08:00:00.000Z',
  customer: { id: 11, code: 'KH0011', name: 'Quán mẫu Trà Mây', contactNumber: '0900 000 111', totalDebt: 1_250_000, addresses: [] },
  discount: 20_000,
  discountRatio: 0,
  shippingFee: 30_000,
  description: 'Giao buổi sáng',
  items: [
    {
      id: 1,
      productId: 1,
      productCode: 'SP001',
      productName: 'Trà đen mẫu 1kg',
      quantity: 3,
      price: 185_000,
      discount: 15_000,
      product: { id: 1, code: 'SP001', name: 'Trà đen mẫu 1kg', unit: 'gói', basePrice: 185_000, inventories: [{ branchId: 1, onHand: 42 }] },
    },
    {
      id: 2,
      productId: 2,
      productCode: 'SP002',
      productName: 'Siro đào mẫu 2,5L',
      quantity: 6,
      price: 96_000,
      discount: 0,
      conditionType: 'near_expiry',
      product: { id: 2, code: 'SP002', name: 'Siro đào mẫu 2,5L', unit: 'chai', basePrice: 96_000 },
    },
  ],
  payments: [{ amount: 300_000, status: 0 }],
  paymentNotes: [{ paymentType: 'transfer' }],
  delivery: { receiver: 'Chị Mây', contactNumber: '0900 000 111', address: '25 Đường Mẫu', wardName: 'Phường Mẫu', locationName: 'TP. Mẫu' },
  invoices: [],
};

/** Đơn mẫu đang xử lý (sửa được hàng). */
export const sampleOrderEdit = toOrderEdit(sampleRawOrder, 1);

/** Đơn mẫu có quà khuyến mãi: chỉ xem hàng, không đổi khách. */
export const sampleOrderEditPromo = toOrderEdit(
  {
    ...sampleRawOrder,
    code: 'DH000127',
    status: 1,
    items: [
      ...(sampleRawOrder.items ?? []),
      {
        id: 3,
        productId: 6,
        productCode: 'SP006',
        productName: 'Ly nhựa mẫu 500ml (50 cái)',
        quantity: 1,
        price: 0,
        discount: 0,
        lineType: 'gift',
        isGift: true,
        promotionId: 5,
        promotion: { name: 'Mua 3 tặng 1' },
      },
    ],
  },
  1,
);
