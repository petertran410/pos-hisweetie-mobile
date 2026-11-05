import { create } from 'zustand';
import { errorMessage } from '@/core/http';
import { compressPhoto, uploadDocFile, uploadPhoto } from './media';
import { addDocs, imageSubfolder, pendingUploads, withDocs, type Attachment, type DocItem, type PackForm } from './model';

/**
 * Phiếu đang tạo / sửa. Để ở store (không ở state của màn) để các màn chọn
 * chứng từ, quét QR thêm thẳng vào phiếu.
 */
interface PackDraftState {
  /** Tăng mỗi lần mở phiếu mới: kết quả tải ảnh của phiếu cũ bị bỏ qua. */
  draftId: number;
  /** Đang sửa phiếu nào (null = tạo mới). */
  editId: number | null;
  form: PackForm | null;
  baseline: PackForm | null;
}

export const usePackDraft = create<PackDraftState>(() => ({ draftId: 0, editId: null, form: null, baseline: null }));

export function startPackDraft(form: PackForm, editId: number | null = null) {
  usePackDraft.setState((s) => ({ draftId: s.draftId + 1, editId, form, baseline: form }));
}

export function clearPackDraft() {
  usePackDraft.setState((s) => ({ draftId: s.draftId + 1, editId: null, form: null, baseline: null }));
}

export function patchPackDraft(patch: (f: PackForm) => Partial<PackForm>) {
  usePackDraft.setState((s) => (s.form ? { form: { ...s.form, ...patch(s.form) } } : {}));
}

/** Thêm chứng từ vào phiếu đang mở; trả lỗi (nếu có) để báo cho người dùng. */
export function addDocsToDraft(docs: DocItem[]): { error: string | null; added: number } {
  const form = usePackDraft.getState().form;
  if (!form) return { error: 'Không có phiếu đang nhập', added: 0 };
  const res = addDocs(form, docs);
  usePackDraft.setState({ form: res.form });
  return { error: res.error, added: res.added };
}

export function removeDocFromDraft(id: number) {
  usePackDraft.setState((s) => (s.form ? { form: withDocs(s.form, s.form.docs.filter((d) => d.id !== id)) } : {}));
}

// ---------- Tải ảnh / tệp ngay khi chọn ----------

type ListKey = 'images' | 'files';

/** Tải tối đa 3 tệp cùng lúc: đủ nhanh mà không nghẽn mạng 4G. */
const LIMIT = 3;
const running = new Set<string>();
/** Kích thước gốc để thu nhỏ đúng tỉ lệ (không cần lưu trong form). */
const dims = new Map<string, { width?: number; height?: number; size?: number | null }>();

let seq = 0;
const newKey = () => `a${Date.now().toString(36)}${(seq++).toString(36)}`;

export interface PickedFile {
  uri: string;
  name?: string | null;
  type?: string | null;
  size?: number | null;
  width?: number;
  height?: number;
}

function setAttachment(list: ListKey, key: string, patch: Partial<Attachment>) {
  patchPackDraft((f) => ({ [list]: f[list].map((a) => (a.key === key ? { ...a, ...patch } : a)) }));
}

/** Đưa ảnh / tệp vào hàng chờ tải; hiện ngay ảnh xem trước trên máy. */
export function enqueueAttachments(list: ListKey, picked: PickedFile[]) {
  if (!picked.length) return;
  const items: Attachment[] = picked.map((p) => {
    const key = newKey();
    dims.set(key, { width: p.width, height: p.height, size: p.size });
    return {
      key,
      uri: p.uri,
      url: null,
      state: 'queued',
      name: p.name || (list === 'images' ? 'Ảnh' : 'Tệp'),
      type: p.type ?? (list === 'images' ? 'image/jpeg' : null),
      size: p.size ?? null,
    };
  });
  patchPackDraft((f) => ({ [list]: [...f[list], ...items] }));
  pump();
}

export function retryAttachment(list: ListKey, key: string) {
  setAttachment(list, key, { state: 'queued', error: undefined });
  pump();
}

export function removeAttachment(list: ListKey, key: string) {
  dims.delete(key);
  patchPackDraft((f) => ({ [list]: f[list].filter((a) => a.key !== key) }));
}

/** Mục chờ tải tiếp theo (ảnh trước, tệp sau); null khi không còn hoặc đã đủ luồng. */
export function nextQueued(form: PackForm, busy: ReadonlySet<string>, limit = LIMIT): { list: ListKey; item: Attachment } | null {
  if (busy.size >= limit) return null;
  for (const list of ['images', 'files'] as const) {
    const item = form[list].find((a) => a.state === 'queued' && !busy.has(a.key));
    if (item) return { list, item };
  }
  return null;
}

function pump() {
  for (;;) {
    const { form, draftId } = usePackDraft.getState();
    if (!form) return;
    const next = nextQueued(form, running);
    if (!next) return;
    const { list, item } = next;
    running.add(item.key);
    setAttachment(list, item.key, { state: 'uploading', error: undefined });
    const isImage = list === 'images' || (item.type ?? '').startsWith('image/');
    const job = async () => {
      if (isImage) {
        const d = dims.get(item.key);
        const small = await compressPhoto(item.uri, d?.width, d?.height, d?.size, item.type);
        if (list === 'images') {
          const up = await uploadPhoto(small.uri, imageSubfolder(form.type, form.docMode), small.type);
          return { url: up.url, size: up.size, type: small.type, name: item.name };
        }
        const name = small.type === 'image/jpeg' && !/\.(jpe?g)$/i.test(item.name) ? `${item.name.replace(/\.[a-z0-9]+$/i, '')}.jpg` : item.name;
        return uploadDocFile({ uri: small.uri, name, type: small.type });
      }
      return uploadDocFile({ uri: item.uri, name: item.name, type: item.type });
    };
    job()
      .then((r) => {
        // Phiếu đã đóng / mở phiếu khác trong lúc tải: bỏ kết quả.
        if (usePackDraft.getState().draftId !== draftId) return;
        dims.delete(item.key);
        setAttachment(list, item.key, { state: 'done', url: r.url, size: r.size, type: r.type, name: r.name });
      })
      .catch((e: unknown) => {
        if (usePackDraft.getState().draftId !== draftId) return;
        setAttachment(list, item.key, { state: 'error', error: errorMessage(e) });
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
export function waitForUploads(): Promise<PackForm | null> {
  const busy = (f: PackForm) => pendingUploads(f).some((a) => a.state === 'queued' || a.state === 'uploading');
  const { form, draftId } = usePackDraft.getState();
  if (!form || !busy(form)) return Promise.resolve(form);
  return new Promise((resolve) => {
    const stop = usePackDraft.subscribe((s) => {
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
