import { Redirect } from 'expo-router';
import { useTabs } from '@/features/shell/tabs';

/** Mở app → tab đầu tiên người dùng có quyền (không có thì vào "Thêm"). */
export default function Index() {
  const { visible } = useTabs();
  const first = visible[0]?.key ?? 'them';
  return <Redirect href={`/${first}`} />;
}
