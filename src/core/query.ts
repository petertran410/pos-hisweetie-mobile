import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { ApiError } from './request';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      // Chỉ thử lại khi mất mạng / lỗi máy chủ, không thử lại lỗi quyền.
      retry: (count, error) =>
        count < 2 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
    },
    mutations: { retry: false },
  },
});

/** Mở lại app → làm mới dữ liệu đang hiển thị. */
AppState.addEventListener('change', (state) => {
  focusManager.setFocused(state === 'active');
});
