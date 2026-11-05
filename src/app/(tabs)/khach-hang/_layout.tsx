import { CustomersStack } from '@/features/customers/CustomersStack';
import { AreaGuard } from '@/features/shell/AreaGuard';

export default function Layout() {
  return (
    <AreaGuard area="khach-hang">
      <CustomersStack />
    </AreaGuard>
  );
}
