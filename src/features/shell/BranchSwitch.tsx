import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSession } from '@/core/session';
import { C, Icon, PressableScale, Txt } from '@/ui';

export interface BranchSwitchProps {
  /** Tên chi nhánh đang chọn. */
  name: string;
  /** Mở chọn chi nhánh (không có = chỉ có 1 chi nhánh: chỉ hiện tên). */
  onPress?: () => void;
}

/** Nút gọn ở đầu trang: chi nhánh đang chọn, bấm để đổi (cùng sheet với tab Thêm). */
export function BranchSwitch({ name, onPress }: BranchSwitchProps) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Chi nhánh ${name}. Bấm để đổi chi nhánh` : `Chi nhánh ${name}`}
      hitSlop={4}
      scaleTo={0.96}
      style={styles.pill}>
      <Icon name="store" size={16} color={C.brand} />
      <Txt variant="label" weight="semibold" color={C.brand} numberOfLines={1} style={{ flexShrink: 1 }}>
        {name}
      </Txt>
      {onPress ? <Icon name="chevron-down" size={15} color={C.brand} /> : null}
    </PressableScale>
  );
}

/** Dữ liệu cho `BranchSwitch` từ phiên đăng nhập; chưa có chi nhánh nào thì không hiện. */
export function useBranchSwitch(): BranchSwitchProps | undefined {
  const branches = useSession((s) => s.branches);
  const branchId = useSession((s) => s.branchId);
  const current = branches.find((b) => b.id === branchId);
  if (!current) return undefined;
  return { name: current.name, onPress: branches.length > 1 ? () => router.push('/chi-nhanh') : undefined };
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    maxWidth: 180,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: '#CFE3E6',
  },
});
