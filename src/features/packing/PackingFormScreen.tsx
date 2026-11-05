import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, usePreventRemove } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money } from '@/core/format';
import { errorMessage } from '@/core/http';
import { useSession, type Branch } from '@/core/session';
import {
  Button,
  C,
  ChipGroup,
  Divider,
  EmptyState,
  Icon,
  ImageViewer,
  MoneyField,
  Page,
  PressableScale,
  radius,
  Select,
  SubHeader,
  toast,
  toneColors,
  Txt,
} from '@/ui';
import { useStaff } from '../customers/api';
import { FormCard, Note, NumRow, SwitchRow, TextRow } from '../products/formParts';
import { createPacking, refreshAfterPacking, updatePacking } from './api';
import { AttachmentTile, CashWarningNote, DocRow, FileLine } from './components';
import {
  clearPackDraft,
  enqueueAttachments,
  patchPackDraft,
  removeAttachment,
  removeDocFromDraft,
  retryAttachment,
  startPackDraft,
  usePackDraft,
  waitForUploads,
  type PickedFile,
} from './draft';
import {
  applyDocPay,
  buildPackPayload,
  cashWarningOf,
  docPay,
  FEES,
  isImageFile,
  isPackDirty,
  newPackForm,
  PACK_TYPES,
  packPerms,
  pendingUploads,
  validatePackForm,
  type Attachment,
  type DocMode,
  type PackForm,
  type PackPerms,
} from './model';
import { mediaUri } from '@/core/config';

/** Ảnh tối đa trên 1 phiếu (đủ chụp hàng, kiện, biên nhận). */
export const MAX_PHOTOS = 30;
const COLS = 4;

const DOC_MODES: { value: DocMode; label: string }[] = [
  { value: 'invoice', label: 'Hóa đơn' },
  { value: 'consignment', label: 'Phiếu ký gửi' },
];
const PAY_METHODS = [
  { value: 'transfer' as const, label: 'Chuyển khoản' },
  { value: 'cash' as const, label: 'Tiền mặt' },
];

/** Chụp ảnh bằng camera (hỏi quyền trước; đã từ chối thì chỉ đường mở Cài đặt). */
async function takePhoto(): Promise<PickedFile[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Chưa có quyền camera', 'Bật quyền camera cho app trong Cài đặt để chụp ảnh báo đơn.', [
      { text: 'Để sau', style: 'cancel' },
      { text: 'Mở Cài đặt', onPress: () => void Linking.openSettings() },
    ]);
    return [];
  }
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });
  if (res.canceled) return [];
  return res.assets.map((a) => ({ uri: a.uri, name: a.fileName ?? 'Ảnh chụp', type: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? null, width: a.width, height: a.height }));
}

async function pickPhotos(limit: number): Promise<PickedFile[]> {
  if (limit <= 0) return [];
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    orderedSelection: true,
    quality: 0.9,
    exif: false,
  });
  if (res.canceled) return [];
  return res.assets
    .slice(0, limit)
    .map((a) => ({ uri: a.uri, name: a.fileName ?? 'Ảnh', type: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? null, width: a.width, height: a.height }));
}

async function pickDocuments(): Promise<PickedFile[]> {
  const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: '*/*' });
  if (res.canceled) return [];
  return res.assets.map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType ?? null, size: a.size ?? null }));
}

/** Bấm ảnh / tệp tải lỗi: nói rõ lý do rồi cho thử lại hoặc bỏ. */
function askRetry(list: 'images' | 'files', a: Attachment) {
  Alert.alert(list === 'images' ? 'Ảnh chưa tải lên được' : 'Tệp chưa tải lên được', a.error || 'Có lỗi xảy ra, vui lòng thử lại.', [
    { text: 'Bỏ', style: 'destructive', onPress: () => removeAttachment(list, a.key) },
    { text: 'Thử lại', onPress: () => retryAttachment(list, a.key) },
  ]);
}

/** Lưới ảnh đang nhập: ảnh hiện ngay, tải lên ở nền, lỗi bấm để xem lý do / thử lại. */
function PhotoEditor({
  items,
  list,
  onAddCamera,
  onAddLibrary,
  onView,
}: {
  items: Attachment[];
  list: 'images' | 'files';
  onAddCamera: () => void;
  onAddLibrary: () => void;
  onView: (uri: string) => void;
}) {
  const { width } = useWindowDimensions();
  const size = Math.floor((width - 32 - 28 - (COLS - 1) * 8) / COLS);
  return (
    <View style={styles.grid}>
      {items.map((a) => (
        <AttachmentTile
          key={a.key}
          item={a}
          size={size}
          onOpen={() => onView(a.uri)}
          onRetry={() => askRetry(list, a)}
          onRemove={() => removeAttachment(list, a.key)}
        />
      ))}
      <PressableScale onPress={onAddCamera} accessibilityRole="button" accessibilityLabel="Chụp ảnh" scaleTo={0.95} style={[styles.add, { width: size, height: size }]}>
        <Icon name="camera" size={22} color={C.brand} />
        <Txt variant="caption" weight="semibold" color={C.brand}>
          Chụp
        </Txt>
      </PressableScale>
      <PressableScale onPress={onAddLibrary} accessibilityRole="button" accessibilityLabel="Chọn ảnh có sẵn" scaleTo={0.95} style={[styles.add, { width: size, height: size }]}>
        <Icon name="images" size={22} color={C.brand} />
        <Txt variant="caption" weight="semibold" color={C.brand}>
          Thư viện
        </Txt>
      </PressableScale>
    </View>
  );
}

function uploadHint(items: Attachment[]): string | null {
  const busy = items.filter((a) => a.state === 'queued' || a.state === 'uploading').length;
  const failed = items.filter((a) => a.state === 'error').length;
  if (busy) return `Đang tải lên ${busy} ảnh…`;
  if (failed) return `${failed} ảnh tải lỗi, bấm vào ảnh để thử lại`;
  return null;
}

export interface PackingFormViewProps {
  form: PackForm;
  perms: PackPerms;
  editing: boolean;
  branches: Branch[];
  staff: { id: number; name: string }[];
  staffLoading?: boolean;
  saving?: string | null;
  onChange: (patch: Partial<PackForm>) => void;
  onDocMode: (m: DocMode) => void;
  onBranch: (id: number) => void;
  onPickDocs: () => void;
  onScan: () => void;
  onRemoveDoc: (id: number) => void;
  onAddPhotos: (from: 'camera' | 'library') => void;
  onAddExpense: (from: 'camera' | 'file') => void;
  onSave: () => void;
}

/** Form tạo / sửa phiếu báo đơn (đóng hàng, loading, giao hàng). */
export function PackingFormView(p: PackingFormViewProps) {
  const f = p.form;
  const t = PACK_TYPES[f.type];
  const insets = useSafeAreaInsets();
  const [viewer, setViewer] = useState<{ images: string[]; start: number } | null>(null);
  const cold = f.docs.reduce((s, d) => s + d.coldCount, 0);
  const anyFee = FEES.some((x) => f.fees[x.key].on);
  const docWord = f.docMode === 'consignment' ? 'phiếu ký gửi' : 'hóa đơn';
  const branchLocked = f.type !== 'giao-hang' && f.docs.length > 0;
  const hint = uploadHint(f.images);
  // Hóa đơn ghi khách trả tiền mặt: phiếu điền sẵn tiền mặt + số tiền; đã sửa tay thì cho lấy lại theo hóa đơn.
  const invoicePay = f.type === 'giao-hang' ? docPay(f.docs) : null;
  const payDiffers =
    !!invoicePay && (f.payMethod !== (invoicePay.cash ? 'cash' : 'transfer') || (invoicePay.cash && f.cashAmount !== invoicePay.amount));
  // Lệch với hóa đơn thì báo trước: lưu xong phiếu sẽ bị gắn cảnh báo trong danh sách.
  const payWarn = f.type === 'giao-hang' ? cashWarningOf(f.payMethod, f.cashAmount, f.docs) : null;
  const expenseImages = f.files.filter((a) => isImageFile(a));
  const expenseDocs = f.files.filter((a) => !isImageFile(a));
  const view = (list: Attachment[], uri: string) => {
    const imgs = list.map((a) => a.uri);
    setViewer({ images: imgs, start: Math.max(0, imgs.indexOf(uri)) });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SubHeader title={p.editing ? `Sửa phiếu ${t.label.toLowerCase()}` : `Tạo phiếu ${t.label.toLowerCase()}`} />
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.body, { paddingBottom: 24 }]}>
        <FormCard title="Chứng từ">
          {p.perms.consignments ? (
            <View style={{ paddingVertical: 10 }}>
              <ChipGroup fill options={DOC_MODES} value={f.docMode} onChange={p.onDocMode} />
            </View>
          ) : null}
          <Select
            label="Chi nhánh"
            options={p.branches.map((b) => ({ value: b.id, label: b.name }))}
            value={f.branchId}
            onChange={(id) => {
              if (id !== null) p.onBranch(id);
            }}
            disabled={branchLocked}
            placeholder="Chọn chi nhánh"
          />
          {f.docs.map((d) => (
            <View key={`${d.kind}-${d.id}`}>
              <Divider />
              <DocRow doc={d} onRemove={() => p.onRemoveDoc(d.id)} packLabel={t.doneLabel} />
            </View>
          ))}
          <Divider />
          <View style={styles.docActions}>
            <Button title="Quét QR" icon="qr-code" variant="outline" size="small" onPress={p.onScan} disabled={!f.branchId} style={{ flex: 1 }} />
            <Button title={`Chọn ${docWord}`} icon="search" variant="outline" size="small" onPress={p.onPickDocs} disabled={!f.branchId} style={{ flex: 1 }} />
          </View>
        </FormCard>
        {branchLocked ? (
          <Txt variant="caption" color={C.muted} style={{ marginTop: -10 }}>
            Chi nhánh lấy theo {docWord} đã chọn. Bỏ hết {docWord} để đổi chi nhánh.
          </Txt>
        ) : null}
        {cold ? <Note text={`Có ${cold} mặt hàng lạnh trong các ${docWord} đã chọn: nhớ đóng gói giữ lạnh.`} /> : null}

        <FormCard title="Thông tin">
          <NumRow label="Số kiện" value={f.packages} onChange={(n) => p.onChange({ packages: Math.max(0, Math.round(n)) })} placeholder="Bắt buộc" suffix="kiện" />
          {f.type === 'loading' ? (
            <>
              <Divider />
              <Select
                label="Người loading"
                options={p.staff.map((u) => ({ value: u.id, label: u.name }))}
                value={f.loadingBy?.id ?? null}
                onChange={(id) => p.onChange({ loadingBy: p.staff.find((u) => u.id === id) ?? null })}
                placeholder={p.staffLoading ? 'Đang tải…' : 'Bắt buộc'}
                disabled={p.staffLoading}
              />
            </>
          ) : null}
          <Divider />
          <TextRow label="Ghi chú" value={f.note} onChange={(note) => p.onChange({ note })} placeholder="Không bắt buộc" maxLength={1000} multiline />
        </FormCard>

        {f.type === 'giao-hang' ? (
          <>
            <View style={{ gap: 10 }}>
              <Txt variant="heading" style={{ marginTop: 6 }}>
                Thanh toán
              </Txt>
              <ChipGroup fill options={PAY_METHODS} value={f.payMethod} onChange={(payMethod) => p.onChange({ payMethod, payAuto: false })} />
              {f.payMethod === 'cash' ? (
                <MoneyField label="Tiền mặt cần thu" bold value={f.cashAmount} onChange={(cashAmount) => p.onChange({ cashAmount, payAuto: false })} />
              ) : null}
              {invoicePay ? (
                <View style={styles.payHint}>
                  <Txt variant="caption" color={C.muted} style={{ flex: 1 }} numeric>
                    {invoicePay.cash ? (
                      <>
                        Theo hóa đơn:{' '}
                        <Txt variant="caption" weight="bold" color={toneColors.warning.fg}>
                          thu tiền mặt {money(invoicePay.amount)} ₫
                        </Txt>{' '}
                        ({invoicePay.codes.join(', ')})
                      </>
                    ) : (
                      'Theo hóa đơn: khách chuyển khoản'
                    )}
                  </Txt>
                  {payDiffers ? (
                    <PressableScale
                      onPress={() => {
                        const auto = applyDocPay({ ...f, payAuto: true });
                        p.onChange({ payAuto: true, payMethod: auto.payMethod, cashAmount: auto.cashAmount });
                      }}
                      accessibilityRole="button"
                      hitSlop={8}
                      scaleTo={0.95}>
                      <Txt variant="caption" weight="semibold" color={C.brand}>
                        Dùng theo hóa đơn
                      </Txt>
                    </PressableScale>
                  ) : null}
                </View>
              ) : null}
              {payWarn ? <CashWarningNote warning={payWarn} title="Khác hóa đơn: phiếu sẽ bị cảnh báo" /> : null}
            </View>

            <FormCard title="Chi phí giao hàng" hint="Bật khoản đã chi khi giao; có chi phí thì cần chọn người chi.">
              {FEES.map((x, i) => (
                <View key={x.key}>
                  {i ? <Divider /> : null}
                  <SwitchRow
                    label={x.label}
                    value={f.fees[x.key].on}
                    onChange={(on) => p.onChange({ fees: { ...f.fees, [x.key]: { ...f.fees[x.key], on } } })}
                  />
                  {f.fees[x.key].on ? (
                    <NumRow
                      label="Số tiền"
                      money
                      suffix="₫"
                      value={f.fees[x.key].amount}
                      onChange={(amount) => p.onChange({ fees: { ...f.fees, [x.key]: { ...f.fees[x.key], amount } } })}
                    />
                  ) : null}
                </View>
              ))}
              {anyFee ? (
                <>
                  <Divider />
                  <Select
                    label="Người chi"
                    options={p.staff.map((u) => ({ value: u.id, label: u.name }))}
                    value={f.payer?.id ?? null}
                    onChange={(id) => p.onChange({ payer: p.staff.find((u) => u.id === id) ?? null })}
                    placeholder={p.staffLoading ? 'Đang tải…' : 'Bắt buộc'}
                    disabled={p.staffLoading}
                  />
                </>
              ) : null}
            </FormCard>

            {anyFee ? (
              <FormCard title="Chứng từ chi phí" hint="Ảnh biên nhận, hóa đơn chi phí hoặc tệp PDF.">
                <View style={{ paddingVertical: expenseImages.length ? 12 : 0 }}>
                  {expenseImages.length ? (
                    <View style={styles.grid}>
                      {expenseImages.map((a) => (
                        <AttachmentTile
                          key={a.key}
                          item={a}
                          size={64}
                          onOpen={() => view(expenseImages, a.uri)}
                          onRetry={() => askRetry('files', a)}
                          onRemove={() => removeAttachment('files', a.key)}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
                {expenseDocs.map((a) => (
                  <FileLine
                    key={a.key}
                    name={a.name}
                    size={a.size}
                    state={a.state}
                    onOpen={a.url ? () => void WebBrowser.openBrowserAsync(mediaUri(a.url as string)) : undefined}
                    onRetry={() => askRetry('files', a)}
                    onRemove={() => removeAttachment('files', a.key)}
                  />
                ))}
                <View style={[styles.docActions, { paddingVertical: 10 }]}>
                  <Button title="Chụp ảnh" icon="camera" variant="outline" size="small" onPress={() => p.onAddExpense('camera')} style={{ flex: 1 }} />
                  <Button title="Chọn tệp" icon="paperclip" variant="outline" size="small" onPress={() => p.onAddExpense('file')} style={{ flex: 1 }} />
                </View>
              </FormCard>
            ) : null}
          </>
        ) : null}

        <View style={{ gap: 8 }}>
          <View style={styles.photoHead}>
            <Txt variant="heading" style={{ flex: 1 }}>
              Ảnh · {f.images.length}
            </Txt>
            {hint ? (
              <Txt variant="caption" color={hint.includes('lỗi') ? '#B91C1C' : C.muted}>
                {hint}
              </Txt>
            ) : null}
          </View>
          <View style={styles.card}>
            <PhotoEditor
              items={f.images}
              list="images"
              onAddCamera={() => p.onAddPhotos('camera')}
              onAddLibrary={() => p.onAddPhotos('library')}
              onView={(uri) => view(f.images, uri)}
            />
          </View>
          <Txt variant="caption" color={C.muted}>
            Ảnh được thu nhỏ và tải lên ngay khi chọn, nên lúc lưu không phải chờ lâu.
          </Txt>
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          title={p.saving === 'uploading' ? 'Đang tải ảnh, sẽ lưu ngay…' : p.editing ? 'Lưu phiếu' : `Tạo phiếu ${t.label.toLowerCase()}`}
          icon="check"
          onPress={p.onSave}
          loading={!!p.saving}
          disabled={!!p.saving}
        />
      </View>
      <ImageViewer images={viewer?.images ?? []} start={viewer?.start ?? 0} visible={!!viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

export default function PackingFormScreen() {
  const form = usePackDraft((s) => s.form);
  const baseline = usePackDraft((s) => s.baseline);
  const editId = usePackDraft((s) => s.editId);
  const user = useSession((s) => s.user);
  const branches = useSession((s) => s.branches);
  const perms = packPerms(user);
  const qc = useQueryClient();
  const needStaff = form?.type === 'loading' || form?.type === 'giao-hang';
  const staff = useStaff(!!needStaff);
  const [saving, setSaving] = useState<string | null>(null);
  const [exit, setExit] = useState<{ go: () => void } | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const busyRef = useRef(false);

  const dirty = form && baseline ? isPackDirty(form, baseline) : false;
  usePreventRemove(dirty && !exit && !discarding, ({ repeat }) => {
    Alert.alert('Bỏ phiếu đang nhập?', 'Những gì bạn đã nhập (kể cả ảnh) sẽ không được lưu.', [
      { text: 'Ở lại', style: 'cancel' },
      {
        text: 'Bỏ phiếu',
        style: 'destructive',
        onPress: () => {
          setDiscarding(true);
          repeat();
        },
      },
    ]);
  });

  useEffect(() => {
    if (exit) exit.go();
  }, [exit]);

  if (!form) {
    return (
      <Page scroll={false} header={<SubHeader title="Báo đơn" />}>
        <EmptyState icon="clipboard-list" color="slate" title="Không có phiếu đang nhập" message="Quay lại Báo đơn rồi chọn loại phiếu để tạo." />
      </Page>
    );
  }

  const editing = editId !== null;
  const allowed = editing ? perms.update(form.type) : perms.create(form.type);
  if (!allowed) {
    return (
      <Page scroll={false} header={<SubHeader title="Báo đơn" />}>
        <EmptyState icon="lock" color="slate" title="Chưa có quyền" message={`Bạn chưa có quyền ${editing ? 'sửa' : 'tạo'} phiếu ${PACK_TYPES[form.type].label.toLowerCase()}.`} />
      </Page>
    );
  }

  const confirmClear = (msg: string, then: () => void) => {
    if (!form.docs.length) return then();
    Alert.alert('Bỏ chứng từ đã chọn?', msg, [
      { text: 'Thôi', style: 'cancel' },
      { text: 'Đổi', style: 'destructive', onPress: then },
    ]);
  };

  const addPhotos = async (from: 'camera' | 'library') => {
    try {
      const left = MAX_PHOTOS - form.images.length;
      if (left <= 0) {
        toast.info(`Mỗi phiếu tối đa ${MAX_PHOTOS} ảnh`);
        return;
      }
      const picked = from === 'camera' ? await takePhoto() : await pickPhotos(left);
      enqueueAttachments('images', picked.slice(0, left));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const addExpense = async (from: 'camera' | 'file') => {
    try {
      enqueueAttachments('files', from === 'camera' ? await takePhoto() : await pickDocuments());
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const save = async () => {
    if (busyRef.current) return;
    const err = validatePackForm(form);
    if (err) {
      Alert.alert('Chưa lưu được', err);
      return;
    }
    busyRef.current = true;
    try {
      // Ảnh đang tải dở: chờ xong rồi lưu luôn (không bắt người dùng bấm lại).
      if (pendingUploads(form).some((a) => a.state !== 'error')) setSaving('uploading');
      const latest = await waitForUploads();
      if (!latest) return;
      const failed = pendingUploads(latest).filter((a) => a.state === 'error');
      if (failed.length) {
        setSaving(null);
        Alert.alert(`${failed.length} ảnh / tệp tải lên lỗi`, 'Bấm vào ảnh lỗi để thử lại, hoặc lưu phiếu không kèm các ảnh đó.', [
          { text: 'Để thử lại', style: 'cancel' },
          {
            text: 'Lưu không kèm',
            onPress: () => {
              for (const a of failed) removeAttachment(latest.images.some((x) => x.key === a.key) ? 'images' : 'files', a.key);
              busyRef.current = false;
              void save();
            },
          },
        ]);
        return;
      }
      setSaving('saving');
      const body = buildPackPayload(latest);
      const label = PACK_TYPES[latest.type].label.toLowerCase();
      if (editing && editId) {
        const res = await updatePacking(latest.type, editId, body);
        // Phiếu chi đang khóa (duyệt tuần / đã chi) không đổi theo báo đơn (giống web).
        for (const lock of res?.financeLocked ?? [])
          toast.info(`Báo đơn đã lưu nhưng phiếu chi ${lock.code ?? ''} chưa cập nhật: ${lock.reason ?? 'đang bị khóa'}`);
        toast.success(`Đã lưu phiếu ${label}`);
        await refreshAfterPacking(qc);
        setExit({
          go: () => {
            clearPackDraft();
            router.back();
          },
        });
      } else {
        const created = await createPacking(latest.type, body);
        void refreshAfterPacking(qc);
        const openCreated = () =>
          setExit({
            go: () => {
              clearPackDraft();
              if (created?.id) router.replace({ pathname: '/bao-don/[type]/[id]', params: { type: latest.type, id: String(created.id) } } as never);
              else router.back();
            },
          });
        // Giống web: tạo xong có thể làm tiếp phiếu khác ngay (giữ chi nhánh, loại chứng từ, cách thanh toán).
        Alert.alert(created?.code ? `Đã tạo ${created.code}` : `Đã tạo phiếu ${label}`, 'Làm tiếp phiếu khác hay xem phiếu vừa tạo?', [
          { text: 'Xem phiếu', onPress: openCreated },
          {
            text: 'Tạo phiếu tiếp',
            style: 'default',
            onPress: () =>
              startPackDraft({
                ...newPackForm(latest.type, latest.branchId),
                docMode: latest.docMode,
                payMethod: latest.payMethod,
              }),
          },
        ]);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      busyRef.current = false;
      setSaving(null);
    }
  };

  return (
    <PackingFormView
      form={form}
      perms={perms}
      editing={editing}
      branches={branches}
      staff={staff.data ?? []}
      staffLoading={staff.isLoading}
      saving={saving}
      onChange={(patch) => patchPackDraft(() => patch)}
      onDocMode={(docMode) => confirmClear('Đổi loại chứng từ sẽ bỏ các chứng từ đã chọn.', () => patchPackDraft(() => ({ docMode, docs: [] })))}
      onBranch={(branchId) =>
        branchId !== form.branchId ? confirmClear('Đổi chi nhánh sẽ bỏ các chứng từ đã chọn.', () => patchPackDraft(() => ({ branchId, docs: [] }))) : undefined
      }
      onPickDocs={() => router.push('/bao-don/chon-chung-tu' as never)}
      onScan={() => router.push('/bao-don/quet-qr' as never)}
      onRemoveDoc={removeDocFromDraft}
      onAddPhotos={(from) => void addPhotos(from)}
      onAddExpense={(from) => void addExpense(from)}
      onSave={() => void save()}
    />
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 18 },
  docActions: { flexDirection: 'row', gap: 10, paddingVertical: 12 },
  payHint: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  photoHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  card: {
    padding: 14,
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
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
});
