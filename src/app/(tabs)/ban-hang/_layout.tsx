import { SalesStack } from '@/features/sales/SalesStack';
import { AreaGuard } from '@/features/shell/AreaGuard';

export default function Layout() {
  return (
    <AreaGuard area="ban-hang">
      <SalesStack />
    </AreaGuard>
  );
}
