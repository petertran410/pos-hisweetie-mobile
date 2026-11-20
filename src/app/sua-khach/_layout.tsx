import { CustomerEditStack } from '@/features/customers/CustomerEditStack';
import { AreaGuard } from '@/features/shell/AreaGuard';

export default function Layout() {
  return (
    <AreaGuard area="khach-hang">
      <CustomerEditStack />
    </AreaGuard>
  );
}
