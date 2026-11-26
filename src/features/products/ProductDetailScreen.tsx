import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { dateTimeVN, dateVN, money, qty } from '@/core/format';
import { errorMessage } from '@/core/http';
import { useSession } from '@/core/session';
import {
  Button,
  C,
  Card,
  ChipGroup,
  Divider,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  ImageViewer,
  LoadingState,
  Page,
  Pill,
  PressableScale,
  Section,
  SheetHeader,
  SubHeader,
  TabPanel,
  toast,
  toneColors,
  Txt,
} from '@/ui';
import { Thumb } from '../sales/components';
import { setProductActive, useConditionLogs, useConditionSummary, useProductDetail, useStockCard } from './api';
import { KV, ProductLocked, StatCell, stockText } from './components';
import { EDIT_PRODUCT_PATH, startDraft } from './draft';
import { toEditForm } from './form';
import {
  BUCKETS,
  categoryPath,
  displayQty,
  productPerms,
  toProductDetail,
  typeLabel,
  type ComponentLine,
  type ConditionBucket,
  type ConditionSummary,
  type ProductDetail,
  type ProductPerms,
  type StockLevel,
  type StockMove,
} from './model';
import { mediaUri } from '@/core/config';

export type DetailTab = 'info' | 'stock' | 'card' | 'condition' | 'desc';
const TABS: { value: DetailTab; label: string }[] = [
  { value: 'info', label: 'Thông tin' },
  { value: 'stock', label: 'Tồn kho' },
  { value: 'card', label: 'Thẻ kho' },
  { value: 'condition', label: 'Loại tồn' },
  { value: 'desc', label: 'Mô tả' },
];
const TAB_ORDER = TABS.map((t) => t.value);

const isSafeImage = (uri: string) => uri.startsWith('https://') || (__DEV__ && uri.startsWith('http://'));

/** Ảnh hàng hóa: vuốt ngang khi có nhiều ảnh. */
function Gallery({ images }: { images: string[] }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  // Bề rộng thật của vùng ảnh (trong thẻ, đã trừ lề trang và lề thẻ).
  const [boxW, setBoxW] = useState(0);
  // Ảnh đang mở xem toàn màn hình; null = đang đóng.
  const [viewing, setViewing] = useState<number | null>(null);
  const safe = images.filter(isSafeImage);
  const w = boxW || width - 64;
  if (!safe.length) return null;
  return (
    <View style={{ gap: 8 }} onLayout={(e) => setBoxW(Math.round(e.nativeEvent.layout.width))}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / w))}
        style={[styles.gallery, { width: w }]}
        accessibilityLabel={`Ảnh hàng hóa, ${safe.length} ảnh`}>
        {safe.map((uri, i) => (
          <Pressable
            key={uri}
            onPress={() => setViewing(i)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Xem ảnh ${i + 1} cỡ lớn`}>
            <Image source={{ uri: mediaUri(uri) }} style={{ width: w, height: Math.min(w, 280) }} contentFit="contain" transition={150} />
          </Pressable>
        ))}
      </ScrollView>
      {safe.length > 1 ? (
        <View style={styles.dots}>
          {safe.map((uri, i) => (
            <View key={uri} style={[styles.dot, i === index ? styles.dotOn : null]} />
          ))}
        </View>
      ) : null}
      <ImageViewer images={safe} start={viewing ?? 0} visible={viewing !== null} onClose={() => setViewing(null)} />
    </View>
  );
}

function ComponentRow({ c, showCost, mfg }: { c: ComponentLine; showCost: boolean; mfg?: boolean }) {
  const shown = mfg ? displayQty(c) : { value: c.quantity, suffix: '' };
  return (
    <View style={styles.compRow}>
      <Thumb uri={c.image} size={42} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="label" weight="semibold" numberOfLines={2}>
          {c.name}
        </Txt>
        <Txt variant="caption" color={C.muted} numeric numberOfLines={1}>
          {[c.code, showCost && c.cost !== null ? `Vốn ${money(c.cost)}` : null].filter(Boolean).join(' · ')}
        </Txt>
      </View>
      <Txt variant="body" weight="bold" numeric>
        × {qty(shown.value)}
        {shown.suffix ? ` ${shown.suffix}` : ''}
      </Txt>
    </View>
  );
}

function ComponentList({ items, showCost, mfg }: { items: ComponentLine[]; showCost: boolean; mfg?: boolean }) {
  if (!items.length)
    return (
      <Txt variant="caption" color={C.faint} style={{ padding: 14 }}>
        Chưa có thành phần
      </Txt>
    );
  return (
    <>
      {items.map((c, i) => (
        <View key={`${c.productId}`}>
          {i > 0 ? <Divider inset={68} /> : null}
          <ComponentRow c={c} showCost={showCost} mfg={mfg} />
        </View>
      ))}
    </>
  );
}

function InfoTab({ d, perms }: { d: ProductDetail; perms: ProductPerms }) {
  const defaultFormula = d.formulas.find((f) => f.isDefault) ?? d.formulas[0];
  const [formulaId, setFormulaId] = useState(defaultFormula ? String(defaultFormula.id) : '');
  const formula = d.formulas.find((f) => String(f.id) === formulaId) ?? defaultFormula;
  const stock = d.stock;
  const weight = d.weight ? `${qty(d.weight)} ${d.weightUnit}${d.isPieceUnit ? ' / chiếc' : ''}` : '-';

  return (
    <View style={{ gap: 12 }}>
      <Card style={styles.block}>
        {perms.viewSale ? <KV label="Giá bán" value={`${money(d.basePrice)} ₫`} /> : null}
        {perms.viewCost && d.cost !== null ? <KV label={d.type === 1 ? 'Giá vốn (theo thành phần)' : 'Giá vốn'} value={`${money(d.cost)} ₫`} /> : null}
        {d.type === 3 ? null : (
          <>
            <KV label="Tồn kho" value={stockText(stock ? stock.onHand : null, d.unit)} tone={stock && stock.onHand <= 0 ? 'danger' : undefined} />
            {stock && (stock.min > 0 || stock.max > 0) ? <KV label="Định mức tồn" value={`${qty(stock.min)} – ${qty(stock.max)}`} /> : null}
          </>
        )}
        <KV label="Thương hiệu" value={d.tradeMark?.name ?? '-'} tone={d.tradeMark ? undefined : 'muted'} />
        <KV label="Đơn vị tính" value={d.unit ?? '-'} tone={d.unit ? undefined : 'muted'} />
        {d.conversionValue > 1 ? <KV label="Định lượng đóng gói" value={`1 thùng = ${qty(d.conversionValue)} ${d.unit ?? 'đơn vị'}`} /> : null}
        <KV label="Khối lượng tịnh" value={weight} tone={d.weight ? undefined : 'muted'} />
        {d.shippingWeight ? <KV label="Trọng lượng vận chuyển" value={`${qty(d.shippingWeight)} ${d.shippingWeightUnit}`} /> : null}
        <KV label="VAT" value={`${qty(d.vat)}%`} />
        <KV label="Loại vận chuyển" value={d.cargoType === 'COLD' ? 'Hàng lạnh' : 'Hàng thường'} />
        <KV label="Bán trực tiếp" value={d.isDirectSale ? 'Có' : 'Không'} />
        {d.createdAt ? <KV label="Ngày tạo" value={dateVN(d.createdAt)} /> : null}
      </Card>

      {d.attributes.length ? (
        <Card style={styles.block}>
          <Txt variant="label" weight="semibold" style={{ paddingTop: 10 }}>
            Thuộc tính
          </Txt>
          {d.attributes.map((a) => (
            <KV key={`${a.name}-${a.value}`} label={a.name} value={a.value} />
          ))}
        </Card>
      ) : null}

      {d.type === 1 ? (
        <View style={{ gap: 8 }}>
          <Txt variant="heading">Thành phần combo · {d.components.length}</Txt>
          <Card>
            <ComponentList items={d.components} showCost={perms.viewCost} />
          </Card>
        </View>
      ) : null}

      {d.type === 4 && formula ? (
        <View style={{ gap: 8 }}>
          <Txt variant="heading">Công thức sản xuất</Txt>
          {d.formulas.length > 1 ? (
            <ChipGroup
              options={d.formulas.map((f) => ({ value: String(f.id), label: f.isDefault ? `★ ${f.name}` : f.name }))}
              value={String(formula.id)}
              onChange={setFormulaId}
            />
          ) : null}
          <Card>
            <View style={styles.formulaHead}>
              <Txt variant="label" weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
                {formula.name}
              </Txt>
              {formula.isDefault ? <Pill label="Mặc định" tone="brand" /> : null}
            </View>
            <Divider />
            <ComponentList items={formula.components} showCost={perms.viewCost} mfg />
          </Card>
        </View>
      ) : null}
    </View>
  );
}

function StockCard({ s, unit, current, showCost }: { s: StockLevel; unit: string | null; current: boolean; showCost: boolean }) {
  return (
    <Card style={[styles.block, current ? { borderColor: C.brand, borderWidth: 1.2 } : null]}>
      <View style={styles.stockHead}>
        <Icon name="store" size={18} color={current ? C.brand : C.muted} />
        <Txt variant="body" weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
          {s.branchName}
        </Txt>
        {current ? <Pill label="Đang chọn" tone="brand" /> : null}
      </View>
      <View style={styles.grid}>
        <StatCell label={`Tồn kho${unit ? ` (${unit})` : ''}`} value={qty(s.onHand)} tone={s.onHand <= 0 ? 'danger' : undefined} />
        <StatCell label="Hàng tốt" value={qty(s.good)} tone="success" />
        <StatCell label="Bục rách" value={qty(s.damaged)} tone={s.damaged > 0 ? 'danger' : undefined} />
        <StatCell label="Cận date" value={qty(s.nearExpiry)} tone={s.nearExpiry > 0 ? 'warning' : undefined} />
        <StatCell label="Khuyến mãi" value={qty(s.promo)} tone={s.promo > 0 ? 'info' : undefined} />
        <StatCell label="KH đặt" value={qty(s.reserved)} />
        <StatCell label="Đặt NCC" value={qty(s.onOrder)} />
        <StatCell label="Định mức" value={s.min || s.max ? `${qty(s.min)}–${qty(s.max)}` : '-'} />
        {showCost && s.cost !== null ? <StatCell label="Giá vốn" value={money(s.cost)} /> : null}
      </View>
    </Card>
  );
}

function StockTab({ d, perms, branchId }: { d: ProductDetail; perms: ProductPerms; branchId: number | null }) {
  if (!d.stocks.length) return <EmptyState icon="package" color="slate" title="Chưa có tồn kho" message="Hàng này chưa có dòng tồn ở chi nhánh nào." />;
  // Chi nhánh đang chọn lên đầu.
  const sorted = [...d.stocks].sort((a, b) => Number(b.branchId === branchId) - Number(a.branchId === branchId));
  return (
    <View style={{ gap: 12 }}>
      {sorted.map((s) => (
        <StockCard key={s.branchId} s={s} unit={d.unit} current={s.branchId === branchId} showCost={perms.viewCost} />
      ))}
    </View>
  );
}

export interface LogData {
  rows: StockMove[];
  total?: number;
  loading: boolean;
  error?: unknown;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onRetry: () => void;
}

/** "mm/yyyy" đọc thẳng từ chuỗi ngày để không lệch tháng do múi giờ. */
const monthYear = (iso: string | null) => (iso && iso.length >= 7 ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

function MoveRow({
  m,
  showCost,
  showExpiry,
  onOpenInvoice,
}: {
  m: StockMove;
  showCost: boolean;
  showExpiry?: boolean;
  onOpenInvoice?: (id: number) => void;
}) {
  const plus = m.quantity > 0;
  const link = m.invoiceId && onOpenInvoice ? () => onOpenInvoice(m.invoiceId as number) : undefined;
  const sub = [dateTimeVN(m.date), m.partner].filter(Boolean).join(' · ');
  const money2 = showCost ? [`Giá vốn ${money(m.costPrice)}`, m.price !== null ? `Giá GD ${money(m.price)}` : null].filter(Boolean).join(' · ') : '';
  const body = (
    <>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.moveTop}>
          <Txt variant="label" weight="semibold" numeric color={link ? C.brand : C.text} numberOfLines={1} style={{ flexShrink: 1 }}>
            {m.code || '—'}
          </Txt>
          <Txt variant="caption" color={C.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
            {m.label}
          </Txt>
        </View>
        {sub ? (
          <Txt variant="caption" color={C.muted} numberOfLines={1}>
            {sub}
          </Txt>
        ) : null}
        {showExpiry && m.expiryDate ? (
          <Txt variant="caption" color={C.muted} numeric>
            NSX {monthYear(m.expiryDate)}
          </Txt>
        ) : null}
        {money2 ? (
          <Txt variant="caption" color={C.muted} numeric numberOfLines={1}>
            {money2}
          </Txt>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Txt variant="body" weight="bold" numeric color={plus ? toneColors.success.fg : m.quantity < 0 ? toneColors.danger.fg : C.text}>
          {plus ? '+' : ''}
          {qty(m.quantity)}
        </Txt>
        <Txt variant="caption" color={C.muted} numeric>
          Tồn {qty(m.balance)}
        </Txt>
      </View>
      {link ? <Icon name="chevron-right" size={16} color={C.faint} /> : null}
    </>
  );
  if (!link) return <View style={styles.move}>{body}</View>;
  return (
    <PressableScale onPress={link} accessibilityLabel={`Xem hóa đơn ${m.code}`} scaleTo={0.98} style={styles.move}>
      {body}
    </PressableScale>
  );
}

function MoveList({
  data,
  empty,
  showCost,
  showExpiry,
  onOpenInvoice,
}: {
  data: LogData;
  empty: string;
  showCost: boolean;
  showExpiry?: boolean;
  onOpenInvoice?: (id: number) => void;
}) {
  if (data.loading) return <LoadingState />;
  if (data.error) return <ErrorState error={data.error} onRetry={data.onRetry} />;
  if (!data.rows.length)
    return (
      <Txt variant="body" color={C.muted} align="center" style={{ paddingVertical: 32 }}>
        {empty}
      </Txt>
    );
  return (
    <View style={{ gap: 10 }}>
      <Card>
        {data.rows.map((m, i) => (
          <View key={m.key}>
            {i > 0 ? <Divider inset={14} /> : null}
            <MoveRow m={m} showCost={showCost} showExpiry={showExpiry} onOpenInvoice={onOpenInvoice} />
          </View>
        ))}
      </Card>
      {data.hasMore ? (
        <Button
          title={`Xem thêm${data.total !== undefined ? ` (${data.rows.length}/${data.total})` : ''}`}
          variant="ghost"
          size="medium"
          loading={data.loadingMore}
          onPress={data.onMore}
        />
      ) : null}
    </View>
  );
}

/** Thẻ kho / loại tồn chỉ xem ở chi nhánh đang chọn (giống web): quyền tính theo chi nhánh. */
function LogBranchNote({ name }: { name?: string }) {
  if (!name) return null;
  return (
    <Txt variant="caption" color={C.muted}>
      Chi nhánh {name}. Đổi chi nhánh ở tab Thêm.
    </Txt>
  );
}

export interface ProductDetailViewProps {
  d: ProductDetail;
  perms: ProductPerms;
  branchId: number | null;
  tab: DetailTab;
  onTab: (t: DetailTab) => void;
  /** Tên chi nhánh đang chọn (thẻ kho, loại tồn). */
  logBranchName?: string;
  card: LogData;
  condition: { summary?: ConditionSummary; bucket: ConditionBucket; onBucket: (b: ConditionBucket) => void; logs: LogData };
  onOpenInvoice?: (id: number) => void;
  onEdit?: () => void;
  onToggleActive?: () => void;
  busy?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Mở dạng sheet (chồng lên sheet sửa dòng hàng): đầu sheet có nút Đóng. */
  sheet?: boolean;
}

/** Chi tiết hàng hóa: thông tin, tồn kho các chi nhánh, thẻ kho, loại tồn, mô tả. */
export function ProductDetailView(p: ProductDetailViewProps) {
  const { d, perms } = p;
  const path = categoryPath(d);
  const isService = d.type === 3;
  const tabs = isService ? TABS.filter((t) => t.value === 'info' || t.value === 'desc') : TABS;
  const tab = tabs.some((t) => t.value === p.tab) ? p.tab : 'info';
  const s = p.condition.summary;

  return (
    <Page
      stickyHeader
      refreshing={p.refreshing}
      onRefresh={p.onRefresh}
      header={
        p.sheet ? (
          <SheetHeader title={d.code} cancelLabel="Đóng" />
        ) : (
          <SubHeader
            title={d.code}
            right={p.onEdit ? <IconButton icon="pencil" label="Sửa hàng hóa" onPress={p.onEdit} tint={C.brand} /> : undefined}
          />
        )
      }
      contentStyle={{ paddingBottom: 40 }}>
      <Section index={0} style={{ marginTop: 8 }}>
        <Card style={styles.head}>
          <Gallery images={d.images} />
          <View style={styles.pills}>
            <Pill label={typeLabel(d.type)} tone="brand" />
            <Pill label={d.isActive ? 'Hoạt động' : 'Ngừng hoạt động'} tone={d.isActive ? 'success' : 'danger'} />
            {d.isDirectSale ? <Pill label="Bán trực tiếp" tone="info" /> : null}
            {d.cargoType === 'COLD' ? <Pill label="Hàng lạnh" tone="info" /> : null}
          </View>
          <Txt variant="title" style={{ fontSize: 22, lineHeight: 29 }}>
            {d.name}
          </Txt>
          {path ? (
            <Txt variant="label" color={C.muted}>
              {path}
            </Txt>
          ) : null}
          {perms.viewSale ? (
            <Txt variant="display" numeric color={C.brandDark}>
              {money(d.basePrice)} ₫
            </Txt>
          ) : null}
        </Card>
      </Section>

      <Section index={1}>
        <ChipGroup options={tabs} value={tab} onChange={p.onTab} />
        <TabPanel value={tab} order={TAB_ORDER}>
          {tab === 'info' ? (
            <InfoTab d={d} perms={perms} />
          ) : tab === 'stock' ? (
            <StockTab d={d} perms={perms} branchId={p.branchId} />
          ) : tab === 'card' ? (
            <View style={{ gap: 12 }}>
              <LogBranchNote name={p.logBranchName} />
              <MoveList data={p.card} empty="Chưa có dữ liệu thẻ kho" showCost={perms.viewCost} onOpenInvoice={p.onOpenInvoice} />
            </View>
          ) : tab === 'condition' ? (
            <View style={{ gap: 12 }}>
              <LogBranchNote name={p.logBranchName} />
              <Card style={[styles.block, styles.grid]}>
                <StatCell label="Tồn kho" value={s ? qty(s.onHand) : '…'} />
                <StatCell label="Hàng tốt" value={s ? qty(s.good) : '…'} tone="success" />
                <StatCell label="Bục rách" value={s ? qty(s.damaged) : '…'} tone="danger" />
                <StatCell label="Cận date" value={s ? qty(s.nearExpiry) : '…'} tone="warning" />
                <StatCell label="Khuyến mãi" value={s ? qty(s.promo) : '…'} tone="info" />
              </Card>
              <ChipGroup fill options={BUCKETS} value={p.condition.bucket} onChange={p.condition.onBucket} />
              <MoveList
                data={p.condition.logs}
                empty="Chưa có lịch sử loại tồn này"
                showCost={false}
                showExpiry={p.condition.bucket === 'NEAR_EXPIRY'}
              />
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <Card style={styles.text}>
                <Txt variant="label" weight="semibold" color={C.muted}>
                  Mô tả
                </Txt>
                <Txt variant="body" color={d.description ? C.text : C.faint}>
                  {d.description ?? 'Chưa có mô tả'}
                </Txt>
              </Card>
              <Card style={styles.text}>
                <Txt variant="label" weight="semibold" color={C.muted}>
                  Mẫu ghi chú (hóa đơn, đặt hàng)
                </Txt>
                <Txt variant="body" color={d.orderTemplate ? C.text : C.faint}>
                  {d.orderTemplate ?? 'Chưa có mẫu ghi chú'}
                </Txt>
              </Card>
            </View>
          )}
        </TabPanel>
      </Section>

      {p.onToggleActive ? (
        <View style={{ marginTop: 28 }}>
          <Button
            title={d.isActive ? 'Ngừng hoạt động' : 'Kích hoạt lại'}
            icon="power"
            variant={d.isActive ? 'danger' : 'outline'}
            onPress={p.onToggleActive}
            loading={p.busy}
          />
        </View>
      ) : null}
    </Page>
  );
}

export default function ProductDetailScreen() {
  const params = useLocalSearchParams<{ id: string; chiXem?: string }>();
  const id = Number(params.id);
  // Mở từ chi tiết đơn (`productViewHref`) hoặc sheet sửa dòng hàng: chỉ xem như web POS.
  const readOnly = params.chiXem === '1';
  // Sheet chồng lên sheet sửa dòng (…/san-pham/[id]): màn khác mở từ đây sẽ nằm dưới sheet → không mở.
  const inSheet = usePathname().includes('/san-pham/');
  const user = useSession((s) => s.user);
  const branchId = useSession((s) => s.branchId);
  const branches = useSession((s) => s.branches);
  const perms = productPerms(user);
  const qc = useQueryClient();
  // Không có quyền xem thì không gọi API nào (mở thẳng bằng link).
  const detail = useProductDetail(id, perms.view);
  const [tab, setTab] = useState<DetailTab>('info');
  const [bucket, setBucket] = useState<ConditionBucket>('DAMAGED');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Chỉ chi nhánh đang chọn: backend kiểm quyền theo chi nhánh trong header X-Branch-Id.
  const card = useStockCard(id, branchId, perms.view && tab === 'card');
  const summary = useConditionSummary(id, branchId, perms.view && tab === 'condition');
  const condLogs = useConditionLogs(id, bucket, branchId, perms.view && tab === 'condition');

  if (!perms.view) return <ProductLocked />;

  if (detail.isLoading || !detail.data) {
    return (
      <Page stickyHeader scroll={false} header={inSheet ? <SheetHeader title="Hàng hóa" cancelLabel="Đóng" /> : <SubHeader title="Hàng hóa" />}>
        {detail.isError ? <ErrorState error={detail.error} onRetry={() => void detail.refetch()} /> : <LoadingState />}
      </Page>
    );
  }

  const d = toProductDetail(detail.data, branchId);
  const logData = (q: typeof card): LogData => ({
    rows: q.data?.pages.flatMap((pg) => pg.rows) ?? [],
    total: q.data?.pages[0]?.total,
    loading: q.isLoading,
    error: q.isError ? q.error : undefined,
    hasMore: !!q.hasNextPage,
    loadingMore: q.isFetchingNextPage,
    onMore: () => void q.fetchNextPage(),
    onRetry: () => void q.refetch(),
  });

  const toggleActive = () => {
    const next = !d.isActive;
    Alert.alert(
      next ? 'Kích hoạt lại hàng hóa?' : 'Ngừng hoạt động hàng hóa?',
      next ? `${d.code} sẽ bán lại được.` : `${d.code} sẽ không chọn được khi bán hàng nữa. Có thể kích hoạt lại sau.`,
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        {
          text: next ? 'Kích hoạt' : 'Ngừng hoạt động',
          style: next ? 'default' : 'destructive',
          onPress: () => {
            setBusy(true);
            setProductActive(d.id, next)
              .then(async () => {
                toast.success(next ? `Đã kích hoạt ${d.code}` : `Đã ngừng hoạt động ${d.code}`);
                await Promise.all([
                  qc.invalidateQueries({ queryKey: ['product', d.id] }),
                  qc.invalidateQueries({ queryKey: ['products'] }),
                ]);
              })
              .catch((e: unknown) => toast.error(errorMessage(e)))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  return (
    <ProductDetailView
      d={d}
      perms={perms}
      branchId={branchId}
      tab={tab}
      onTab={setTab}
      logBranchName={branches.find((b) => b.id === branchId)?.name}
      card={logData(card)}
      condition={{ summary: summary.data, bucket, onBucket: setBucket, logs: logData(condLogs) }}
      onOpenInvoice={
        perms.viewInvoices && !inSheet
          ? (invoiceId) => router.push({ pathname: '/hang-hoa/chung-tu/[kind]/[id]', params: { kind: 'hoa-don', id: String(invoiceId) } } as never)
          : undefined
      }
      onEdit={
        perms.update && !readOnly
          ? () => {
              startDraft(toEditForm(detail.data, branchId), d.id);
              router.push({ pathname: EDIT_PRODUCT_PATH, params: { id: String(d.id) } } as never);
            }
          : undefined
      }
      onToggleActive={perms.toggleActive && !readOnly ? toggleActive : undefined}
      busy={busy}
      sheet={inSheet}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void Promise.all([
          detail.refetch(),
          tab === 'card' ? card.refetch() : null,
          tab === 'condition' ? Promise.all([summary.refetch(), condLogs.refetch()]) : null,
        ]).finally(() => setRefreshing(false));
      }}
    />
  );
}

const styles = StyleSheet.create({
  head: { padding: 16, gap: 10 },
  gallery: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#F7F9FB' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D5DEE6' },
  dotOn: { backgroundColor: C.brand, width: 16 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  block: { paddingHorizontal: 14, paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 6 },
  stockHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, paddingBottom: 4 },
  compRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  formulaHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  move: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  moveTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { padding: 14, gap: 6 },
});
