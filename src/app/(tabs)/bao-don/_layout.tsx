import { PackingStack } from '@/features/packing/PackingStack';
import { AreaGuard } from '@/features/shell/AreaGuard';

export default function Layout() {
  return (
    <AreaGuard area="bao-don">
      <PackingStack />
    </AreaGuard>
  );
}
