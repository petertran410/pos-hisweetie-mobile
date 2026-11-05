import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { dateVN, money, shortWhen } from '@/core/format';
import { accents, accentSoft, C, Icon, PressableScale, radius, toneColors, Txt } from '@/ui';
import { PACK_TYPES, type Attachment, type DocItem, type PackRow, type PackType } from './model';
import { mediaUri } from '@/core/config';

/** Ảnh trên máy (đang chờ tải) hoặc ảnh HTTPS đã tải lên (không tải ảnh qua http thường). */
export const isSafeImage = (uri: string) =>
  uri.startsWith('https://') || uri.startsWith('file://') || uri.startsWith('ph://') || (__DEV__ && uri.startsWith('http://'));

export function TypeBadge({ type, small }: { type: PackType; small?: boolean }) {
  const t = PACK_TYPES[type];
  return (
    <View style={[styles.badge, { backgroundColor: accentSoft[t.color] }, small ? styles.badgeSmall : null]}>
      <Icon name={t.icon} size={small ? 12 : 14} color={accents[t.color]} />
      <Txt variant="caption" weight="semibold" color={accents[t.color]}>
        {t.label}
      </Txt>
    </View>
  );
}

function Meta({ icon, label, tone }: { icon: Parameters<typeof Icon>[0]['name']; label: string; tone?: string }) {
  return (
    <View style={styles.meta}>
      <Icon name={icon} size={13} color={tone ?? C.muted} />
      <Txt variant="caption" color={tone ?? C.muted} numeric numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

/** Thẻ 1 phiếu trong danh sách. */
export function PackCard({ row, onPress, now }: { row: PackRow; onPress: () => void; now?: Date }) {
  const codes = row.docCodes.length > 2 ? `${row.docCodes.slice(0, 2).join(', ')} +${row.docCodes.length - 2}` : row.docCodes.join(', ');
  const a11y = [row.code, PACK_TYPES[row.type].label, row.cancelled ? 'đã hủy' : null, row.who, `${row.packages} kiện`].filter(Boolean).join(', ');
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} scaleTo={0.985} style={[styles.card, row.cancelled ? { opacity: 0.6 } : null]}>
      <View style={styles.cardHead}>
        <Txt variant="body" weight="bold" numeric style={{ flexShrink: 1 }} numberOfLines={1}>
          {row.code}
        </Txt>
        {row.cancelled ? (
          <View style={[styles.badge, { backgroundColor: toneColors.danger.bg }]}>
            <Txt variant="caption" weight="semibold" color={toneColors.danger.fg}>
              Đã hủy
            </Txt>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <TypeBadge type={row.type} small />
      </View>
      <Txt variant="body" weight="semibold" numberOfLines={1}>
        {row.who}
      </Txt>
      {codes ? (
        <Txt variant="caption" color={C.muted} numeric numberOfLines={1}>
          {codes}
        </Txt>
      ) : null}
      <View style={styles.metaRow}>
        <Meta icon="package" label={`${row.packages} kiện`} />
        {row.imageCount ? <Meta icon="images" label={`${row.imageCount} ảnh`} /> : null}
        {row.coldCount ? <Meta icon="snowflake" label={`Hàng lạnh · ${row.coldCount}`} tone={accents.blue} /> : null}
        {row.cash !== null ? <Meta icon="banknote" label={`Thu ${money(row.cash)}`} tone={toneColors.warning.fg} /> : null}
        {row.transfer ? <Meta icon="landmark" label="Chuyển khoản" /> : null}
      </View>
      <Txt variant="caption" color={C.faint} numeric numberOfLines={1}>
        {[shortWhen(row.createdAt, now), row.creatorName].filter(Boolean).join(' · ')}
      </Txt>
    </PressableScale>
  );
}

/** Một chứng từ trong phiếu: mã, khách, ngày (không hiện tổng tiền); có nút bỏ khi đang sửa. */
export function DocRow({ doc, onPress, onRemove, packLabel }: { doc: DocItem; onPress?: () => void; onRemove?: () => void; packLabel?: string }) {
  const body = (
    <>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="label" weight="semibold" color={onPress ? C.brand : C.text} numeric numberOfLines={1}>
          {doc.code}
          {doc.kind === 'consignment' ? ' · Ký gửi' : ''}
        </Txt>
        <Txt variant="caption" color={C.muted} numeric numberOfLines={1}>
          {[doc.customerName, doc.date ? dateVN(doc.date) : null].filter(Boolean).join(' · ') || '—'}
        </Txt>
        {doc.coldCount || doc.packingCount || doc.payNote?.cash ? (
          <View style={styles.metaRow}>
            {doc.payNote?.cash ? (
              <Meta icon="banknote" label={doc.payNote.amount ? `Thu tiền mặt ${money(doc.payNote.amount)}` : 'Thu tiền mặt'} tone={toneColors.warning.fg} />
            ) : null}
            {doc.coldCount ? <Meta icon="snowflake" label={`Hàng lạnh · ${doc.coldCount}`} tone={accents.blue} /> : null}
            {doc.packingCount ? <Meta icon="clipboard-list" label={`${packLabel ?? 'Đã báo'} ${doc.packingCount} lần`} tone={toneColors.warning.fg} /> : null}
          </View>
        ) : null}
      </View>
    </>
  );
  return (
    <View style={styles.docRow}>
      {onPress ? (
        <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Mở ${doc.code}`} scaleTo={0.98} style={styles.docBody}>
          {body}
        </PressableScale>
      ) : (
        <View style={styles.docBody}>{body}</View>
      )}
      {onRemove ? (
        <PressableScale onPress={onRemove} accessibilityLabel={`Bỏ ${doc.code}`} hitSlop={10} scaleTo={0.85} style={styles.remove}>
          <Icon name="x" size={16} color={C.muted} />
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Ô ảnh: ảnh nhỏ + trạng thái tải (đang tải / lỗi bấm để thử lại) + nút xóa. */
export function AttachmentTile({
  item,
  size,
  onOpen,
  onRemove,
  onRetry,
}: {
  item: Attachment;
  size: number;
  onOpen?: () => void;
  onRemove?: () => void;
  onRetry?: () => void;
}) {
  const failed = item.state === 'error';
  const busy = item.state === 'uploading' || item.state === 'queued';
  const src = mediaUri(item.uri);
  return (
    <View style={{ width: size, height: size }}>
      <PressableScale
        onPress={failed ? onRetry : onOpen}
        accessibilityRole="button"
        accessibilityLabel={failed ? `Tải lại ${item.name}` : `Xem ${item.name}`}
        scaleTo={0.96}
        style={[styles.tile, { width: size, height: size }]}>
        {isSafeImage(src) ? (
          <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={item.key} transition={120} />
        ) : (
          <Icon name="images" size={22} color={C.faint} />
        )}
        {busy ? (
          <View style={styles.tileOverlay}>
            <ActivityIndicator color={C.white} />
          </View>
        ) : failed ? (
          <View style={[styles.tileOverlay, { backgroundColor: 'rgba(185,28,28,0.55)' }]}>
            <Icon name="refresh-cw" size={18} color={C.white} />
            <Txt variant="caption" weight="semibold" color={C.white}>
              Thử lại
            </Txt>
          </View>
        ) : null}
      </PressableScale>
      {onRemove ? (
        <PressableScale onPress={onRemove} accessibilityLabel={`Xóa ${item.name}`} hitSlop={8} scaleTo={0.85} style={styles.tileRemove}>
          <Icon name="x" size={12} color={C.white} />
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Dòng tệp chứng từ chi phí (tệp không phải ảnh: PDF, Excel…). */
export function FileLine({ name, size, state, onOpen, onRemove, onRetry }: {
  name: string;
  size: number | null;
  state?: Attachment['state'];
  onOpen?: () => void;
  onRemove?: () => void;
  onRetry?: () => void;
}) {
  const failed = state === 'error';
  const busy = state === 'uploading' || state === 'queued';
  const kb = size ? (size >= 1_048_576 ? `${(size / 1_048_576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(size / 1024))} KB`) : null;
  return (
    <View style={styles.fileRow}>
      <PressableScale
        onPress={failed ? onRetry : onOpen}
        disabled={busy || (!failed && !onOpen)}
        accessibilityRole="button"
        accessibilityLabel={failed ? `Tải lại ${name}` : `Mở ${name}`}
        scaleTo={0.98}
        style={styles.fileBody}>
        <Icon name="file-text" size={20} color={failed ? toneColors.danger.fg : C.brand} />
        <View style={{ flex: 1, gap: 1 }}>
          <Txt variant="label" weight="semibold" numberOfLines={1}>
            {name}
          </Txt>
          <Txt variant="caption" color={failed ? toneColors.danger.fg : C.muted} numberOfLines={1}>
            {busy ? 'Đang tải lên…' : failed ? 'Tải lên lỗi · bấm để thử lại' : (kb ?? 'Đã tải lên')}
          </Txt>
        </View>
        {busy ? <ActivityIndicator color={C.brand} /> : null}
      </PressableScale>
      {onRemove ? (
        <PressableScale onPress={onRemove} accessibilityLabel={`Xóa ${name}`} hitSlop={10} scaleTo={0.85} style={styles.remove}>
          <Icon name="x" size={16} color={C.muted} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  badgeSmall: { paddingHorizontal: 7, paddingVertical: 2 },
  card: { padding: 14, gap: 4, borderRadius: radius.card, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2, marginTop: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  remove: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2F6' },
  tile: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#EEF2F6', alignItems: 'center', justifyContent: 'center' },
  tileOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: 'rgba(16,33,40,0.4)' },
  tileRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,33,40,0.75)',
    borderWidth: 1.5,
    borderColor: C.white,
  },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fileBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
});
