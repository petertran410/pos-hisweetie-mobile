import type { AccentName, IconName } from '@/ui';
import type { Attachment } from '../packing/model';

/**
 * Phiếu kho tạo trên điện thoại (giống trang /phieu-kho của web): lái xe, nhân
 * viên kho ghi tiền mặt thu được, xăng dầu, chăm sóc xe và các khoản chi khác.
 */
export type KhoType = 'chi-khac' | 'tien-mat' | 'xang-dau' | 'cham-soc-xe';

/** Quyền tài chính theo vai trò × chi nhánh (`resource:action`). */
export type FinanceResource = 'warehouse_cash' | 'warehouse_expense' | 'vehicles';

export interface KhoTypeDef {
  label: string;
  title: string;
  hint: string;
  icon: IconName;
  color: AccentName;
  resource: FinanceResource;
  /** Chi nhánh được tạo loại phiếu này (Kho HN 6, Kho SG 1, VP HN 4, VP SG 7). */
  candidates: number[];
}

/** Thứ tự ô trên trang Phiếu kho (giống web). */
export const KHO_ORDER: KhoType[] = ['chi-khac', 'tien-mat', 'xang-dau', 'cham-soc-xe'];

const VEHICLE_HINT = 'Phiếu tạo một khoản chi kho, được tổng hợp tuần cùng phiếu chi kho.';

export const KHO_TYPES: Record<KhoType, KhoTypeDef> = {
  'chi-khac': {
    label: 'Khoản chi khác',
    title: 'Tạo khoản chi khác',
    hint: 'Khoản chi sẽ được tổng hợp tuần và gửi Approval Lark.',
    icon: 'receipt-text',
    color: 'violet',
    resource: 'warehouse_expense',
    candidates: [6, 1, 4, 7],
  },
  'tien-mat': {
    label: 'Phiếu tiền mặt kho',
    title: 'Tạo phiếu tiền mặt',
    hint: 'Tiền mặt thu của khách hoặc bán đồ kho, kế toán kho sẽ xác nhận số thực nhận.',
    icon: 'banknote',
    color: 'green',
    resource: 'warehouse_cash',
    candidates: [6, 1],
  },
  'xang-dau': {
    label: 'Xăng dầu',
    title: 'Phiếu xăng dầu',
    hint: VEHICLE_HINT,
    icon: 'fuel',
    color: 'orange',
    resource: 'vehicles',
    candidates: [6, 1],
  },
  'cham-soc-xe': {
    label: 'Chăm sóc xe',
    title: 'Phiếu chăm sóc xe',
    hint: VEHICLE_HINT,
    icon: 'car-front',
    color: 'blue',
    resource: 'vehicles',
    candidates: [6, 1],
  },
};

export const isKhoType = (v: unknown): v is KhoType => typeof v === 'string' && v in KHO_TYPES;

/** Văn phòng HN / SG: phiếu chi tay trừ quỹ khi kế toán bấm Đã chi. */
export const OFFICE_BRANCH_IDS = [4, 7];

/** Tên dự phòng khi danh sách chi nhánh của tài khoản chưa có. */
const BRANCH_FALLBACK: Record<number, string> = { 6: 'Kho Hà Nội', 1: 'Kho Sài Gòn', 4: 'Văn phòng HN', 7: 'Văn phòng SG' };

export function branchName(id: number, branches: { id: number; name: string }[]): string {
  return branches.find((b) => b.id === id)?.name || BRANCH_FALLBACK[id] || `Chi nhánh ${id}`;
}

// Giữ khớp với backend (internal-finance.constants.ts, vehicles.constants.ts): giá trị lạ bị từ chối.
export const EXPENSE_ITEMS = [
  'Chi phí tiền lương CBNV',
  'Cước chuyển phát nhanh tài liệu, chứng từ - đơn hàng bán lẻ',
  'Chi phí điện sinh hoạt',
  'Điện nước',
  'Cước điện thoại di động',
  'Chi phí nước uống, nước sinh hoạt',
  'Chi phí văn phòng phẩm, đồ dùng văn phòng',
  'Mua sắm CCDC, thiết bị văn phòng',
  'Chi phí sửa chữa thiết bị văn phòng',
  'Mua sắm TSCĐ',
  'Cước đường bộ, vé gửi xe:',
  'Sửa chữa, bảo dưỡng; oto xe máy',
  'Xăng xe: oto, xe tại kho',
  'Chi phí ngoại giao ( xử lý )',
  'Chi phí bốc xếp hàng hóa tại kho',
  'Cước gửi hàng cho khách: cước chành xe, ship nội thành',
  'Mua bao bì, CCDC phục vụ đóng gói hàng hóa: carton, xốp, băng keo...',
  'Thanh toán công nợ NCC',
  'Khác',
] as const;

export const VEHICLE_SERVICE_TYPES = [
  'Rửa xe',
  'Bảo dưỡng',
  'Thay nhớt',
  'Sửa chữa',
  'Chăm sóc xe',
  'Đăng kiểm xe',
  'Mua bảo hiểm bắt buộc',
  'Phạt nguội',
  'Phạt nóng',
  'Mua đường',
] as const;

/** Nhóm ảnh / chứng từ của từng loại phiếu (`kind` gửi kèm mỗi tệp). */
export const FILE_GROUPS: Record<KhoType, { kind: string; label: string }[]> = {
  'chi-khac': [{ kind: 'EVIDENCE', label: 'Chứng từ' }],
  'tien-mat': [{ kind: 'EVIDENCE', label: 'Chứng từ' }],
  'xang-dau': [
    { kind: 'PUMP_METER', label: 'Đồng hồ cây xăng' },
    { kind: 'INVOICE', label: 'Hóa đơn' },
  ],
  'cham-soc-xe': [
    { kind: 'PHOTO', label: 'Hình ảnh' },
    { kind: 'INVOICE', label: 'Hóa đơn' },
  ],
};

// ---------- Quyền theo chi nhánh ----------

export interface FinanceAccess {
  superAdmin: boolean;
  /** Quyền tài chính tại từng chi nhánh, vd { 6: ['vehicles:create'] }. */
  byBranch: Record<number, string[]>;
}

export interface RawFinanceAccess {
  superAdmin?: boolean | null;
  branches?: { branchId: number; permissions?: string[] | null }[] | null;
}

export const NO_ACCESS: FinanceAccess = { superAdmin: false, byBranch: {} };

export function toFinanceAccess(r?: RawFinanceAccess | null): FinanceAccess {
  const byBranch: Record<number, string[]> = {};
  for (const row of r?.branches ?? []) byBranch[Number(row.branchId)] = row.permissions ?? [];
  return { superAdmin: !!r?.superAdmin, byBranch };
}

export const canFinance = (a: FinanceAccess, resource: FinanceResource, action: string, branchId: number) =>
  a.superAdmin || (a.byBranch[branchId] ?? []).includes(`${resource}:${action}`);

/** Chi nhánh được tạo loại phiếu này, theo thứ tự ưu tiên của web. */
export const createBranches = (a: FinanceAccess, type: KhoType) =>
  KHO_TYPES[type].candidates.filter((id) => canFinance(a, KHO_TYPES[type].resource, 'create', id));

export const allowedKhoTypes = (a: FinanceAccess) => KHO_ORDER.filter((t) => createBranches(a, t).length > 0);

/** Chi nhánh mặc định: chi nhánh đang chọn trong app nếu được tạo ở đó, không thì chi nhánh đầu tiên được phép. */
export const defaultBranch = (allowed: number[], appBranchId: number | null) =>
  appBranchId !== null && allowed.includes(appBranchId) ? appBranchId : (allowed[0] ?? null);

// ---------- Xe ----------

export interface RawVehicle {
  id: number;
  label?: string | null;
  plate?: string | null;
  isActive?: boolean | null;
  driverId?: number | null;
  driver?: { id: number; name?: string | null } | null;
}

export interface VehicleOpt {
  id: number;
  label: string;
  driverId: number | null;
  driverName: string | null;
}

export const toVehicle = (r: RawVehicle): VehicleOpt => ({
  id: r.id,
  label: r.label || r.plate || `Xe ${r.id}`,
  driverId: r.driverId ?? r.driver?.id ?? null,
  driverName: r.driver?.name ?? null,
});

/** Lái xe mở phiếu: chọn sẵn xe đang giao cho chính họ (nếu chỉ có 1 xe như vậy). */
export function ownVehicle(vehicles: VehicleOpt[], userId: number | null | undefined): number | null {
  if (!userId) return null;
  const mine = vehicles.filter((v) => v.driverId === userId);
  return mine.length === 1 ? mine[0].id : null;
}

// ---------- Form ----------

export type ReceiptKind = 'CUSTOMER' | 'WAREHOUSE_SALE';

export interface KhoFile extends Attachment {
  /** Nhóm chứng từ: EVIDENCE, PUMP_METER, INVOICE, PHOTO. */
  kind: string;
}

export interface KhoCustomer {
  id: number;
  name: string;
  code: string | null;
}

export interface KhoForm {
  type: KhoType;
  branchId: number | null;
  /** Ngày thu / ngày chi (yyyy-mm-dd, giờ Việt Nam). */
  date: string;
  /** Thời điểm đổ xăng / chăm sóc xe (ISO). */
  at: string;
  amount: number;
  description: string;
  note: string;
  receiptKind: ReceiptKind;
  customers: KhoCustomer[];
  expenseItem: string | null;
  quantity: number | null;
  unitPrice: number | null;
  payer: { id: number; name: string } | null;
  vehicleId: number | null;
  odo: number | null;
  location: string;
  serviceTypes: string[];
  /** Hạn đăng kiểm / bảo hiểm (yyyy-mm-dd). */
  dueAt: string | null;
  files: KhoFile[];
}

/** Ngày hôm nay theo giờ Việt Nam (yyyy-mm-dd). */
export const vnToday = (now = new Date()) => new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

/** Đầu ngày theo giờ Việt Nam: backend cắt ngày phiếu nội bộ theo +07:00 (giống web). */
export const vnDayIso = (date: string) => `${date}T00:00:00+07:00`;

export function newKhoForm(
  type: KhoType,
  branchId: number | null,
  payer: { id: number; name: string } | null = null,
  now = new Date(),
): KhoForm {
  return {
    type,
    branchId,
    date: vnToday(now),
    at: now.toISOString(),
    amount: 0,
    description: '',
    note: '',
    receiptKind: 'CUSTOMER',
    customers: [],
    expenseItem: null,
    quantity: null,
    unitPrice: null,
    payer,
    vehicleId: null,
    odo: null,
    location: '',
    serviceTypes: [],
    dueAt: null,
    files: [],
  };
}

/** Tạo xong làm trống để nhập phiếu tiếp; giữ chi nhánh, ngày, loại phiếu, xe, người chi (giống web). */
export function nextKhoForm(f: KhoForm, now = new Date()): KhoForm {
  const base = newKhoForm(f.type, f.branchId, f.payer, now);
  return {
    ...base,
    date: f.date,
    receiptKind: f.receiptKind,
    expenseItem: f.expenseItem,
    vehicleId: f.vehicleId,
  };
}

/** Số lượng × đơn giá của khoản chi (null khi chưa nhập đủ cả hai). */
export function lineTotal(f: Pick<KhoForm, 'quantity' | 'unitPrice'>): number | null {
  return f.quantity !== null && f.unitPrice !== null ? Math.round(f.quantity * f.unitPrice * 100) / 100 : null;
}

/** Số tiền của phiếu (khoản chi có số lượng × đơn giá thì lấy thành tiền). */
export const khoAmount = (f: KhoForm) => (f.type === 'chi-khac' ? (lineTotal(f) ?? f.amount) : f.amount);

/** Số lít = số tiền / đơn giá (phiếu xăng dầu). */
export const fuelLiters = (f: Pick<KhoForm, 'amount' | 'unitPrice'>) =>
  f.amount > 0 && f.unitPrice && f.unitPrice > 0 ? f.amount / f.unitPrice : null;

export const pendingFiles = (f: KhoForm) => f.files.filter((a) => a.state !== 'done');

/** Lỗi đầu tiên cần sửa (giống web), null = lưu được. */
export function validateKhoForm(f: KhoForm): string | null {
  if (!f.branchId) return 'Vui lòng chọn chi nhánh';
  switch (f.type) {
    case 'tien-mat':
      if (!(f.amount > 0)) return 'Số tiền phải lớn hơn 0';
      if (f.receiptKind === 'CUSTOMER' && !f.customers.length) return 'Cần chọn khách hàng';
      return null;
    case 'chi-khac': {
      if ((f.quantity === null) !== (f.unitPrice === null)) return 'Cần nhập cả số lượng và đơn giá, hoặc bỏ trống cả hai';
      if (!(khoAmount(f) > 0) || !f.description.trim()) return 'Cần nhập số tiền và nội dung khoản chi';
      return null;
    }
    default:
      if (!f.vehicleId) return 'Cần chọn xe';
      if (!(f.amount > 0)) return 'Cần nhập số tiền hợp lệ';
      // Phiếu xăng dầu bắt buộc đơn giá để tính số lít (web để trống được).
      if (f.type === 'xang-dau' && !(f.unitPrice !== null && f.unitPrice > 0)) return 'Cần nhập đơn giá xăng dầu';
      if (f.type === 'cham-soc-xe' && !f.serviceTypes.length) return 'Cần chọn ít nhất một loại dịch vụ';
      if (Number.isNaN(new Date(f.at).getTime())) return 'Thời gian không hợp lệ';
      return null;
  }
}

const opt = (s: string) => s.trim() || undefined;

/** Chứng từ đã tải lên, đúng dạng `InternalFinanceAttachmentDto` của backend. */
export const khoAttachments = (f: KhoForm) =>
  f.files
    .filter((a) => a.state === 'done' && a.url)
    .map((a) => ({
      fileUrl: a.url as string,
      fileName: a.name || undefined,
      fileType: a.type ?? undefined,
      fileSize: a.size !== null && a.size >= 0 ? Math.round(a.size) : undefined,
      kind: a.kind,
    }));

/** Đường dẫn + nội dung gửi tạo phiếu, đúng DTO của backend (tham số lạ bị lỗi 400). */
export function buildKhoPayload(f: KhoForm): { path: string; body: Record<string, unknown> } {
  const branchId = f.branchId as number;
  const attachments = khoAttachments(f);
  switch (f.type) {
    case 'tien-mat': {
      const sale = f.receiptKind === 'WAREHOUSE_SALE';
      return {
        path: '/internal-finance/warehouse-receipts',
        body: {
          branchId,
          amount: Math.round(f.amount),
          occurredAt: vnDayIso(f.date),
          description: opt(f.description),
          note: opt(f.note),
          receiptKind: f.receiptKind,
          customers: sale ? [] : f.customers.map((c) => ({ customerId: c.id })),
          ...(attachments.length ? { attachments } : {}),
        },
      };
    }
    case 'chi-khac': {
      const total = lineTotal(f);
      return {
        path: '/internal-finance/warehouse-expenses/manual',
        body: {
          branchId,
          // Có Số lượng × Đơn giá thì backend tự tính thành tiền.
          amount: total === null ? f.amount : undefined,
          quantity: f.quantity ?? undefined,
          unitPrice: f.unitPrice ?? undefined,
          occurredAt: vnDayIso(f.date),
          description: f.description.trim(),
          expenseItem: f.expenseItem || undefined,
          payerId: f.payer?.id,
          note: opt(f.note),
          attachments,
        },
      };
    }
    case 'xang-dau':
    case 'cham-soc-xe': {
      const common = {
        branchId,
        vehicleId: f.vehicleId,
        occurredAt: new Date(f.at).toISOString(),
        location: opt(f.location),
        amount: Math.round(f.amount),
        odo: f.odo ?? undefined,
        payerId: f.payer?.id,
        note: opt(f.note),
        attachments,
      };
      return f.type === 'xang-dau'
        ? { path: '/internal-finance/vehicle/fuel', body: { ...common, unitPrice: f.unitPrice ?? undefined } }
        : { path: '/internal-finance/vehicle-care', body: { ...common, serviceTypes: f.serviceTypes, dueAt: f.dueAt || undefined } };
    }
  }
}

/** Đã nhập gì so với lúc mở form (để hỏi trước khi bỏ). */
export function isKhoDirty(f: KhoForm, base: KhoForm): boolean {
  const pick = (x: KhoForm) =>
    JSON.stringify({ ...x, at: undefined, date: undefined, files: x.files.map((a) => a.key), customers: x.customers.map((c) => c.id) });
  return pick(f) !== pick(base);
}

// ---------- Phiếu vừa tạo ----------

export interface KhoCreated {
  id: number;
  code: string;
  type: KhoType;
  amount: number;
  branchName: string;
  createdAt: string;
}

export interface RawKhoEntry {
  id: number;
  code?: string | null;
  amount?: string | number | null;
  createdAt?: string | null;
}

export const toKhoCreated = (r: RawKhoEntry, f: KhoForm, branch: string, now = new Date()): KhoCreated => ({
  id: r.id,
  code: r.code || `#${r.id}`,
  type: f.type,
  amount: Number(r.amount ?? khoAmount(f)) || khoAmount(f),
  branchName: branch,
  createdAt: r.createdAt || now.toISOString(),
});
