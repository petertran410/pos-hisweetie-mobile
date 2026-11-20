import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { decimalInput, decimalText, money, parseQty, qty } from '@/core/format';
import { C, ChipGroup, Divider, fonts, Icon, PressableScale, QtyStepper, Txt } from '@/ui';
import { Thumb } from '../sales/components';
import { comboTotalsOf, defaultFormula, newKey, type FormFormula, type ProductForm } from './form';
import { FormCard } from './formParts';
import {
  displayQty,
  effectiveMode,
  formulaCost,
  INPUT_MODES,
  modesFor,
  storedQty,
  switchMode,
  type ComponentLine,
  type InputMode,
  type ProductPerms,
} from './model';

type Change = (patch: Partial<ProductForm> | ((f: ProductForm) => Partial<ProductForm>)) => void;

function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} scaleTo={0.98} style={styles.add}>
      <Icon name="circle-plus" size={20} color={C.brand} />
      <Txt variant="body" weight="semibold" color={C.brand}>
        {label}
      </Txt>
    </PressableScale>
  );
}

function Head({ c, showCost }: { c: ComponentLine; showCost: boolean }) {
  return (
    <View style={styles.head}>
      <Thumb uri={c.image} size={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="label" weight="semibold" numberOfLines={2}>
          {c.name}
        </Txt>
        <Txt variant="caption" color={C.muted} numeric numberOfLines={1}>
          {[c.code, showCost && c.cost !== null ? `Vốn ${money(c.cost)}${c.unit ? `/${c.unit}` : ''}` : null].filter(Boolean).join(' · ')}
        </Txt>
      </View>
    </View>
  );
}

/** Thành phần combo: số lượng nguyên ≥ 1. */
export function ComboEditor({ form, perms, onChange, onAdd }: { form: ProductForm; perms: ProductPerms; onChange: Change; onAdd: () => void }) {
  const totals = comboTotalsOf(form);
  const setQty = (id: number, n: number) => onChange((f) => ({ components: f.components.map((c) => (c.productId === id ? { ...c, quantity: n } : c)) }));
  const remove = (id: number) => onChange((f) => ({ components: f.components.filter((c) => c.productId !== id) }));
  return (
    <FormCard
      title={`Thành phần combo · ${form.components.length}`}
      hint={perms.viewCost ? `Giá vốn combo = tổng giá vốn thành phần × số lượng (${money(totals.cost)} ₫).` : undefined}>
      {form.components.map((c, i) => (
        <View key={c.productId}>
          {i > 0 ? <Divider /> : null}
          <View style={styles.line}>
            <Head c={c} showCost={perms.viewCost} />
            <View style={styles.lineRight}>
              <QtyStepper value={c.quantity} min={1} size="small" label={c.name} onChange={(n) => setQty(c.productId, Math.max(1, Math.round(n)))} />
              <PressableScale onPress={() => remove(c.productId)} accessibilityLabel={`Bỏ ${c.name}`} hitSlop={8} scaleTo={0.85}>
                <Icon name="trash" size={18} color={C.faint} />
              </PressableScale>
            </View>
          </View>
        </View>
      ))}
      {form.components.length ? <Divider /> : null}
      <AddRow label="Thêm hàng thành phần" onPress={onAdd} />
    </FormCard>
  );
}

/** Ô nhập số lượng nguyên liệu (cho phép số lẻ). */
function AmountInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [text, setText] = useState(decimalText(value));
  const shown = parseQty(text) === value ? text : decimalText(value);
  return (
    <TextInput
      value={shown}
      onChangeText={(t) => {
        const clean = decimalInput(t);
        setText(clean);
        onChange(parseQty(clean));
      }}
      keyboardType="decimal-pad"
      placeholder="0"
      placeholderTextColor={C.faint}
      selectTextOnFocus
      accessibilityLabel={label}
      style={styles.amount}
    />
  );
}

const MODE_LABEL: Record<InputMode, string> = Object.fromEntries(INPUT_MODES.map((m) => [m.value, m.label])) as Record<InputMode, string>;

function IngredientRow({ c, showCost, onChange, onRemove }: { c: ComponentLine; showCost: boolean; onChange: (next: ComponentLine) => void; onRemove: () => void }) {
  const modes = modesFor(c);
  const mode = effectiveMode(c);
  const shown = displayQty(c);
  return (
    <View style={styles.ingredient}>
      <View style={styles.line}>
        <Head c={c} showCost={showCost} />
        <PressableScale onPress={onRemove} accessibilityLabel={`Bỏ ${c.name}`} hitSlop={8} scaleTo={0.85}>
          <Icon name="trash" size={18} color={C.faint} />
        </PressableScale>
      </View>
      {modes.length > 1 ? (
        <ChipGroup<InputMode>
          fill
          options={modes.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
          value={mode}
          onChange={(m) => onChange(switchMode(c, m))}
        />
      ) : null}
      <View style={styles.amountRow}>
        <Txt variant="label" color={C.muted} style={{ flex: 1 }}>
          {modes.length > 1 ? 'Cho 1 thành phẩm' : `Cho 1 thành phẩm (tính theo ${MODE_LABEL[mode].toLowerCase()})`}
        </Txt>
        <AmountInput value={shown.value} label={`Số lượng ${c.name}`} onChange={(n) => onChange({ ...c, quantity: storedQty(c, n) })} />
        <Txt variant="body" color={C.muted} style={{ minWidth: 28 }} numberOfLines={1}>
          {shown.suffix}
        </Txt>
      </View>
      {mode === 'carton' ? (
        <Txt variant="caption" color={C.muted}>
          1 thùng = {qty(c.conversionValue)} {c.unit ?? 'đơn vị'} → {qty(Math.round(c.quantity * 10000) / 10000)} {c.unit ?? 'đơn vị'} cho 1 thành phẩm
        </Txt>
      ) : null}
    </View>
  );
}

/** Công thức của hàng sản xuất: nhiều công thức, đúng 1 mặc định (dùng tính giá vốn). */
export function FormulaEditor({
  form,
  perms,
  onChange,
  onAdd,
}: {
  form: ProductForm;
  perms: ProductPerms;
  onChange: Change;
  onAdd: (formulaKey: string) => void;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = form.formulas.find((f) => f.key === activeKey) ?? defaultFormula(form);

  const update = (key: string, fn: (f: FormFormula) => FormFormula) =>
    onChange((p) => ({ formulas: p.formulas.map((f) => (f.key === key ? fn(f) : f)) }));

  const uniqueName = (base: string) => {
    const taken = new Set(form.formulas.map((f) => f.name.trim().toLowerCase()));
    let name = base;
    for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base} ${i}`;
    return name;
  };

  const addFormula = (copyFrom?: FormFormula) => {
    const next: FormFormula = {
      key: newKey('f'),
      name: copyFrom ? uniqueName(`${copyFrom.name.trim() || 'Công thức'} (bản sao)`) : uniqueName(`Công thức ${form.formulas.length + 1}`),
      isDefault: form.formulas.length === 0,
      components: copyFrom ? copyFrom.components.map((c) => ({ ...c })) : [],
    };
    onChange((p) => ({ formulas: [...p.formulas, next] }));
    setActiveKey(next.key);
  };

  const removeFormula = (f: FormFormula) =>
    Alert.alert(`Xóa “${f.name || 'công thức'}”?`, 'Công thức sẽ bị xóa khi bạn lưu hàng hóa.', [
      { text: 'Hủy bỏ', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          onChange((p) => {
            const rest = p.formulas.filter((x) => x.key !== f.key);
            // Xóa công thức mặc định → công thức đầu tiên thành mặc định.
            if (f.isDefault && rest.length) rest[0] = { ...rest[0], isDefault: true };
            return { formulas: rest };
          });
          setActiveKey(null);
        },
      },
    ]);

  const cost = active ? formulaCost(active.components) : 0;

  return (
    <View style={{ gap: 10 }}>
      <Txt variant="heading" style={{ marginTop: 6 }}>
        Công thức sản xuất
      </Txt>
      <ChipGroup
        options={form.formulas.map((f) => ({ value: f.key, label: `${f.isDefault ? '★ ' : ''}${f.name.trim() || 'Chưa đặt tên'}` }))}
        value={active?.key ?? null}
        onChange={setActiveKey}
      />
      <View style={styles.formulaActions}>
        <PressableScale onPress={() => addFormula()} accessibilityRole="button" scaleTo={0.94} style={styles.chipBtn}>
          <Icon name="plus" size={14} color={C.brand} />
          <Txt variant="label" weight="semibold" color={C.brand}>
            Công thức
          </Txt>
        </PressableScale>
        {active ? (
          <>
            <PressableScale onPress={() => addFormula(active)} accessibilityRole="button" accessibilityLabel="Sao chép công thức" scaleTo={0.94} style={styles.chipBtn}>
              <Icon name="copy" size={14} color={C.brand} />
              <Txt variant="label" weight="semibold" color={C.brand}>
                Sao chép
              </Txt>
            </PressableScale>
            {!active.isDefault ? (
              <PressableScale
                onPress={() => onChange((p) => ({ formulas: p.formulas.map((f) => ({ ...f, isDefault: f.key === active.key })) }))}
                accessibilityRole="button"
                accessibilityLabel="Đặt làm công thức mặc định"
                scaleTo={0.94}
                style={styles.chipBtn}>
                <Icon name="star" size={14} color={C.brand} />
                <Txt variant="label" weight="semibold" color={C.brand}>
                  Đặt mặc định
                </Txt>
              </PressableScale>
            ) : null}
            {form.formulas.length > 1 ? (
              <PressableScale onPress={() => removeFormula(active)} accessibilityRole="button" accessibilityLabel="Xóa công thức" scaleTo={0.94} style={[styles.chipBtn, styles.danger]}>
                <Icon name="trash" size={14} color="#B91C1C" />
                <Txt variant="label" weight="semibold" color="#B91C1C">
                  Xóa
                </Txt>
              </PressableScale>
            ) : null}
          </>
        ) : null}
      </View>

      {active ? (
        <FormCard>
          <View style={styles.nameRow}>
            <Txt variant="body" color={C.muted}>
              Tên công thức
            </Txt>
            <TextInput
              value={active.name}
              onChangeText={(t) => update(active.key, (f) => ({ ...f, name: t }))}
              placeholder="Công thức 1"
              placeholderTextColor={C.faint}
              accessibilityLabel="Tên công thức"
              style={styles.nameInput}
            />
          </View>
          {active.components.map((c) => (
            <View key={c.productId}>
              <Divider />
              <IngredientRow
                c={c}
                showCost={perms.viewCost}
                onChange={(next) => update(active.key, (f) => ({ ...f, components: f.components.map((x) => (x.productId === c.productId ? next : x)) }))}
                onRemove={() => update(active.key, (f) => ({ ...f, components: f.components.filter((x) => x.productId !== c.productId) }))}
              />
            </View>
          ))}
          <Divider />
          <AddRow label="Thêm nguyên liệu" onPress={() => onAdd(active.key)} />
          {perms.viewCost ? (
            <>
              <Divider />
              <View style={styles.costRow}>
                <Txt variant="label" color={C.muted} style={{ flex: 1 }}>
                  Giá vốn theo công thức này
                </Txt>
                <Txt variant="body" weight="bold" numeric>
                  {money(cost)} ₫
                </Txt>
              </View>
            </>
          ) : null}
        </FormCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  add: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50 },
  head: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  lineRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ingredient: { paddingBottom: 12, gap: 6 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amount: {
    width: 84,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: '#D5DEE6',
    paddingHorizontal: 10,
    textAlign: 'right',
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: C.text,
    backgroundColor: C.card,
  },
  formulaActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 34, borderRadius: 999, backgroundColor: C.brandSoft },
  danger: { backgroundColor: '#FEE2E2' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50 },
  nameInput: { flex: 1, textAlign: 'right', fontSize: 16, fontFamily: fonts.semibold, color: C.text, paddingVertical: 10 },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
});
