import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { errorMessage } from '@/core/http';
import { switchBranch, useSession } from '@/core/session';
import { Row, Screen, Section, toast } from '@/ui';

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

  return (
    <Screen>
      <Section>
        {branches.map((b) => (
          <Row
            key={b.id}
            title={b.name}
            subtitle={b.address ?? undefined}
            checked={b.id === branchId && switching === null}
            right={switching === b.id ? <ActivityIndicator /> : undefined}
            onPress={switching === null ? () => void pick(b.id) : undefined}
          />
        ))}
      </Section>
    </Screen>
  );
}
