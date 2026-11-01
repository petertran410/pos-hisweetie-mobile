import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import { http } from '@/core/http';

export type PrintKind = 'invoice' | 'order';

interface Template {
  id: number;
  isDefault?: boolean;
  paperSize?: string | null;
  orientation?: string | null;
}

export interface RenderedPrint {
  content: string;
  paperSize: string;
  landscape: boolean;
}

/** Nội dung in (HTML) theo mẫu in mặc định của loại phiếu, kèm khổ giấy của mẫu. */
export async function renderPrint(kind: PrintKind, entityId: number): Promise<RenderedPrint> {
  const templates = await http.get<Template[]>('/print-templates', { templateFor: kind, isActive: true });
  if (!templates?.length) throw new Error('Chưa có mẫu in cho loại phiếu này');
  const template = templates.find((t) => t.isDefault) ?? templates[0];
  const preview = await http.post<{ content?: string }>('/print-templates/preview', {
    templateId: template.id,
    entityId,
  });
  if (!preview?.content) throw new Error('Không tạo được nội dung in');
  return {
    content: preview.content,
    paperSize: (template.paperSize || 'A5').toUpperCase(),
    landscape: template.orientation === 'landscape',
  };
}

const PAPER_MM: Record<string, [number, number]> = {
  A4: [210, 297],
  A5: [148, 210],
  A6: [105, 148],
};
const PT_PER_MM = 72 / 25.4;
const MARGIN_MM = 8;

/** Kích thước trang (point, 72/inch) theo khổ giấy của mẫu; khổ lạ → A5. */
export function pageSizePt(paperSize: string, landscape: boolean): { width: number; height: number } {
  const [w, h] = PAPER_MM[paperSize] ?? PAPER_MM.A5;
  const [pw, ph] = landscape ? [h, w] : [w, h];
  return { width: Math.round(pw * PT_PER_MM), height: Math.round(ph * PT_PER_MM) };
}

/**
 * Thêm cột STT vào bảng hàng (giống web: mẫu in lưu sẵn không có cột này).
 * Chạy ngay trong trang in trước khi dựng PDF.
 */
const SERIAL_COLUMN_SCRIPT = `(function () {
  var GROUPS = [["san pham","ten hang","hang hoa","ma hang"],["don gia"],["so luong","sl"],["don vi","dvt"],["thanh tien"]];
  function norm(v) { return (v || "").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/\\s+/g, " ").trim(); }
  function cells(row) { return Array.prototype.filter.call(row.children, function (c) { return c.tagName === "TD" || c.tagName === "TH"; }); }
  function serial(src, value) {
    var c = document.createElement(src.tagName.toLowerCase());
    c.textContent = value;
    c.style.cssText = "width:1%;min-width:0;max-width:1%;padding-left:4px;padding-right:4px;text-align:center;white-space:nowrap;font-size:10px;";
    return c;
  }
  var tables = document.querySelectorAll(".print-content table");
  for (var t = 0; t < tables.length; t++) {
    var table = tables[t];
    var rows = Array.prototype.filter.call(table.querySelectorAll("tr"), function (r) { return r.closest("table") === table; });
    var header = null;
    for (var i = 0; i < rows.length; i++) {
      var cs = cells(rows[i]);
      if (cs.length < 3) continue;
      var text = norm(rows[i].textContent);
      var hits = GROUPS.filter(function (g) { return g.some(function (h) { return text.indexOf(h) >= 0; }); }).length;
      if (hits >= 3) { header = rows[i]; break; }
    }
    if (!header) continue;
    var hc = cells(header);
    if (hc.some(function (c) { return norm(c.textContent).indexOf("stt") >= 0; })) return;
    var cg = Array.prototype.find.call(table.children, function (c) { return c.tagName === "COLGROUP"; });
    if (!cg) { cg = document.createElement("colgroup"); table.insertBefore(cg, table.firstChild); }
    var col = document.createElement("col"); col.setAttribute("width", "1%"); cg.insertBefore(col, cg.firstChild);
    header.insertBefore(serial(hc[0], "STT"), header.firstChild);
    var n = 1;
    for (var j = rows.indexOf(header) + 1; j < rows.length; j++) {
      var rc = cells(rows[j]);
      if (!rc.length || rc.length !== hc.length || rc.some(function (c) { return c.hasAttribute("colspan"); })) continue;
      rows[j].insertBefore(serial(rc[0], String(n++)), rows[j].firstChild);
    }
    return;
  }
})();`;

/** Bề ngang trang theo px CSS (96/inch) — để bản xem trên màn hình giống tờ giấy. */
export function pageCssWidth(paperSize: string, landscape: boolean): number {
  const [w, h] = PAPER_MM[paperSize] ?? PAPER_MM.A5;
  return Math.round(((landscape ? h : w) * 96) / 25.4);
}

/**
 * Bản xem trên màn hình:
 * - báo chiều cao trang về app mỗi khi nội dung đổi (ảnh QR tải muộn vẫn đo đúng),
 * - `__hsFit()`: cuộn lên đầu, thu cả tờ phiếu vừa khung rồi báo "fitted" để app chụp ảnh,
 * - `__hsUnfit()`: trả lại như cũ.
 */
const SCREEN_SCRIPT = `(function () {
  function post(msg) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  function sendHeight() { post({ type: "height", height: document.documentElement.scrollHeight }); }
  if (window.ResizeObserver) new ResizeObserver(sendHeight).observe(document.body);
  Array.prototype.forEach.call(document.images, function (img) { img.addEventListener("load", sendHeight); });
  window.addEventListener("load", sendHeight);
  sendHeight();
  window.__hsFit = function () {
    var root = document.documentElement, body = document.body;
    window.scrollTo(0, 0);
    root.style.overflow = "hidden";
    body.style.transform = "";
    var f = window.innerHeight / root.scrollHeight;
    if (f < 1) { body.style.transformOrigin = "top center"; body.style.transform = "scale(" + f + ")"; }
    requestAnimationFrame(function () { requestAnimationFrame(function () { post({ type: "fitted" }); }); });
  };
  window.__hsUnfit = function () {
    document.documentElement.style.overflow = "";
    document.body.style.transform = "";
  };
})();`;

/**
 * Trang HTML đầy đủ (giống web), đúng khổ giấy của mẫu. `screen`: bản xem
 * trên màn hình / chụp ảnh — rộng đúng bằng tờ giấy, có lề như khi in.
 */
export function printDocument(r: RenderedPrint, opts: { screen?: boolean } = {}): string {
  const size = `${PAPER_MM[r.paperSize] ? r.paperSize : 'A5'} ${r.landscape ? 'landscape' : 'portrait'}`;
  const viewport = opts.screen ? `width=${pageCssWidth(r.paperSize, r.landscape)}` : 'width=device-width, initial-scale=1';
  const screenCss = opts.screen ? `body { padding: ${MARGIN_MM}mm; background: #fff; }` : '';
  const scripts = opts.screen ? SERIAL_COLUMN_SCRIPT + SCREEN_SCRIPT : SERIAL_COLUMN_SCRIPT;
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="${viewport}" />
<style>
@page { size: ${size}; margin: ${MARGIN_MM}mm; }
html, body { margin: 0; padding: 0; width: 100%; max-width: 100%; }
body { font-family: Arial, sans-serif; font-size: 13px; color: #000; overflow-wrap: anywhere; }
.print-content { width: 100%; max-width: 100%; }
table { width: 100% !important; max-width: 100% !important; border-collapse: collapse; }
td, th { padding: 4px 8px; }
h1, h2, h3 { margin: 8px 0; }
img, svg, canvas { max-width: 100% !important; height: auto; }
* { box-sizing: border-box; }
${screenCss}
</style></head><body><div class="print-content">${r.content}</div><script>${scripts}</script></body></html>`;
}

/** Đổi tên file tạm theo mã phiếu (vd DH000123.png) để người nhận dễ nhận ra. */
export async function renameTemp(uri: string, code: string, ext: 'pdf' | 'png'): Promise<string> {
  const safeName = `${code.replace(/[^A-Za-z0-9._-]/g, '_') || 'phieu'}.${ext}`;
  try {
    const target = new File(Paths.cache, safeName);
    if (target.exists) target.delete();
    await new File(uri).move(target);
    return target.uri;
  } catch {
    return uri;
  }
}

/** Dựng file PDF đúng khổ giấy, đặt tên theo mã phiếu (vd HD000123.pdf) để gửi đi cho dễ nhận. */
export async function makePrintPdf(r: RenderedPrint, code: string): Promise<string> {
  const margin = Math.round(MARGIN_MM * PT_PER_MM);
  const { uri } = await Print.printToFileAsync({
    html: printDocument(r),
    ...pageSizePt(r.paperSize, r.landscape),
    margins: { left: margin, right: margin, top: margin, bottom: margin },
  });
  return renameTemp(uri, code, 'pdf');
}

// ---------- Máy in đã chọn ----------

export interface SavedPrinter {
  name: string;
  url: string;
}

const PRINTER_KEY = 'hs_printer';

export async function loadPrinter(): Promise<SavedPrinter | null> {
  try {
    const raw = await AsyncStorage.getItem(PRINTER_KEY);
    const p = raw ? (JSON.parse(raw) as SavedPrinter) : null;
    return p?.url ? p : null;
  } catch {
    return null;
  }
}

/** Mở danh sách máy in (AirPrint) để chọn 1 lần; app nhớ cho lần sau. */
export async function choosePrinter(): Promise<SavedPrinter | null> {
  try {
    const p = await Print.selectPrinterAsync();
    if (!p?.url) return null;
    const saved = { name: p.name || 'Máy in', url: p.url };
    await AsyncStorage.setItem(PRINTER_KEY, JSON.stringify(saved)).catch(() => {});
    return saved;
  } catch {
    // Người dùng đóng danh sách máy in.
    return null;
  }
}

/** In thẳng tới máy in đã chọn (không qua màn tùy chọn của iOS). */
export async function printToPrinter(pdfUri: string, printer: SavedPrinter): Promise<void> {
  await Print.printAsync({ uri: pdfUri, printerUrl: printer.url });
}
