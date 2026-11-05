import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { http } from '@/core/http';

/** Cạnh dài tối đa của ảnh gửi lên (máy chủ cũng thu về 1920px). */
export const MAX_SIDE = 1920;
/** Chất lượng JPEG: ảnh chụp 3–5 MB còn khoảng 300–500 KB, vẫn đọc rõ chữ trên hóa đơn. */
const QUALITY = 0.72;
/** Ảnh nhỏ hơn mức này và không cần thu nhỏ thì gửi thẳng (giống web): nén lại không đáng, chỉ làm mờ thêm. */
export const SKIP_COMPRESS_BYTES = 400 * 1024;

/** Có cần nén trên máy không (ảnh đã nhỏ cả dung lượng lẫn kích thước thì gửi thẳng). */
export function needsCompress(size: number | null | undefined, width?: number, height?: number): boolean {
  const small = !!size && size > 0 && size < SKIP_COMPRESS_BYTES;
  const fits = !!width && !!height && Math.max(width, height) <= MAX_SIDE;
  return !(small && fits);
}

/** Kích thước mới giữ tỉ lệ, cạnh dài không quá `max`; null = không cần thu nhỏ. */
export function fitSize(width: number, height: number, max = MAX_SIDE): { width: number } | { height: number } | null {
  if (!(width > 0) || !(height > 0) || Math.max(width, height) <= max) return null;
  return width >= height ? { width: max } : { height: max };
}

/**
 * Thu nhỏ + nén ảnh trên máy trước khi gửi (giảm 80–90% dung lượng, gửi nhanh
 * hơn nhiều trên 4G). Lỗi thì gửi ảnh gốc, máy chủ vẫn tự thu nhỏ.
 */
export async function compressPhoto(
  uri: string,
  width?: number,
  height?: number,
  size?: number | null,
  type?: string | null,
): Promise<{ uri: string; type: string }> {
  if (!needsCompress(size, width, height)) return { uri, type: type || 'image/jpeg' };
  try {
    const ctx = ImageManipulator.manipulate(uri);
    const target = width && height ? fitSize(width, height) : null;
    if (target) ctx.resize(target);
    const ref = await ctx.renderAsync();
    // Không biết trước kích thước (ảnh từ tệp): đo rồi mới thu nhỏ.
    let out = ref;
    if (!target) {
      const late = fitSize(ref.width, ref.height);
      if (late) {
        const again = ImageManipulator.manipulate(ref);
        again.resize(late);
        out = await again.renderAsync();
        again.release();
      }
    }
    const saved = await out.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
    ctx.release();
    ref.release();
    if (out !== ref) out.release();
    return { uri: saved.uri, type: 'image/jpeg' };
  } catch {
    return { uri, type: 'image/jpeg' };
  }
}

const extOf = (name: string, type: string | null) => {
  const fromName = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  if (type === 'image/png') return 'png';
  if (type === 'application/pdf') return 'pdf';
  return 'jpg';
};

/** Gửi 1 ảnh (`POST /upload/image`), trả về đường dẫn trên máy chủ. */
export async function uploadPhoto(uri: string, subfolder: string, type = 'image/jpeg'): Promise<{ url: string; size: number | null }> {
  const form = new FormData();
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : /hei[cf]/.test(type) ? 'heic' : 'jpg';
  // React Native gửi tệp theo { uri, name, type }.
  form.append('file', { uri, name: `photo-${Date.now()}.${ext}`, type } as unknown as Blob);
  const res = await http.upload<{ url?: string; size?: number }>(`/upload/image?subfolder=${encodeURIComponent(subfolder)}`, form);
  if (!res?.url) throw new Error('Tải ảnh lên không thành công');
  return { url: res.url, size: res.size ?? null };
}

/** Gửi 1 tệp chứng từ chi phí (`POST /upload/files`), giữ tên gốc để hiện lại. */
export async function uploadDocFile(
  file: { uri: string; name: string; type: string | null },
  subfolder = 'bao-don/chi-phi',
): Promise<{ url: string; name: string; type: string | null; size: number | null }> {
  const type = file.type || 'application/octet-stream';
  const name = file.name || `tep-${Date.now()}.${extOf(file.name, type)}`;
  const form = new FormData();
  form.append('files', { uri: file.uri, name, type } as unknown as Blob);
  form.append('originalNames', JSON.stringify([name]));
  const res = await http.upload<{ items?: { url?: string; size?: number; mimetype?: string; originalname?: string }[]; errors?: { reason?: string }[] }>(
    `/upload/files?subfolder=${encodeURIComponent(subfolder)}`,
    form,
  );
  const item = res?.items?.[0];
  if (!item?.url) throw new Error(res?.errors?.[0]?.reason || 'Tải tệp lên không thành công');
  return { url: item.url, name: item.originalname || name, type: item.mimetype ?? type, size: item.size ?? null };
}
