import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/core/query';
import { bootstrap, useSession } from '@/core/session';
import { refreshIfStale } from '@/core/tokens';
import { PrivacyCover } from '@/features/shell/PrivacyCover';
import { Button, EmptyState, ToastHost } from '@/ui';

void SplashScreen.preventAutoHideAsync();

const TINT = { light: '#1A5F6A', dark: '#5CC8D5' };

export default function RootLayout() {
  const status = useSession((s) => s.status);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    void bootstrap().finally(() => SplashScreen.hideAsync());
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshIfStale();
    });
    return () => sub.remove();
  }, []);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, primary: TINT[scheme] } };

  if (status === 'booting') return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={theme}>
          {status === 'offline' ? (
            <EmptyState
              icon="wifi.slash"
              title="Không kết nối được máy chủ"
              message="Kiểm tra mạng của iPhone rồi thử lại."
              action={
                <Button
                  title="Thử lại"
                  variant="secondary"
                  size="medium"
                  onPress={() => {
                    useSession.setState({ status: 'booting' });
                    void bootstrap();
                  }}
                />
              }
            />
          ) : (
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Protected guard={status === 'signedIn'}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="chi-nhanh"
                  options={{
                    headerShown: true,
                    title: 'Chọn chi nhánh',
                    presentation: 'formSheet',
                    sheetAllowedDetents: [0.5, 1],
                    sheetGrabberVisible: true,
                  }}
                />
              </Stack.Protected>
              <Stack.Protected guard={status === 'signedOut'}>
                <Stack.Screen name="dang-nhap" />
                <Stack.Screen
                  name="tao-mat-khau"
                  options={{ headerShown: true, title: 'Tạo mật khẩu', headerBackTitle: 'Quay lại' }}
                />
              </Stack.Protected>
              <Stack.Screen name="auth/lark" />
            </Stack>
          )}
          <ToastHost />
          <PrivacyCover />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
