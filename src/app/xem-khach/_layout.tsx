import { CustomerViewStack } from '@/features/customers/CustomerViewStack';
import { AreaGuard } from '@/features/shell/AreaGuard';

export default function Layout() {
  return (
    <AreaGuard area="khach-hang">
      <CustomerViewStack />
    </AreaGuard>
  );
}
