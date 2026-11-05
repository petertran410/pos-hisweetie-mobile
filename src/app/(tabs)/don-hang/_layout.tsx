import { OrdersStack } from '@/features/orders/OrdersStack';
import { AreaGuard } from '@/features/shell/AreaGuard';

export default function Layout() {
  return (
    <AreaGuard area="don-hang">
      <OrdersStack />
    </AreaGuard>
  );
}
