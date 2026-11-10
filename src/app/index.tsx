import { Redirect } from 'expo-router';
import { useTabNavigation } from '@/features/shell/tabNavigation';

/** Mở app → tab đầu tiên người dùng có quyền (không có thì vào "Thêm"). */
export default function Index() {
  const { visible } = useTabNavigation();
  const first = visible[0]?.key ?? 'them';
  return <Redirect href={`/${first}`} />;
}
