import { create } from 'zustand';
import { errorMessage } from '@/core/http';
import type { PickedFile } from '../packing/draft';
import { compressPhoto, uploadDocFile } from '../packing/media';
import type { KhoCreated, KhoCustomer, KhoFile, KhoForm } from './model';

/**
 * Phiếu kho đang nhập. Để ở store (không ở state của màn) để sheet chọn khách
 * hàng thêm thẳng vào phiếu, và ảnh đang tải ở nền không bị mất khi mở sheet.
 */
interface KhoDraftState {
  /** Tăng mỗi lần mở phiếu mới: kết quả tải ảnh của phiếu cũ bị bỏ qua. */
  draftId: number;
  form: KhoForm | null;
  baseline: KhoForm | null;
}

export const useKhoDraft = create<KhoDraftState>(() => ({ draftId: 0, form: null, baseline: null }));

export function startKhoDraft(form: KhoForm) {
  dims.clear();
  useKhoDraft.setState((s) => ({ draftId: s.draftId + 1, form, baseline: form }));
}

export function clearKhoDraft() {
  dims.clear();
  useKhoDraft.setState((s) => ({ draftId: s.draftId + 1, form: null, baseline: null }));
}

export function patchKhoDraft(patch: (f: KhoForm) => Partial<KhoForm>) {
  useKhoDraft.setState((s) => (s.form ? { form: { ...s.form, ...patch(s.form) } } : {}));
}

/** Giá trị app tự điền (vd xe của lái xe): đổi cả mốc so sánh để không bị tính là "đã nhập". */
export function presetKhoDraft(patch: Partial<KhoForm>) {
  useKhoDraft.setState((s) => (s.form && s.baseline ? { form: { ...s.form, ...patch }, baseline: { ...s.baseline, ...patch } } : {}));
}

export function setKhoCustomers(customers: KhoCustomer[]) {
  patchKhoDraft(() => ({ customers }));
}

// ---------- Phiếu vừa tạo (trong lần mở app này) ----------

const RECENT_MAX = 20;

export const useKhoRecent = create<{ items: KhoCreated[] }>(() => ({ items: [] }));

export function addKhoRecent(item: KhoCreated) {
  useKhoRecent.setState((s) => ({ items: [item, ...s.items.filter((x) => !(x.id === item.id && x.type === item.type))].slice(0, RECENT_MAX) }));
}

// ---------- Tải ảnh / tệp ngay khi chọn ----------

/** Tải tối đa 3 tệp cùng lúc: đủ nhanh mà không nghẽn mạng 4G. */
const LIMIT = 3;
const running = new Set<string>();
/** Kích thước gốc để thu nhỏ đúng tỉ lệ (không cần lưu trong form). */
const dims = new Map<string, { width?: number; height?: number; size?: number | null }>();

let seq = 0;
const newKey = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;

function setFile(key: string, patch: Partial<KhoFile>) {
  patchKhoDraft((f) => ({ files: f.files.map((a) => (a.key === key ? { ...a, ...patch } : a)) }));
}

/** Đưa ảnh / tệp vào hàng chờ tải (nhóm `kind`); hiện ngay ảnh xem trước trên máy. */
export function enqueueKhoFiles(kind: string, picked: PickedFile[]) {
  if (!picked.length) return;
  const items: KhoFile[] = picked.map((p) => {
    const key = newKey();
    dims.set(key, { width: p.width, height: p.height, size: p.size });
    return {
      key,
      kind,
      uri: p.uri,
      url: null,
      state: 'queued',
      name: p.name || 'Tệp',
      type: p.type ?? null,
      size: p.size ?? null,
    };
  });
  patchKhoDraft((f) => ({ files: [...f.files, ...items] }));
  pump();
}

export function retryKhoFile(key: string) {
  setFile(key, { state: 'queued', error: undefined });
  pump();
}

export function removeKhoFile(key: string) {
  dims.delete(key);
  patchKhoDraft((f) => ({ files: f.files.filter((a) => a.key !== key) }));
}

/** Tệp chờ tải tiếp theo; null khi không còn hoặc đã đủ luồng. */
export function nextKhoQueued(files: KhoFile[], busy: ReadonlySet<string>, limit = LIMIT): KhoFile | null {
  if (busy.size >= limit) return null;
  return files.find((a) => a.state === 'queued' && !busy.has(a.key)) ?? null;
}

const isImage = (a: { type: string | null; name: string }) => (a.type ?? '').startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/i.test(a.name);

/** Ảnh nén về JPEG thì đổi đuôi tên tệp cho khớp (vd IMG_1.HEIC → IMG_1.jpg). */
export const jpgName = (name: string) => (/\.(jpe?g)$/i.test(name) ? name : `${name.replace(/\.[a-z0-9]+$/i, '')}.jpg`);

function pump() {
  for (;;) {
    const { form, draftId } = useKhoDraft.getState();
    if (!form) return;
    const item = nextKhoQueued(form.files, running);
    if (!item) return;
    running.add(item.key);
    setFile(item.key, { state: 'uploading', error: undefined });
    const job = async () => {
      if (isImage(item)) {
        // Ảnh: thu nhỏ + nén trên máy rồi gửi như tệp chứng từ (giống web: /upload/files).
        const d = dims.get(item.key);
        const small = await compressPhoto(item.uri, d?.width, d?.height, d?.size, item.type);
        const name = small.type === 'image/jpeg' ? jpgName(item.name) : item.name;
        return uploadDocFile({ uri: small.uri, name, type: small.type });
      }
      return uploadDocFile({ uri: item.uri, name: item.name, type: item.type });
    };
    job()
      .then((r) => {
        // Phiếu đã đóng / mở phiếu khác trong lúc tải: bỏ kết quả.
        if (useKhoDraft.getState().draftId !== draftId) return;
        dims.delete(item.key);
        setFile(item.key, { state: 'done', url: r.url, size: r.size, type: r.type, name: r.name });
      })
      .catch((e: unknown) => {
        if (useKhoDraft.getState().draftId !== draftId) return;
        setFile(item.key, { state: 'error', error: errorMessage(e) });
      })
      .finally(() => {
        running.delete(item.key);
        pump();
      });
  }
}

/**
 * Chờ ảnh / tệp đang tải xong (lỗi cũng tính là xong) để lưu phiếu. Trả về form
 * mới nhất, hoặc null nếu phiếu đã bị đóng trong lúc chờ.
 */
export function waitForKhoUploads(): Promise<KhoForm | null> {
  const busy = (f: KhoForm) => f.files.some((a) => a.state === 'queued' || a.state === 'uploading');
  const { form, draftId } = useKhoDraft.getState();
  if (!form || !busy(form)) return Promise.resolve(form);
  return new Promise((resolve) => {
    const stop = useKhoDraft.subscribe((s) => {
      if (s.draftId !== draftId || !s.form) {
        stop();
        resolve(null);
      } else if (!busy(s.form)) {
        stop();
        resolve(s.form);
      }
    });
  });
}
