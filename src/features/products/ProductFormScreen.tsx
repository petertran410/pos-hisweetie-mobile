import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money } from '@/core/format';
import { errorMessage } from '@/core/http';
import { useSession } from '@/core/session';
import { Button, C, Divider, EmptyState, fonts, Icon, Page, pickFromSheet, PressableScale, Select, SubHeader, toast, Txt } from '@/ui';
import { createProduct, updateProduct, uploadProductImage } from './api';
import { ComboEditor, FormulaEditor } from './ComponentsEditor';
import { CostScopeModal } from './CostScopeModal';
import { patchDraft, useProductDraft } from './draft';
import {
  buildProductCreate,
  buildProductUpdate,
  comboTotalsOf,
  computedCost,
  effectiveCost,
  formChanges,
  hasPhysical,
  hasStock,
  MAX_IMAGES,
  needsCostScope,
  newKey,
  validateProductForm,
  type CostScope,
  type ProductForm,
} from './form';
import { FormCard, Note, NumRow, PickRow, SwitchRow, TextRow, UnitToggle } from './formParts';
import { CARGO_TYPES, productPerms, typeLabel, type ProductPerms } from './model';

export type PickTarget = 'parent' | 'middle' | 'child' | 'trademark' | 'unit';

const ATTRIBUTE_PRESETS = ['Vị', 'Loại', 'Màu sắc', 'Kích cỡ'];

const isShowable = (uri: string) => uri.startsWith('https://') || uri.startsWith('file://') || (__DEV__ && uri.startsWith('http://'));

function Images({ form, onAdd, onRemove }: { form: ProductForm; onAdd: () => void; onRemove: (key: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.images} style={{ marginHorizontal: -16 }}>
      {form.images.map((img, i) => (
        <View key={img.key} style={styles.imageTile}>
          {isShowable(img.uri) ? (
            <Image source={{ uri: img.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
          ) : (
            <Icon name="package" size={26} color={C.faint} />
          )}
          {i === 0 ? (
            <View style={styles.mainBadge}>
              <Txt variant="caption" weight="semibold" color={C.white}>
                Ảnh chính
              </Txt>
            </View>
          ) : null}
          <PressableScale onPress={() => onRemove(img.key)} accessibilityLabel={`Xóa ảnh ${i + 1}`} hitSlop={8} scaleTo={0.85} style={styles.removeImage}>
            <Icon name="x" size={14} color={C.white} strokeWidth={2.6} />
          </PressableScale>
        </View>
      ))}
      {form.images.length < MAX_IMAGES ? (
        <PressableScale onPress={onAdd} accessibilityLabel="Thêm ảnh" scaleTo={0.94} style={[styles.imageTile, styles.addImage]}>
          <Icon name="image-plus" size={26} color={C.brand} />
          <Txt variant="caption" weight="semibold" color={C.brand}>
            Thêm ảnh
          </Txt>
        </PressableScale>
      ) : null}
    </ScrollView>
  );
}

function Attributes({ form, onChange }: { form: ProductForm; onChange: (patch: Partial<ProductForm>) => void }) {
  const set = (key: string, field: 'name' | 'value', text: string) =>
    onChange({ attributes: form.attributes.map((a) => (a.key === key ? { ...a, [field]: text } : a)) });
  const add = (name: string) => onChange({ attributes: [...form.attributes, { key: newKey('a'), name, value: '' }] });
  return (
    <FormCard title="Thuộc tính" hint="Thuộc tính được ghép vào tên đầy đủ của hàng (vd. Siro dâu - 1L).">
      {form.attributes.map((a, i) => (
        <View key={a.key}>
          {i > 0 ? <Divider /> : null}
          <View style={styles.attrRow}>
            <TextInput
              value={a.name}
              onChangeText={(t) => set(a.key, 'name', t)}
              placeholder="Tên"
              placeholderTextColor={C.faint}
              accessibilityLabel={`Tên thuộc tính ${i + 1}`}
              style={[styles.attrInput, { flex: 0.8, color: C.muted }]}
            />
            <TextInput
              value={a.value}
              onChangeText={(t) => set(a.key, 'value', t)}
              placeholder="Giá trị"
              placeholderTextColor={C.faint}
              accessibilityLabel={`Giá trị ${a.name || `thuộc tính ${i + 1}`}`}
              style={[styles.attrInput, { flex: 1.2, fontFamily: fonts.semibold }]}
            />
            <PressableScale
              onPress={() => onChange({ attributes: form.attributes.filter((x) => x.key !== a.key) })}
              accessibilityLabel={`Xóa thuộc tính ${a.name || i + 1}`}
              hitSlop={8}
              scaleTo={0.85}>
              <Icon name="trash" size={18} color={C.faint} />
            </PressableScale>
          </View>
        </View>
      ))}
      {form.attributes.length ? <Divider /> : null}
      <PressableScale
        onPress={() =>
          pickFromSheet(
            'Thêm thuộc tính',
            [...ATTRIBUTE_PRESETS.filter((p) => !form.attributes.some((a) => a.name.trim() === p)), 'Tùy chỉnh'].map((p) => ({ value: p, label: p })),
            null,
            (p) => add(p === 'Tùy chỉnh' ? '' : p),
          )
        }
        accessibilityRole="button"
        accessibilityLabel="Thêm thuộc tính"
        scaleTo={0.98}
        style={styles.addAttr}>
        <Icon name="plus" size={16} color={C.brand} />
        <Txt variant="body" weight="semibold" color={C.brand}>
          Thêm thuộc tính
        </Txt>
      </PressableScale>
    </FormCard>
  );
}

export interface ProductFormViewProps {
  form: ProductForm;
  editing: boolean;
  /** Mã hàng lúc mở (tiêu đề khi sửa). */
  code?: string;
  perms: ProductPerms;
  onChange: (patch: Partial<ProductForm> | ((f: ProductForm) => Partial<ProductForm>)) => void;
  onPickImages: () => void;
  onPick: (target: PickTarget) => void;
  onAddComponent: (formulaKey?: string) => void;
  onSave: () => void;
  busy?: boolean;
}

/** Form thêm / sửa hàng hóa (4 loại), theo thứ tự trường như web. */
export function ProductFormView({ form, editing, code, perms, onChange, onPickImages, onPick, onAddComponent, onSave, busy }: ProductFormViewProps) {
  const insets = useSafeAreaInsets();
  const physical = hasPhysical(form.type);
  const stock = hasStock(form.type);
  const auto = computedCost(form);
  const shownCost = effectiveCost(form);
  // Định mức chỉ lưu được kèm giá vốn → khi sửa cần quyền xem giá vốn.
  const limitsEditable = !editing || perms.viewCost;

  return (
    <Page
      stickyHeader
      automaticallyAdjustKeyboardInsets
      header={<SubHeader title={editing ? `Sửa ${code ?? ''}` : `Thêm ${typeLabel(form.type).toLowerCase()}`} />}
      footer={
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Button title={editing ? 'Lưu thay đổi' : 'Lưu hàng hóa'} icon="check" onPress={onSave} loading={busy} />
        </View>
      }
      contentStyle={{ gap: 18, paddingTop: 4, paddingBottom: 40 }}>
      <Images
        form={form}
        onAdd={onPickImages}
        onRemove={(key) => onChange((f) => ({ images: f.images.filter((i) => i.key !== key) }))}
      />

      <FormCard>
        <TextRow
          label="Mã hàng"
          value={form.code}
          onChange={(t) => onChange({ code: t })}
          placeholder={editing ? 'Bắt buộc' : 'Để trống để tự tạo mã'}
          autoCapitalize="characters"
        />
        <Divider />
        <TextRow label="Tên hàng" value={form.name} onChange={(t) => onChange({ name: t })} placeholder="Bắt buộc" autoCapitalize="sentences" />
      </FormCard>

      <FormCard title="Phân loại">
        {perms.viewCategories ? (
          <>
            <PickRow label="Loại hàng" value={form.parentName} onPress={() => onPick('parent')} />
            <Divider />
            <PickRow label="Nguồn gốc" value={form.middleName} onPress={() => onPick('middle')} />
            <Divider />
            <PickRow label="Danh mục" value={form.childName} onPress={() => onPick('child')} />
            <Divider />
          </>
        ) : null}
        <PickRow label="Thương hiệu" value={form.tradeMark?.name ?? ''} onPress={perms.viewTrademarks ? () => onPick('trademark') : undefined} />
        <Divider />
        <PickRow label="Đơn vị tính" value={form.unit} onPress={() => onPick('unit')} />
        {physical ? (
          <>
            <Divider />
            <Select
              label="Loại vận chuyển"
              options={CARGO_TYPES}
              value={form.cargoType}
              onChange={(v) => {
                if (v) onChange({ cargoType: v });
              }}
            />
          </>
        ) : null}
      </FormCard>

      {form.type === 1 ? <ComboEditor form={form} perms={perms} onChange={onChange} onAdd={() => onAddComponent()} /> : null}
      {form.type === 4 ? <FormulaEditor form={form} perms={perms} onChange={onChange} onAdd={onAddComponent} /> : null}

      {perms.viewCost || perms.viewSale || stock ? (
        <FormCard title={stock ? 'Giá và tồn kho' : 'Giá'}>
          {perms.viewCost ? (
            <>
              <NumRow
                label="Giá vốn"
                money
                value={shownCost}
                editable={form.type !== 1}
                onChange={(n) => onChange(form.type === 4 ? { cost: n, manualCost: true } : { cost: n })}
                suffix="₫"
              />
              {form.type === 1 ? (
                <Txt variant="caption" color={C.muted} style={styles.rowHint}>
                  Tự tính theo giá vốn thành phần.
                </Txt>
              ) : form.type === 4 && auto !== null ? (
                <View style={styles.rowHintRow}>
                  <Txt variant="caption" color={C.muted} style={{ flex: 1 }}>
                    {form.manualCost ? `Giá tự gõ. Theo công thức mặc định: ${money(auto)} ₫` : 'Tự tính theo công thức mặc định.'}
                  </Txt>
                  {form.manualCost ? (
                    <PressableScale onPress={() => onChange({ manualCost: false, cost: auto })} hitSlop={8} accessibilityRole="button">
                      <Txt variant="caption" weight="semibold" color={C.brand}>
                        Dùng giá tính
                      </Txt>
                    </PressableScale>
                  ) : null}
                </View>
              ) : null}
              <Divider />
            </>
          ) : null}
          {perms.viewSale ? (
            <NumRow
              label="Giá bán"
              money
              value={form.basePrice}
              onChange={(n) => onChange({ basePrice: n })}
              placeholder={form.type === 1 ? money(comboTotalsOf(form).price) : '0'}
              suffix="₫"
            />
          ) : null}
          {stock ? (
            <>
              {perms.viewSale ? <Divider /> : null}
              <NumRow label="Tồn kho" decimal value={form.stock} onChange={(n) => onChange({ stock: n })} suffix={form.unit || undefined} />
              <Divider />
              <NumRow label="Định mức thấp nhất" decimal value={form.min} onChange={(n) => onChange({ min: n })} editable={limitsEditable} />
              <Divider />
              <NumRow label="Định mức cao nhất" decimal value={form.max} onChange={(n) => onChange({ max: n })} editable={limitsEditable} />
            </>
          ) : null}
        </FormCard>
      ) : null}
      {stock && editing ? <Note tone="warning" text="Đổi số tồn kho sẽ tạo phiếu kiểm kho cho chi nhánh đang chọn." /> : null}
      {stock && editing && !perms.viewCost ? <Note text="Cần quyền xem giá vốn để sửa định mức tồn." /> : null}

      {physical ? (
        <FormCard title="Quy cách">
          <NumRow
            label="Khối lượng tịnh"
            decimal
            value={form.weight}
            editable={!form.isPieceUnit}
            onChange={(n) => onChange({ weight: n })}
            right={<UnitToggle options={['kg', 'g'] as const} value={form.weightUnit} onChange={(v) => onChange({ weightUnit: v })} disabled={form.isPieceUnit} />}
          />
          <Divider />
          <SwitchRow
            label="Tính theo chiếc"
            sub="Không dùng gram/kg khi làm nguyên liệu sản xuất"
            value={form.isPieceUnit}
            onChange={(v) => onChange({ isPieceUnit: v })}
          />
          <Divider />
          <NumRow
            label="Trọng lượng vận chuyển"
            decimal
            value={form.shippingWeight}
            onChange={(n) => onChange({ shippingWeight: n })}
            right={<UnitToggle options={['g', 'kg'] as const} value={form.shippingWeightUnit} onChange={(v) => onChange({ shippingWeightUnit: v })} />}
          />
          <Divider />
          <NumRow
            label="Định lượng đóng gói"
            value={form.conversionValue}
            onChange={(n) => onChange({ conversionValue: n })}
            suffix={form.unit ? `${form.unit}/thùng` : '/thùng'}
            placeholder="1"
          />
          <Divider />
          <NumRow label="VAT" decimal value={form.vat} onChange={(n) => onChange({ vat: n })} suffix="%" />
        </FormCard>
      ) : (
        <FormCard>
          <NumRow label="VAT" decimal value={form.vat} onChange={(n) => onChange({ vat: n })} suffix="%" />
        </FormCard>
      )}

      <Attributes form={form} onChange={onChange} />

      <FormCard title="Khác">
        <SwitchRow label="Bán trực tiếp" value={form.isDirectSale} onChange={(v) => onChange({ isDirectSale: v })} />
        <Divider />
        <TextRow label="Mô tả" value={form.description} onChange={(t) => onChange({ description: t })} placeholder="Mô tả hàng hóa" multiline />
        <Divider />
        <TextRow
          label="Mẫu ghi chú (hóa đơn, đặt hàng)"
          value={form.orderTemplate}
          onChange={(t) => onChange({ orderTemplate: t })}
          placeholder="Ghi chú tự điền khi bán hàng này"
          multiline
        />
      </FormCard>
    </Page>
  );
}

const PICK_PATH: Record<PickTarget, string> = {
  parent: '/hang-hoa/chon-nhom?level=parent',
  middle: '/hang-hoa/chon-nhom?level=middle',
  child: '/hang-hoa/chon-nhom?level=child',
  trademark: '/hang-hoa/chon-thuong-hieu',
  unit: '/hang-hoa/chon-don-vi',
};

export default function ProductFormScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : null;
  const form = useProductDraft((s) => s.form);
  const baseline = useProductDraft((s) => s.baseline);
  const productId = useProductDraft((s) => s.productId);
  const user = useSession((s) => s.user);
  const branchId = useSession((s) => s.branchId);
  const perms = productPerms(user);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [exit, setExit] = useState<{ go: () => void } | null>(null);
  // Đã chọn "Bỏ thay đổi": thôi chặn rời màn.
  const [discarding, setDiscarding] = useState(false);
  const busyRef = useRef(false);

  const editing = editId !== null;
  const valid = !!form && !!baseline && productId === editId;
  const dirty = valid ? formChanges(form, baseline).any : false;

  // Phải gọi `repeat()` (tắt chặn rồi đi tiếp); tự dispatch lại hành động thì
  // màn vẫn đang bị chặn nên hộp hỏi hiện lại mãi.
  usePreventRemove(dirty && !exit && !discarding, ({ repeat }) => {
    Alert.alert('Bỏ thay đổi?', 'Những gì bạn đã nhập sẽ không được lưu.', [
      { text: 'Ở lại', style: 'cancel' },
      {
        text: 'Bỏ thay đổi',
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

  if (!valid || !form || !baseline) {
    return (
      <Page scroll={false} header={<SubHeader title="Hàng hóa" />}>
        <EmptyState
          icon="package"
          color="slate"
          title="Không có hàng đang nhập"
          message="Quay lại danh sách Hàng hóa rồi bấm “+” để thêm hoặc mở hàng rồi bấm “Sửa”."
        />
      </Page>
    );
  }

  const pickImages = async () => {
    const left = MAX_IMAGES - form.images.length;
    if (left <= 0) return;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: left,
        quality: 0.7,
        exif: false,
      });
      if (res.canceled) return;
      patchDraft((f) => ({
        images: [...f.images, ...res.assets.slice(0, left).map((a) => ({ key: newKey('i'), uri: a.uri, remote: false }))],
      }));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const save = async (scope?: CostScope | null) => {
    if (busyRef.current) return;
    const err = validateProductForm(form, editing);
    if (err) {
      Alert.alert('Chưa lưu được', err);
      return;
    }
    if (scope === undefined && needsCostScope(form, editing ? baseline : null, perms.viewCost)) {
      setScopeOpen(true);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      // Tải ảnh mới lên trước; ảnh đã tải thì ghi lại để lần lưu sau không tải lại.
      const urls: string[] = [];
      for (const [i, img] of form.images.entries()) {
        if (img.remote) {
          urls.push(img.uri);
          continue;
        }
        const url = await uploadProductImage(img.uri, i);
        urls.push(url);
        patchDraft((f) => ({ images: f.images.map((x) => (x.key === img.key ? { ...x, uri: url, remote: true } : x)) }));
      }
      const ctx = { branchId, viewCost: perms.viewCost, viewSale: perms.viewSale, imageUrls: urls, costScope: scope ?? null };
      if (editing && editId) {
        const body = buildProductUpdate(form, baseline, ctx);
        if (Object.keys(body).length) await updateProduct(editId, body);
        toast.success(`Đã lưu ${form.code.trim()}`);
        await Promise.all([qc.invalidateQueries({ queryKey: ['product'] }), qc.invalidateQueries({ queryKey: ['products'] })]);
        setExit({ go: () => router.back() });
      } else {
        const created = await createProduct(buildProductCreate(form, ctx));
        toast.success(created?.code ? `Đã thêm ${created.code}` : 'Đã thêm hàng hóa');
        void qc.invalidateQueries({ queryKey: ['products'] });
        setExit({
          go: () =>
            created?.id
              ? router.replace({ pathname: '/hang-hoa/[id]', params: { id: String(created.id) } } as never)
              : router.back(),
        });
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <ProductFormView
        form={form}
        editing={editing}
        code={baseline.code}
        perms={perms}
        onChange={patchDraft}
        onPickImages={() => void pickImages()}
        onPick={(t) => router.push(PICK_PATH[t] as never)}
        onAddComponent={(formulaKey) =>
          router.push({ pathname: '/hang-hoa/chon-thanh-phan', params: formulaKey ? { formula: formulaKey } : {} } as never)
        }
        onSave={() => void save()}
        busy={busy}
      />
      <CostScopeModal
        visible={scopeOpen}
        onCancel={() => setScopeOpen(false)}
        onConfirm={(s) => {
          setScopeOpen(false);
          void save(s);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  images: { paddingHorizontal: 16, gap: 10, paddingVertical: 4 },
  imageTile: {
    width: 92,
    height: 92,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#EEF2F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImage: { gap: 4, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9CCFD6', backgroundColor: C.brandSoft },
  mainBadge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 2,
    alignItems: 'center',
    backgroundColor: 'rgba(11,122,135,0.85)',
  },
  removeImage: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,33,40,0.6)',
  },
  rowHint: { paddingBottom: 10, marginTop: -4 },
  rowHintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 10, marginTop: -4 },
  attrRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50 },
  attrInput: { fontSize: 16, fontFamily: fonts.regular, color: C.text, paddingVertical: 10 },
  addAttr: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
});
