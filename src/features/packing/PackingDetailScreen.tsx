import { useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, useWindowDimensions, View } from 'react-native';
import { dateTimeVN, money } from '@/core/format';
import { errorMessage } from '@/core/http';
import { useSession } from '@/core/session';
import { usePullRefresh } from '@/core/usePullRefresh';
import {
  Button,
  C,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  ImageViewer,
  LoadingState,
  Page,
  Section,
  SubHeader,
  toast,
  toneColors,
  Txt,
} from '@/ui';
import { KIND_SLUG } from '../orders/model';
import { KV } from '../products/components';
import { Note } from '../products/formParts';
import { cancelPacking, packingCancelCheck, refreshAfterPacking, resendLark, resendZalo, usePackingDetail } from './api';
import { AttachmentTile, CashWarningNote, DocRow, FileLine, TypeBadge } from './components';
import { startPackDraft } from './draft';
import { FEES, feeTotal, isImageFile, isPackType, PACK_TYPES, packPerms, toPackForm, type PackDetail, type PackPerms } from './model';
import { mediaUri } from '@/core/config';

const COLS = 4;

/** Lưới ảnh chỉ xem: bấm để xem to, vuốt qua lại. */
function PhotoGrid({ urls, onOpen }: { urls: string[]; onOpen: (i: number) => void }) {
  const { width } = useWindowDimensions();
  const size = Math.floor((width - 32 - 28 - (COLS - 1) * 8) / COLS);
  return (
    <View style={styles.grid}>
      {urls.map((u, i) => (
        <AttachmentTile
          key={`${u}-${i}`}
          item={{ key: u, uri: u, url: u, state: 'done', name: `Ảnh ${i + 1}`, type: 'image/jpeg', size: null }}
          size={size}
          onOpen={() => onOpen(i)}
        />
      ))}
    </View>
  );
}

export interface PackingDetailViewProps {
  detail: PackDetail;
  perms: PackPerms;
  busy?: string | null;
  onEdit?: () => void;
  onCancel?: () => void;
  onResend?: () => void;
  onOpenDoc?: (id: number) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/** Chi tiết 1 phiếu báo đơn: chứng từ, ảnh, thanh toán / chi phí (giao hàng), thao tác. */
export function PackingDetailView(p: PackingDetailViewProps) {
  const d = p.detail;
  const t = PACK_TYPES[d.type];
  const [viewer, setViewer] = useState<{ images: string[]; start: number } | null>(null);
  const fees = FEES.filter((f) => d.fees[f.key].on);
  const fileImages = d.files.filter(isImageFile);
  const fileDocs = d.files.filter((f) => !isImageFile(f));
  const cancelled = !!d.cancelledAt;

  return (
    <Page
      stickyHeader
      refreshing={p.refreshing}
      onRefresh={p.onRefresh}
      header={<SubHeader title={d.code} right={p.onEdit ? <IconButton icon="pencil" label="Sửa phiếu" onPress={p.onEdit} tint={C.brand} /> : undefined} />}>
      <Card style={styles.head}>
        <View style={styles.headRow}>
          <TypeBadge type={d.type} />
          {cancelled ? (
            <View style={styles.cancelBadge}>
              <Txt variant="caption" weight="semibold" color={toneColors.danger.fg}>
                Đã hủy
              </Txt>
            </View>
          ) : null}
        </View>
        <Txt variant="display" weight="bold" numeric>
          {d.packages} kiện
        </Txt>
        <Txt variant="caption" color={C.muted} numeric>
          {[dateTimeVN(d.createdAt), d.creatorName ? `tạo bởi ${d.creatorName}` : null].filter(Boolean).join(' · ')}
        </Txt>
      </Card>

      {cancelled ? (
        <Note tone="warning" text={`Phiếu đã hủy${d.cancelledByName ? ` bởi ${d.cancelledByName}` : ''} lúc ${dateTimeVN(d.cancelledAt)}.`} />
      ) : null}
      {d.cashWarning ? <CashWarningNote warning={d.cashWarning} /> : null}
      {d.coldCount ? (
        <View style={styles.cold}>
          <View style={styles.coldHead}>
            <Icon name="snowflake" size={16} color={toneColors.danger.fg} />
            <Txt variant="label" weight="semibold" color={toneColors.danger.fg}>
              Hàng lạnh · {d.coldCount} mặt hàng
            </Txt>
          </View>
          {d.coldItems.map((c, i) => (
            <Txt key={`${c.doc}-${c.code}-${i}`} variant="caption" color={toneColors.danger.fg} numeric>
              {[c.code, c.name].filter(Boolean).join(' ')}
              {c.doc ? ` (${c.doc})` : ''}
            </Txt>
          ))}
        </View>
      ) : null}

      <Section index={0} title="Thông tin">
        <Card style={styles.block}>
          <KV label="Chi nhánh" value={d.branchName ?? '—'} />
          {d.type === 'loading' ? <KV label="Người loading" value={d.loadingBy?.name || '—'} /> : null}
          <KV label="Ghi chú" value={d.note ?? '—'} tone={d.note ? undefined : 'muted'} />
        </Card>
      </Section>

      {d.type === 'giao-hang' ? (
        <Section index={1} title="Thanh toán và chi phí">
          <Card style={styles.block}>
            <KV label="Hình thức" value={d.payMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'} />
            {d.payMethod === 'cash' ? <KV label="Tiền mặt cần thu" value={`${money(d.cashAmount)} ₫`} tone="danger" strong /> : null}
            {fees.length ? <Divider /> : null}
            {fees.map((f) => (
              <KV key={f.key} label={f.label} value={money(d.fees[f.key].amount)} />
            ))}
            {fees.length ? <KV label="Tổng chi phí" value={`${money(feeTotal(d.fees))} ₫`} /> : null}
            {fees.length ? <KV label="Người chi" value={d.payer?.name || '—'} /> : null}
          </Card>
        </Section>
      ) : null}

      <Section index={2} title={`${d.docMode === 'consignment' ? 'Phiếu ký gửi' : 'Hóa đơn'} · ${d.docs.length}`}>
        <Card style={styles.block}>
          {d.docs.length ? (
            d.docs.map((doc, i) => (
              <View key={`${doc.kind}-${doc.id}`}>
                {i ? <Divider /> : null}
                <DocRow doc={doc} onPress={p.onOpenDoc && doc.kind === 'invoice' ? () => p.onOpenDoc?.(doc.id) : undefined} />
              </View>
            ))
          ) : (
            <Txt variant="body" color={C.faint} style={{ paddingVertical: 12 }}>
              Không có chứng từ.
            </Txt>
          )}
        </Card>
      </Section>

      <Section index={3} title={`Ảnh · ${d.images.length}`}>
        <Card style={[styles.block, { paddingVertical: 14 }]}>
          {d.images.length ? (
            <PhotoGrid urls={d.images} onOpen={(start) => setViewer({ images: d.images, start })} />
          ) : (
            <Txt variant="body" color={C.faint}>
              Phiếu không có ảnh.
            </Txt>
          )}
        </Card>
      </Section>

      {d.files.length ? (
        <Section index={4} title={`Chứng từ chi phí · ${d.files.length}`}>
          <Card style={[styles.block, { paddingVertical: fileImages.length ? 14 : 2, gap: 6 }]}>
            {fileImages.length ? <PhotoGrid urls={fileImages.map((f) => f.url)} onOpen={(start) => setViewer({ images: fileImages.map((f) => f.url), start })} /> : null}
            {fileDocs.map((f) => (
              <FileLine key={f.url} name={f.name} size={f.size} onOpen={() => void WebBrowser.openBrowserAsync(mediaUri(f.url))} />
            ))}
          </Card>
        </Section>
      ) : null}

      {!cancelled && (p.onResend || p.onCancel) ? (
        <View style={{ gap: 10, marginTop: 20 }}>
          {p.onResend ? (
            <Button
              title={d.type === 'giao-hang' ? 'Gửi lại thông báo Zalo' : 'Gửi lại thông báo Lark'}
              icon="send"
              variant="outline"
              onPress={p.onResend}
              loading={p.busy === 'resend'}
              disabled={!!p.busy}
            />
          ) : null}
          {p.onCancel ? (
            <Button title={`Hủy phiếu ${t.label.toLowerCase()}`} icon="x" variant="danger" onPress={p.onCancel} loading={p.busy === 'cancel'} disabled={!!p.busy} />
          ) : null}
        </View>
      ) : null}

      <ImageViewer images={viewer?.images ?? []} start={viewer?.start ?? 0} visible={!!viewer} onClose={() => setViewer(null)} />
    </Page>
  );
}

export default function PackingDetailScreen() {
  const params = useLocalSearchParams<{ type: string; id: string }>();
  const type = isPackType(params.type) ? params.type : null;
  const id = Number(params.id);
  const user = useSession((s) => s.user);
  const perms = packPerms(user);
  const qc = useQueryClient();
  const detail = usePackingDetail(type, id, !!type && perms.view(type));
  const pull = usePullRefresh(detail.refetch);
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);

  if (!type || !perms.view(type)) {
    return (
      <Page scroll={false} header={<SubHeader title="Báo đơn" />}>
        <EmptyState icon="lock" color="slate" title="Không xem được phiếu này" message="Bạn chưa có quyền xem loại phiếu này." />
      </Page>
    );
  }
  if (!detail.data) {
    return (
      <Page scroll={false} header={<SubHeader title="Báo đơn" />}>
        {detail.isError ? <ErrorState error={detail.error} onRetry={() => void detail.refetch()} /> : <LoadingState />}
      </Page>
    );
  }
  const d = detail.data;

  const run = async (kind: string, job: () => Promise<unknown>, done: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(kind);
    try {
      await job();
      toast.success(done);
      await refreshAfterPacking(qc);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const cancel = async () => {
    const doCancel = (cancelCashFlows?: boolean) => run('cancel', () => cancelPacking(type, id, cancelCashFlows), `Đã hủy ${d.code}`);
    if (type !== 'giao-hang') {
      Alert.alert(`Hủy phiếu ${d.code}?`, 'Hóa đơn trong phiếu sẽ trở lại trạng thái trước đó.', [
        { text: 'Không', style: 'cancel' },
        { text: 'Hủy phiếu', style: 'destructive', onPress: () => void doCancel() },
      ]);
      return;
    }
    // Phiếu giao hàng có thể đã lập phiếu thu tiền mặt: hỏi hủy kèm hay giữ (giống web).
    let check: { receiptCashFlowCount?: number; blockedReason?: string | null } | null = null;
    try {
      check = await packingCancelCheck(id);
    } catch {
      check = null;
    }
    if (check?.blockedReason) {
      Alert.alert('Chưa hủy được', check.blockedReason);
      return;
    }
    const receipts = check?.receiptCashFlowCount ?? 0;
    if (!receipts) {
      Alert.alert(`Hủy phiếu ${d.code}?`, 'Hóa đơn trong phiếu sẽ trở lại trạng thái trước khi giao.', [
        { text: 'Không', style: 'cancel' },
        { text: 'Hủy phiếu', style: 'destructive', onPress: () => void doCancel() },
      ]);
      return;
    }
    Alert.alert(`Hủy phiếu ${d.code}?`, `Phiếu có ${receipts} phiếu thu tiền mặt đi kèm. Hủy luôn phiếu thu?`, [
      { text: 'Có, hủy kèm phiếu thu', style: 'destructive', onPress: () => void doCancel(true) },
      { text: 'Không, giữ phiếu thu', onPress: () => void doCancel(false) },
      { text: 'Thôi', style: 'cancel' },
    ]);
  };

  const canUpdate = perms.update(type) && !d.cancelledAt;
  return (
    <PackingDetailView
      detail={d}
      perms={perms}
      busy={busy}
      refreshing={pull.refreshing}
      onRefresh={pull.onRefresh}
      onEdit={
        canUpdate
          ? () => {
              startPackDraft(toPackForm(d), d.id);
              router.push('/bao-don/phieu' as never);
            }
          : undefined
      }
      onCancel={perms.remove(type) ? () => void cancel() : undefined}
      onResend={
        canUpdate && type !== 'dong-hang'
          ? () =>
              // Hỏi trước như web: gửi lại sẽ nhắn thêm 1 tin vào nhóm.
              Alert.alert(type === 'giao-hang' ? 'Gửi lại tin nhắn Zalo cho báo đơn này?' : 'Gửi lại thông báo loading của phiếu này lên Lark?', undefined, [
                { text: 'Không', style: 'cancel' },
                {
                  text: 'Gửi lại',
                  onPress: () =>
                    void run(
                      'resend',
                      () => (type === 'giao-hang' ? resendZalo(id) : resendLark(id)),
                      type === 'giao-hang' ? 'Đã gửi lại thông báo Zalo' : 'Đã gửi lại thông báo loading lên Lark',
                    ),
                },
              ])
          : undefined
      }
      onOpenDoc={
        perms.invoices
          ? (docId) => router.push({ pathname: '/bao-don/chung-tu/[kind]/[id]', params: { kind: KIND_SLUG.invoice, id: String(docId) } } as never)
          : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  head: { gap: 6, padding: 16 },
  cold: { gap: 4, padding: 12, borderRadius: 12, backgroundColor: toneColors.danger.bg },
  coldHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  block: { paddingHorizontal: 14, paddingVertical: 4 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cancelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: toneColors.danger.bg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
