// Dữ liệu MẪU cho trang xem trước khi dev (không phải dữ liệu thật).
import type { Branch } from '@/core/session';
import type { DashboardData } from '../dashboard/DashboardView';
import type { TaskRow } from '../dashboard/api';
import type { DocDetail, DocRow } from '../orders/api';
import type { BankAccount } from '../sales/api';
import type { SaleCustomer, SaleProduct } from '../sales/cart';
import type { SalePerms } from '../sales/perms';
import { toInvoiceEdit, toOrderEdit, type RawOrderForEdit } from '../orders/editOrder';
import { toInvoiceDraft, type InvoiceDraft } from '../orders/fromOrder';
import { toStockMove, type RawProduct, type StockMove } from '../products/model';
import { toDebtEntry, type DebtEntry, type RawCustomer, type UnpaidInvoice } from '../customers/model';
import { toPackDetail, toPackRow, type PackRow, type RawPacking } from '../packing/model';

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
// Khung giờ mẫu: đông lúc 9–11h và 14–16h, cuối tuần đông hơn; 12h, 21h vắng.
const heatCells = [0, 1, 2, 3, 4, 5, 6].flatMap((dow) =>
  Array.from({ length: 15 }, (_, i) => {
    const hour = 7 + i;
    const wave = Math.max(0, Math.sin(((hour - 7) / 14) * Math.PI * 2.2)) + (hour === 12 || hour >= 21 ? 0 : 0.25);
    const weekend = dow === 0 || dow === 6 ? 1.4 : 1;
    const revenue = Math.round(wave * weekend * 2_400_000 * (1 + ((dow * 7 + hour) % 5) / 10));
    return { dow, hour, revenue, count: Math.round(revenue / 600_000) };
  }),
);

const profitRate = [0.24, 0.22, 0.26, 0.2, 0.18, 0.23, 0.25, 0.27, 0.21, 0.19, 0.2, 0.22];

export const sampleDashboard: DashboardData = {
  stats: {
    data: {
      currentRevenue: 22_200_000,
      lastRevenue: 19_760_000,
      revenueChange: 12.3,
      invoiceCount: 24,
      invoiceChange: 8,
      aov: 925_000,
      aovChange: -2.1,
      profit: 5_120_000,
      profitChange: 15.4,
      marginAvg: 0.231,
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
  },
  trend: {
    data: hours.map((label, i) => ({ label, revenue: revenue[i] * 1_000_000, profit: revenue[i] * profitRate[i] * 1_000_000 })),
  },
  category: {
    data: [
      { name: 'Trà mẫu', revenue: 8_400_000, percent: 37.8 },
      { name: 'Siro mẫu', revenue: 5_100_000, percent: 23 },
      { name: 'Topping mẫu', revenue: 3_900_000, percent: 17.6 },
      { name: 'Bột mẫu', revenue: 2_600_000, percent: 11.7 },
      { name: 'Ly, ống hút mẫu', revenue: 1_400_000, percent: 6.3 },
      { name: 'Khác', revenue: 800_000, percent: 3.6 },
    ],
  },
  products: {
    data: [
      { productId: 1, code: 'SP001', name: 'Trà đen mẫu 1kg', totalQuantity: 42, totalRevenue: 7_770_000, totalProfit: 1_890_000 },
      { productId: 2, code: 'SP002', name: 'Siro đào mẫu 2,5L', totalQuantity: 30, totalRevenue: 2_880_000, totalProfit: 640_000 },
      { productId: 3, code: 'SP003', name: 'Trân châu đen mẫu 3kg', totalQuantity: 28, totalRevenue: 2_184_000, totalProfit: 520_000 },
      { productId: 4, code: 'SP004', name: 'Bột sữa béo mẫu 1kg', totalQuantity: 25, totalRevenue: 1_625_000, totalProfit: 410_000 },
      { productId: 5, code: 'SP005', name: 'Thạch dừa mẫu 2,2kg', totalQuantity: 18, totalRevenue: 990_000, totalProfit: 190_000 },
    ],
  },
  buyers: {
    data: [
      { id: 1, code: 'KH001', name: 'Quán mẫu Trà Mây', totalRevenue: 6_400_000, invoiceCount: 5 },
      { id: 2, code: 'KH002', name: 'Quán mẫu Gió Chiều', totalRevenue: 4_100_000, invoiceCount: 3 },
      { id: 3, code: 'KH003', name: 'Tiệm mẫu Lối Nhỏ', totalRevenue: 2_950_000, invoiceCount: 2 },
    ],
  },
  branchCmp: {
    data: {
      labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
      branches: [
        { id: 1, name: 'Chi nhánh mẫu A', data: [], total: 86_500_000 },
        { id: 2, name: 'Chi nhánh mẫu B', data: [], total: 54_200_000 },
        { id: 3, name: 'Kho mẫu C', data: [], total: 21_700_000 },
      ],
    },
  },
  finance: {
    data: {
      debt: 48_350_000,
      overdue: 19_800_000,
      unpaidCount: 35,
      codAmount: 4_650_000,
      codCount: 4,
      aging: { inTerm: 28_550_000, d1to30: 14_300_000, over30: 5_500_000 },
    },
  },
  counts: { data: { orders: 12, debt: 35, cod: 4, stock: 9 } },
  cashflow: {
    data: {
      receipt: 26_400_000,
      payment: 9_850_000,
      net: 16_550_000,
      count: 31,
      series: hours.map((label, i) => ({
        label,
        receipt: revenue[i] * 1_100_000,
        payment: i % 3 === 0 ? 2_100_000 : i % 4 === 1 ? 950_000 : 0,
      })),
      topPayments: [
        { name: 'Tiền xăng xe mẫu', amount: 3_200_000 },
        { name: 'Chi phí giao hàng mẫu', amount: 2_750_000 },
        { name: 'Văn phòng phẩm mẫu', amount: 1_900_000 },
        { name: 'Khác', amount: 2_000_000 },
      ],
    },
  },
  sellers: {
    data: [
      { id: 11, name: 'Nhân viên mẫu An', revenue: 9_800_000, invoiceCount: 9 },
      { id: 12, name: 'Nhân viên mẫu Bình', revenue: 7_150_000, invoiceCount: 8 },
      { id: 13, name: 'Nhân viên mẫu Chi', revenue: 4_100_000, invoiceCount: 5 },
      { id: null, name: 'Chưa gán nhân viên', revenue: 1_150_000, invoiceCount: 2 },
    ],
  },
  channels: {
    data: [
      { id: null, name: 'Bán trực tiếp', revenue: 12_300_000, invoiceCount: 13, percent: 55.4 },
      { id: 1, name: 'Zalo mẫu', revenue: 5_600_000, invoiceCount: 6, percent: 25.2 },
      { id: 2, name: 'Facebook mẫu', revenue: 3_100_000, invoiceCount: 4, percent: 14 },
      { id: 3, name: 'Sàn TMĐT mẫu', revenue: 1_200_000, invoiceCount: 1, percent: 5.4 },
    ],
  },
  heatmap: { data: { cells: heatCells } },
  returns: {
    data: {
      count: 4,
      amount: 720_000,
      revenue: 22_200_000,
      rate: 3.2,
      pendingCount: 2,
      topProducts: [
        { productId: 2, code: 'SP002', name: 'Siro đào mẫu 2,5L', quantity: 3, amount: 288_000 },
        { productId: 5, code: 'SP005', name: 'Thạch dừa mẫu 2,2kg', quantity: 4, amount: 216_000 },
        { productId: 3, code: 'SP003', name: 'Trân châu đen mẫu 3kg', quantity: 2, amount: 156_000 },
      ],
    },
  },
  recent: {
    data: [
      { id: 1, code: 'DH000101', customerName: 'Quán mẫu Trà Mây', grandTotal: 3_400_000, createdAt: new Date().toISOString() },
      { id: 2, code: 'DH000100', customerName: 'Tiệm mẫu Lối Nhỏ', grandTotal: 1_650_000, createdAt: new Date(Date.now() - 3_600_000).toISOString() },
    ],
  },
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
  createdBy: 1,
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

/** Hóa đơn mẫu đang xử lý (đã đổi số lượng 1 dòng). */
export const sampleInvoiceEdit = (() => {
  const { items, invoices: _invoices, ...rest } = sampleRawOrder;
  const edit = toInvoiceEdit({ ...rest, id: 9, code: 'HD000124', status: 3, details: items }, 1);
  const lines = edit.cart.lines.map((l, i) => (i === 0 ? { ...l, quantity: l.quantity + 1 } : l));
  return { cart: { ...edit.cart, lines }, meta: edit.meta };
})();

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

// ---------- Hàng hóa ----------

const inv = (branchId: number, name: string, onHand: number, cost: number, more: object = {}) => ({
  branchId,
  branch: { name, isActive: true },
  onHand: String(onHand),
  cost: String(cost),
  reserved: '4',
  onOrder: '0',
  minQuality: '10',
  maxQuality: '200',
  ...more,
});

/** Hàng mẫu dạng dữ liệu API (dùng cho danh sách, chi tiết, form). */
export const sampleRawProducts: RawProduct[] = [
  {
    id: 1,
    code: 'SP001',
    name: 'Trà đen mẫu 1kg',
    type: 2,
    basePrice: '185000',
    unit: 'gói',
    conversionValue: '20',
    weight: '1',
    weightUnit: 'kg',
    shippingWeight: '1050',
    shippingWeightUnit: 'g',
    vat: '8',
    isActive: true,
    isDirectSale: true,
    parentName: 'Nguyên liệu mẫu',
    middleName: 'Trong nước',
    childName: 'Trà',
    tradeMark: { id: 1, name: 'Thương hiệu mẫu' },
    // Ảnh giả (tên miền dành cho ví dụ) để xem khung ảnh nhiều tấm.
    images: [{ image: 'https://example.com/mau-1.jpg' }, { image: 'https://example.com/mau-2.jpg' }],
    description: 'Trà đen dùng pha trà sữa (mô tả mẫu).',
    orderTemplate: 'Giao kèm hóa đơn',
    createdAt: '2026-03-12T08:00:00.000Z',
    attributes: [
      { name: 'Vị', value: 'Truyền thống' },
      { name: 'Kích cỡ', value: '1kg' },
    ],
    inventories: [
      inv(1, 'Chi nhánh mẫu A', 42, 120000, { damagedQuantity: '2', nearExpiryQuantity: '5' }),
      inv(2, 'Chi nhánh mẫu B', 0, 118000),
    ],
  },
  {
    id: 2,
    code: 'SP002',
    name: 'Siro đào mẫu 2,5L',
    type: 2,
    basePrice: '96000',
    unit: 'chai',
    conversionValue: '6',
    isActive: true,
    childName: 'Siro',
    cargoType: 'COLD',
    inventories: [inv(1, 'Chi nhánh mẫu A', 18, 61000)],
  },
  {
    id: 3,
    code: 'CB001',
    name: 'Combo khai trương mẫu',
    type: 1,
    basePrice: '320000',
    unit: 'bộ',
    isActive: true,
    comboComponents: [
      { componentProductId: 1, quantity: '1', componentProduct: { id: 1, code: 'SP001', name: 'Trà đen mẫu 1kg', inventories: [inv(1, 'A', 42, 120000)] } },
      { componentProductId: 2, quantity: '2', componentProduct: { id: 2, code: 'SP002', name: 'Siro đào mẫu 2,5L', inventories: [inv(1, 'A', 18, 61000)] } },
    ],
    inventories: [inv(1, 'Chi nhánh mẫu A', 6, 0)],
  },
  {
    id: 4,
    code: 'SX001',
    name: 'Trà sữa nền mẫu (thành phẩm)',
    type: 4,
    basePrice: '45000',
    unit: 'lít',
    isActive: true,
    childName: 'Thành phẩm',
    formulas: [
      {
        id: 1,
        name: 'Công thức chuẩn',
        isDefault: true,
        components: [
          { componentProductId: 1, quantity: '50', inputMode: 'gram', componentProduct: { id: 1, code: 'SP001', name: 'Trà đen mẫu 1kg' } },
          { componentProductId: 2, quantity: '1', inputMode: 'quantity', componentProduct: { id: 2, code: 'SP002', name: 'Siro đào mẫu 2,5L' } },
        ],
      },
      { id: 2, name: 'Công thức ít ngọt', components: [] },
    ],
    inventories: [inv(1, 'Chi nhánh mẫu A', 12, 21500)],
  },
  { id: 5, code: 'DV001', name: 'Phí lắp đặt quầy mẫu', type: 3, basePrice: '500000', unit: 'lần', isActive: true },
  {
    id: 6,
    code: 'SP006',
    name: 'Ly nhựa mẫu 500ml (50 cái)',
    type: 2,
    basePrice: '38000',
    unit: 'cây',
    isActive: false,
    inventories: [inv(1, 'Chi nhánh mẫu A', 0, 25000)],
  },
];

export const sampleStockMoves: StockMove[] = [
  { id: 1, transactionType: 'SALE', refType: 'invoice', refId: 9, refCode: 'HD000124', partnerName: 'Quán mẫu Mây', quantity: '-3', tonCuoi: '42', costPrice: '120000', transactionPrice: '185000', transactionDate: '2026-11-02T09:15:00.000Z' },
  { id: 2, transactionType: 'PURCHASE', refType: 'purchase_order', refId: 3, refCode: 'PN000031', partnerName: 'Nhà cung cấp mẫu', quantity: '40', tonCuoi: '45', costPrice: '118000', transactionPrice: '118000', transactionDate: '2026-10-30T14:00:00.000Z' },
  { id: 3, transactionType: 'STOCK_AUDIT', refType: 'stock_audit', refId: 2, refCode: 'KK000012', quantity: '0', tonCuoi: '5', costPrice: '120000', transactionDate: '2026-10-28T17:30:00.000Z' },
  { id: 4, transactionType: 'TRANSFER_OUT', refType: 'transfer', refId: 7, refCode: 'CH000007', partnerName: 'Chi nhánh mẫu B', quantity: '-10', tonCuoi: '5', costPrice: '120000', transactionDate: '2026-10-25T10:00:00.000Z' },
].map((r) => toStockMove(r));

/** Khách mẫu dạng dữ liệu API (danh sách, chi tiết, form). */
export const sampleRawCustomers: RawCustomer[] = [
  {
    id: 21,
    code: 'KH000021',
    name: 'Chuỗi mẫu Trà Mây',
    type: 1,
    organization: 'Công ty mẫu Trà Mây',
    taxCode: '0100000001',
    contactNumber: '0900 000 111',
    phone: '0900 000 112',
    email: 'mau@example.com',
    totalDebt: '1250000',
    totalPurchased: '48600000',
    totalRevenue: '47900000',
    totalInvoiced: '48600000',
    isActive: true,
    createdAt: '2026-03-12T03:00:00.000Z',
    comments: 'Giao trước 10h sáng, gọi trước khi tới.',
    invoiceBuyerName: 'Chị Mây',
    invoiceAddress: '25 Đường Mẫu',
    invoiceEmail: 'hoadon@example.com',
    branch: { id: 1, name: 'Chi nhánh mẫu 1' },
    addresses: [
      { id: 1, label: 'Quán chính', receiver: 'Chị Mây', contactNumber: '0900 000 111', address: '25 Đường Mẫu', newWardName: 'Phường Mẫu', newCityName: 'Thành phố Mẫu', newCityCode: '79', newWardCode: '26734', isDefault: true },
      { id: 2, label: 'Kho', receiver: 'Anh Nam', contactNumber: '0900 000 222', address: '9 Đường Thử', wardName: 'Phường 3', districtName: 'Quận Thử', cityName: 'TP. Mẫu', cityCode: '79' },
    ],
    customerGroupDetails: [{ customerGroup: { id: 1, name: 'Khách sỉ' } }],
    children: [
      { id: 22, code: 'KH000021.1', name: 'Trà Mây chi nhánh 1', contactNumber: '0900 000 121', totalDebt: '300000', isActive: true },
      { id: 23, code: 'KH000021.2', name: 'Trà Mây chi nhánh 2', contactNumber: null, totalDebt: '0', isActive: false },
    ],
  },
  {
    id: 24,
    code: 'KH000024',
    name: 'Tiệm mẫu Gió Chiều',
    type: 0,
    contactNumber: '0900 000 333',
    totalDebt: '0',
    totalPurchased: '12300000',
    totalRevenue: '12300000',
    isActive: true,
    addresses: [{ id: 3, address: '8 Phố Mẫu', newWardName: 'Phường Gió', newCityName: 'Thủ đô Mẫu', newCityCode: '01', isDefault: true }],
  },
  {
    id: 22,
    code: 'KH000021.1',
    name: 'Trà Mây chi nhánh 1',
    type: 0,
    contactNumber: '0900 000 121',
    totalDebt: '300000',
    totalPurchased: '5200000',
    totalRevenue: '5200000',
    isActive: true,
    parentId: 21,
    parent: { id: 21, code: 'KH000021', name: 'Chuỗi mẫu Trà Mây' },
    addresses: [],
  },
  {
    id: 25,
    code: 'KH000025',
    name: 'Quán mẫu Lối Nhỏ (đã ngừng)',
    type: 0,
    phone: '0900 000 444',
    totalDebt: '0',
    totalPurchased: '0',
    isActive: false,
    addresses: [],
  },
];

export const sampleDebtEntries: DebtEntry[] = [
  { type: 'payment', id: 9, code: 'TT000045', date: ago(0, 9, 30), amount: 500_000, debtSnapshot: 1_250_000, branch: { name: 'Chi nhánh mẫu 1' } },
  { type: 'invoice', id: 8, code: 'HD000210', date: ago(1, 15, 10), amount: 1_100_000, debtSnapshot: 1_750_000, branch: { name: 'Chi nhánh mẫu 1' } },
  { type: 'return_order', id: 7, code: 'TH000012', date: ago(2, 11, 0), amount: 150_000, debtSnapshot: 650_000, branch: { name: 'Chi nhánh mẫu 1' } },
  { type: 'invoice', id: 6, code: 'HD000198', date: ago(4, 10, 20), amount: 800_000, debtSnapshot: 800_000, branch: { name: 'Chi nhánh mẫu 1' } },
].map(toDebtEntry);

export const sampleUnpaid: UnpaidInvoice[] = [
  { id: 6, code: 'HD000198', date: ago(4, 10, 20), debt: 650_000, total: 800_000, customerName: 'Chuỗi mẫu Trà Mây' },
  { id: 8, code: 'HD000210', date: ago(1, 15, 10), debt: 1_100_000, total: 1_100_000, customerName: 'Trà Mây chi nhánh 1' },
];

// ---------- Báo đơn ----------

const packInv = (id: number, code: string, customer: string, total: number, cash?: number) => ({
  invoice: {
    id,
    code,
    grandTotal: total,
    purchaseDate: ago(0, 8),
    branchId: 1,
    customer: { id, name: customer },
    paymentNote: cash ? { paymentType: 'cash', amount: cash } : null,
  },
});

export const sampleRawPackings: RawPacking[] = [
  {
    id: 31,
    type: 'giao-hang',
    code: 'BD000231',
    numberOfPackages: 4,
    paymentMethod: 'cash',
    cashAmount: '1250000',
    createdAt: ago(0, 10, 15),
    creator: { name: 'Trần Văn Nam' },
    branch: { id: 1, name: 'Chi nhánh mẫu A' },
    imageCount: 3,
    hasColdItems: true,
    coldItemCount: 2,
    invoices: [packInv(1, 'HD000301', 'Quán mẫu Trà Mây', 850000, 850000), packInv(2, 'HD000302', 'Tiệm mẫu Gió Chiều', 450000, 450000)],
    // Backend tính: phiếu thu 1.250.000 nhưng 2 hóa đơn ghi tổng 1.300.000.
    cashWarning: { kind: 'amount', invoiceCash: 1300000, slipCash: 1250000, codes: ['HD000301', 'HD000302'] },
  },
  {
    id: 12,
    type: 'loading',
    code: 'DLD000112',
    numberOfPackages: 6,
    createdAt: ago(0, 9, 40),
    creator: { name: 'Nguyễn Thị Lan' },
    imageCount: 2,
    invoices: [packInv(3, 'HD000298', 'Quán mẫu Lối Nhỏ', 1200000)],
  },
  {
    id: 44,
    type: 'dong-hang',
    code: 'DDH000144',
    numberOfPackages: 2,
    createdAt: ago(1, 16, 5),
    creator: { name: 'Lê Minh' },
    imageCount: 0,
    cancelledAt: ago(0, 8),
    invoices: [packInv(4, 'HD000290', 'Quán mẫu Trà Mây', 560000)],
  },
  {
    id: 30,
    type: 'giao-hang',
    code: 'BD000230',
    numberOfPackages: 1,
    paymentMethod: 'transfer',
    createdAt: ago(1, 14, 20),
    creator: { name: 'Trần Văn Nam' },
    imageCount: 1,
    invoices: [packInv(5, 'HD000285', 'Tiệm mẫu Gió Chiều', 320000, 320000)],
    cashWarning: { kind: 'transfer', invoiceCash: 320000, slipCash: 0, codes: ['HD000285'] },
  },
];

export const samplePackRows: PackRow[] = sampleRawPackings.map(toPackRow).filter((r): r is PackRow => !!r);

export const samplePackDetail = toPackDetail('giao-hang', {
  ...sampleRawPackings[0],
  note: 'Giao trước 11h, gọi trước khi tới',
  hasFeeGrab: true,
  feeGrab: '45000',
  hasCuocGuiHang: true,
  cuocGuiHang: '30000',
  expensePayer: { id: 3, name: 'Trần Văn Nam' },
  coldItems: [
    { invoiceCode: 'HD000301', productCode: 'KEM01', productName: 'Kem tươi mẫu 1kg' },
    { invoiceCode: 'HD000302', productCode: 'TC02', productName: 'Trân châu lạnh mẫu' },
  ],
  images: [
    { id: 1, imageUrl: 'https://example.com/uploads/bao-don/mau-1.jpg' },
    { id: 2, imageUrl: 'https://example.com/uploads/bao-don/mau-2.jpg' },
    { id: 3, imageUrl: 'https://example.com/uploads/bao-don/mau-3.jpg' },
  ],
  expenseFiles: [{ id: 1, fileUrl: 'https://example.com/uploads/bao-don/chi-phi/bien-nhan-grab.pdf', fileName: 'bien-nhan-grab.pdf', fileType: 'application/pdf', fileSize: 182000 }],
});
