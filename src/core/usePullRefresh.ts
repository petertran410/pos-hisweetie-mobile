import { useCallback, useState } from 'react';

/**
 * Kéo để làm mới: vòng quay chỉ hiện khi người dùng tự kéo.
 * Không gắn vòng quay với việc làm mới ngầm (sau khi sửa dữ liệu, mở lại app):
 * trên iOS, bật/tắt vòng quay lúc màn đang bị che (vd đang mở màn chi tiết)
 * làm nó quay mãi và để lại khoảng trống phía trên danh sách.
 */
export function usePullRefresh(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refresh().finally(() => setRefreshing(false));
  }, [refresh]);
  return { refreshing, onRefresh };
}
