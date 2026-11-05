import { KhoStack } from '@/features/warehouse/KhoStack';
import { AreaGuard } from '@/features/shell/AreaGuard';

export default function Layout() {
  return (
    <AreaGuard area="phieu-kho">
      <KhoStack />
    </AreaGuard>
  );
}
