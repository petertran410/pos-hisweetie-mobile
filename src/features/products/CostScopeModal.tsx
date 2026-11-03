import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSession } from '@/core/session';
import { Button, C, Icon, PressableScale, SheetHeader, Txt } from '@/ui';
import type { CostScope } from './form';

function Choice({ on, title, sub, onPress }: { on: boolean; title: string; sub: string; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={title}
      scaleTo={0.98}
      style={[styles.choice, on ? styles.choiceOn : null]}>
      <View style={[styles.radio, on ? styles.radioOn : null]}>{on ? <View style={styles.dot} /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="body" weight="semibold">
          {title}
        </Txt>
        <Txt variant="caption" color={C.muted}>
          {sub}
        </Txt>
      </View>
    </PressableScale>
  );
}

export interface CostScopeViewProps {
  branches: { id: number; name: string }[];
  currentBranchId: number | null;
  onCancel: () => void;
  onConfirm: (s: CostScope) => void;
}

/** Áp dụng giá vốn mới cho toàn hệ thống hay chỉ vài chi nhánh (giống web). */
export function CostScopeView({ branches, currentBranchId, onCancel, onConfirm }: CostScopeViewProps) {
  const [scope, setScope] = useState<CostScope['scope']>('all');
  const [picked, setPicked] = useState<number[]>(currentBranchId ? [currentBranchId] : []);
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const ok = scope === 'all' || picked.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Áp dụng giá vốn" cancelLabel="Bỏ qua" onCancel={onCancel} />
      <ScrollView contentContainerStyle={styles.body}>
        <Txt variant="body" color={C.muted}>
          Giá vốn đã thay đổi. Bạn muốn áp dụng giá vốn mới cho hàng này ở đâu?
        </Txt>
        <Choice on={scope === 'all'} title="Toàn hệ thống" sub="Mọi chi nhánh đang hoạt động" onPress={() => setScope('all')} />
        <Choice on={scope === 'specific'} title="Chi nhánh cụ thể" sub="Chỉ các chi nhánh bạn chọn" onPress={() => setScope('specific')} />
        {scope === 'specific' ? (
          <View style={styles.list}>
            {branches.map((b) => {
              const on = picked.includes(b.id);
              return (
                <PressableScale
                  key={b.id}
                  onPress={() => toggle(b.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={b.name}
                  scaleTo={0.98}
                  style={styles.branch}>
                  <View style={[styles.check, on ? styles.checkOn : null]}>{on ? <Icon name="check" size={14} color={C.white} strokeWidth={3} /> : null}</View>
                  <Txt variant="body" style={{ flex: 1 }} numberOfLines={1}>
                    {b.name}
                  </Txt>
                  {b.id === currentBranchId ? (
                    <Txt variant="caption" color={C.brand} weight="semibold">
                      Đang chọn
                    </Txt>
                  ) : null}
                </PressableScale>
              );
            })}
          </View>
        ) : null}
        <Button
          title={ok ? 'Đồng ý và lưu' : 'Chọn ít nhất 1 chi nhánh'}
          disabled={!ok}
          onPress={() => onConfirm(scope === 'all' ? { scope } : { scope, branchIds: picked })}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </View>
  );
}

export function CostScopeModal({ visible, onCancel, onConfirm }: { visible: boolean; onCancel: () => void; onConfirm: (s: CostScope) => void }) {
  const branches = useSession((s) => s.branches);
  const branchId = useSession((s) => s.branchId);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      {visible ? <CostScopeView branches={branches} currentBranchId={branchId} onCancel={onCancel} onConfirm={onConfirm} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1.2,
    borderColor: C.border,
  },
  choiceOn: { borderColor: C.brand, backgroundColor: C.brandSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#B8C4CF', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.brand },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.brand },
  list: { borderRadius: 14, backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden' },
  branch: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 50 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#B8C4CF', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: C.brand, borderColor: C.brand },
});
