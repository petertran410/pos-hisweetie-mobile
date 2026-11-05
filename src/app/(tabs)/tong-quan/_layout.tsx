import { AreaGuard } from '@/features/shell/AreaGuard';
import { TabStack } from '@/features/shell/TabStack';

export default function Layout() {
  return (
    <AreaGuard area="tong-quan">
      <TabStack name="tong-quan" />
    </AreaGuard>
  );
}
