import { router, useLocalSearchParams } from 'expo-router';
import { ErrorState, LoadingState, Page, SubHeader } from '@/ui';
import { useDocDetail } from '../orders/api';
import { OrderDetailView } from '../orders/OrderDetailScreen';
import { kindFromSlug, KIND_SLUG, type DocKind } from '../orders/model';

const open = (kind: DocKind, id: number) =>
  router.push({ pathname: '/hang-hoa/chung-tu/[kind]/[id]', params: { kind: KIND_SLUG[kind], id: String(id) } } as never);

/**
 * Xem hóa đơn / đơn đặt hàng mở từ thẻ kho (chỉ xem, ở lại trong mục Hàng
 * hóa). Muốn xử lý thì vào tab Đơn hàng.
 */
export default function ProductDocScreen() {
  const params = useLocalSearchParams<{ kind: string; id: string }>();
  const kind = kindFromSlug(params.kind);
  const doc = useDocDetail(kind, Number(params.id));

  if (doc.isLoading || !doc.data) {
    return (
      <Page stickyHeader scroll={false} header={<SubHeader title={kind === 'invoice' ? 'Hóa đơn' : 'Đơn đặt hàng'} />}>
        {doc.isError ? <ErrorState error={doc.error} onRetry={() => void doc.refetch()} /> : <LoadingState />}
      </Page>
    );
  }
  return (
    <OrderDetailView
      doc={doc.data}
      canPrint={false}
      onPrint={() => {}}
      onOpenOrder={(id) => open('order', id)}
      onOpenInvoice={(id) => open('invoice', id)}
    />
  );
}
