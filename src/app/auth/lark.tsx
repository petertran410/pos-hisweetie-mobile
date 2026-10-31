import { Redirect } from 'expo-router';

/** Lark trả về app qua link này; phiên đăng nhập xử lý ở màn đăng nhập. */
export default function LarkReturn() {
  return <Redirect href="/" />;
}
