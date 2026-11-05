import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSession } from '@/core/session';
import { Button, C, EmptyState, PageBackground, TitleHeader } from '@/ui';
import { areaDef, canEnterArea, type AreaKey } from './tabs';

/**
 * Chặn cả mục (mọi màn bên trong) khi không có quyền. Tab bị ẩn khỏi thanh tab
 * vẫn mở được bằng link (hisweetiepos://bao-don/…) hoặc khi quyền đổi theo chi
 * nhánh, nên mỗi mục phải tự kiểm tra lại.
 */
export function AreaGuard({ area, children }: { area: AreaKey; children: ReactNode }) {
  const allowed = useSession((s) => canEnterArea(s.user, area));
  if (allowed) return children;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <PageBackground />
      <TitleHeader title={areaDef(area).label} />
      <EmptyState
        icon="lock"
        color="slate"
        title="Chưa có quyền truy cập"
        message="Tài khoản chưa được cấp quyền dùng mục này ở chi nhánh đang chọn. Liên hệ quản lý để được cấp quyền."
        action={<Button title="Về trang chính" variant="outline" size="medium" onPress={() => router.replace('/')} />}
      />
    </View>
  );
}
