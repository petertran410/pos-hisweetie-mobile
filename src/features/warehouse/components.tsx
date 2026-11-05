import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { dateTimeVN, dateVN, money, shortWhen } from '@/core/format';
import { accents, accentSoft, C, Icon, PressableScale, radius, Txt } from '@/ui';
import { AttachmentTile, FileLine } from '../packing/components';
import { isImageFile } from '../packing/model';
import { KHO_TYPES, type KhoCreated, type KhoFile, type KhoType } from './model';

/** yyyy-mm-dd (giờ Việt Nam) ↔ Date đặt ở 12 giờ trưa để đổi múi giờ không lệch ngày. */
export const dayToDate = (day: string) => new Date(`${day}T12:00:00+07:00`);
export const dateToDay = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

/**
 * Dòng chọn ngày / ngày giờ trong thẻ form: bộ chọn gọn của iOS (bấm mở lịch).
 * Bản xem trên web chỉ hiện chữ.
 */
export function DateRow({
  label,
  value,
  mode,
  onChange,
  maximumDate,
}: {
  label: string;
  value: Date;
  mode: 'date' | 'datetime';
  onChange: (d: Date) => void;
  maximumDate?: Date;
}) {
  return (
    <View style={styles.row}>
      <Txt variant="body" color={C.muted} style={{ flex: 1 }}>
        {label}
      </Txt>
      {Platform.OS === 'web' ? (
        <Txt variant="body" weight="semibold" numeric>
          {mode === 'date' ? dateVN(value) : dateTimeVN(value)}
        </Txt>
      ) : (
        <DateTimePicker
          value={value}
          mode={mode}
          display="compact"
          locale="vi-VN"
          accentColor={C.brand}
          maximumDate={maximumDate}
          onValueChange={(_e, d) => onChange(d)}
        />
      )}
    </View>
  );
}

/** Ngày không bắt buộc (vd hạn đăng kiểm): chưa chọn thì có nút "Chọn ngày", đã chọn thì có nút bỏ. */
export function OptionalDateRow({ label, value, onChange }: { label: string; value: string | null; onChange: (day: string | null) => void }) {
  if (!value) {
    return (
      <PressableScale onPress={() => onChange(dateToDay(new Date()))} accessibilityRole="button" accessibilityLabel={`${label}: chưa chọn. Bấm để chọn`} scaleTo={0.985} style={styles.row}>
        <Txt variant="body" color={C.muted} style={{ flex: 1 }}>
          {label}
        </Txt>
        <Txt variant="body" color={C.faint}>
          Không bắt buộc
        </Txt>
        <Icon name="plus" size={16} color={C.brand} />
      </PressableScale>
    );
  }
  return (
    <View style={styles.row}>
      <Txt variant="body" color={C.muted} style={{ flex: 1 }}>
        {label}
      </Txt>
      {Platform.OS === 'web' ? (
        <Txt variant="body" weight="semibold" numeric>
          {dateVN(dayToDate(value))}
        </Txt>
      ) : (
        <DateTimePicker value={dayToDate(value)} mode="date" display="compact" locale="vi-VN" accentColor={C.brand} onValueChange={(_e, d) => onChange(dateToDay(d))} />
      )}
      <PressableScale onPress={() => onChange(null)} accessibilityLabel={`Bỏ ${label.toLowerCase()}`} hitSlop={10} scaleTo={0.85} style={styles.clear}>
        <Icon name="x" size={14} color={C.muted} />
      </PressableScale>
    </View>
  );
}

const COLS = 4;

/**
 * Một nhóm chứng từ (vd "Đồng hồ cây xăng", "Hóa đơn"): ảnh hiện ngay và tải ở
 * nền, tệp PDF hiện thành dòng. Lỗi bấm để xem lý do / thử lại.
 */
export function FileGroup({
  label,
  files,
  onCamera,
  onLibrary,
  onFile,
  onView,
  onRetry,
  onRemove,
}: {
  label: string;
  files: KhoFile[];
  onCamera: () => void;
  onLibrary: () => void;
  onFile: () => void;
  onView: (uri: string) => void;
  onRetry: (f: KhoFile) => void;
  onRemove: (f: KhoFile) => void;
}) {
  const { width } = useWindowDimensions();
  const size = Math.floor((width - 32 - 28 - (COLS - 1) * 8) / COLS);
  const images = files.filter((a) => isImageFile({ type: a.type, name: a.name, url: a.url }));
  const docs = files.filter((a) => !images.includes(a));
  const busy = files.filter((a) => a.state === 'queued' || a.state === 'uploading').length;
  const failed = files.filter((a) => a.state === 'error').length;
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.groupHead}>
        <Txt variant="heading" style={{ flex: 1 }}>
          {label}
          {files.length ? ` · ${files.length}` : ''}
        </Txt>
        {busy || failed ? (
          <Txt variant="caption" color={failed ? '#B91C1C' : C.muted}>
            {busy ? `Đang tải lên ${busy}…` : `${failed} tệp lỗi, bấm để thử lại`}
          </Txt>
        ) : null}
      </View>
      <View style={styles.card}>
        <View style={styles.grid}>
          {images.map((a) => (
            <AttachmentTile key={a.key} item={a} size={size} onOpen={() => onView(a.uri)} onRetry={() => onRetry(a)} onRemove={() => onRemove(a)} />
          ))}
          <AddTile size={size} icon="camera" label="Chụp" onPress={onCamera} a11y={`Chụp ảnh ${label.toLowerCase()}`} />
          <AddTile size={size} icon="images" label="Thư viện" onPress={onLibrary} a11y={`Chọn ảnh ${label.toLowerCase()} có sẵn`} />
          <AddTile size={size} icon="paperclip" label="Tệp" onPress={onFile} a11y={`Chọn tệp ${label.toLowerCase()}`} />
        </View>
        {docs.map((a) => (
          <FileLine key={a.key} name={a.name} size={a.size} state={a.state} onRetry={() => onRetry(a)} onRemove={() => onRemove(a)} />
        ))}
      </View>
    </View>
  );
}

function AddTile({ size, icon, label, onPress, a11y }: { size: number; icon: 'camera' | 'images' | 'paperclip'; label: string; onPress: () => void; a11y: string }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} scaleTo={0.95} style={[styles.add, { width: size, height: size }]}>
      <Icon name={icon} size={22} color={C.brand} />
      <Txt variant="caption" weight="semibold" color={C.brand}>
        {label}
      </Txt>
    </PressableScale>
  );
}

/** Ô tạo phiếu trên trang Phiếu kho. */
export function KhoTile({ type, onPress }: { type: KhoType; onPress: () => void }) {
  const t = KHO_TYPES[type];
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Tạo ${t.label.toLowerCase()}`} scaleTo={0.96} style={[styles.tile, { backgroundColor: accentSoft[t.color] }]}>
      <View style={[styles.tileIcon, { backgroundColor: C.card }]}>
        <Icon name={t.icon} size={24} color={accents[t.color]} />
      </View>
      <Txt variant="label" weight="semibold" color={accents[t.color]} align="center" numberOfLines={2}>
        {t.label}
      </Txt>
    </PressableScale>
  );
}

/** Một phiếu vừa tạo trong lần mở app này. */
export function RecentRow({ item, now }: { item: KhoCreated; now?: Date }) {
  const t = KHO_TYPES[item.type];
  return (
    <View style={styles.recent}>
      <View style={[styles.recentIcon, { backgroundColor: accentSoft[t.color] }]}>
        <Icon name={t.icon} size={18} color={accents[t.color]} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Txt variant="label" weight="semibold" numeric numberOfLines={1}>
          {item.code} · {t.label}
        </Txt>
        <Txt variant="caption" color={C.muted} numeric numberOfLines={1}>
          {[item.branchName, shortWhen(item.createdAt, now)].filter(Boolean).join(' · ')}
        </Txt>
      </View>
      <Txt variant="label" weight="bold" numeric>
        {money(item.amount)} ₫
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingVertical: 6 },
  clear: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2F6' },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  card: {
    padding: 14,
    gap: 4,
    borderRadius: radius.card,
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  add: {
    borderRadius: 12,
    borderWidth: 1.4,
    borderStyle: 'dashed',
    borderColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: C.brandSoft,
  },
  tile: { flex: 1, minHeight: 104, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
  tileIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  recentIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
