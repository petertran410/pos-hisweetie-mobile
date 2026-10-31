import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { errorMessage } from '@/core/http';
import { switchBranch, useSession, type Branch } from '@/core/session';
import { C, Card, Icon, IconBadge, toast, Txt } from '@/ui';

export function BranchPickerView({
  branches,
  branchId,
  switching,
  onPick,
}: {
  branches: Branch[];
  branchId: number | null;
  switching: number | null;
  onPick: (id: number) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content} style={{ backgroundColor: C.bg }}>
      <Txt variant="title">Chọn chi nhánh</Txt>
      <Txt variant="label" weight="regular" color={C.muted}>
        Số liệu, quyền và đơn hàng sẽ đổi theo chi nhánh bạn chọn.
      </Txt>
      <View style={{ gap: 10, marginTop: 8 }}>
        {branches.map((b) => {
          const on = b.id === branchId;
          return (
            <Card
              key={b.id}
              onPress={switching === null ? () => onPick(b.id) : undefined}
              accessibilityLabel={on ? `${b.name}, đang chọn` : b.name}
              style={[styles.item, on ? styles.itemOn : null]}>
              <IconBadge name="store" color={on ? 'teal' : 'slate'} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="body" weight="semibold" numberOfLines={1}>
                  {b.name}
                </Txt>
                {b.address ? (
                  <Txt variant="caption" color={C.muted} numberOfLines={2}>
                    {b.address}
                  </Txt>
                ) : null}
              </View>
              {switching === b.id ? (
                <ActivityIndicator color={C.brand} />
              ) : on ? (
                <Animated.View entering={ZoomIn.duration(200)} style={styles.check}>
                  <Icon name="check" size={16} color={C.white} strokeWidth={2.6} />
                </Animated.View>
              ) : null}
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}

/** Chọn chi nhánh (mở dạng sheet). Quyền và dữ liệu đổi theo chi nhánh. */
export default function BranchPickerScreen() {
  const branches = useSession((s) => s.branches);
  const branchId = useSession((s) => s.branchId);
  const [switching, setSwitching] = useState<number | null>(null);

  const pick = async (id: number) => {
    if (id === branchId) return router.back();
    setSwitching(id);
    try {
      await switchBranch(id);
      router.back();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSwitching(null);
    }
  };

  return <BranchPickerView branches={branches} branchId={branchId} switching={switching} onPick={(id) => void pick(id)} />;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 28, gap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  itemOn: { borderColor: C.brand, borderWidth: 1.5 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
