import { ProductsStack } from '@/features/products/ProductsStack';
import { AreaGuard } from '@/features/shell/AreaGuard';

export default function Layout() {
  return (
    <AreaGuard area="hang-hoa">
      <ProductsStack />
    </AreaGuard>
  );
}
