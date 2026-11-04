import { BeVietnamPro_400Regular } from '@expo-google-fonts/be-vietnam-pro/400Regular';
import { BeVietnamPro_500Medium } from '@expo-google-fonts/be-vietnam-pro/500Medium';
import { BeVietnamPro_600SemiBold } from '@expo-google-fonts/be-vietnam-pro/600SemiBold';
import { BeVietnamPro_700Bold } from '@expo-google-fonts/be-vietnam-pro/700Bold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/core/query';
import { bootstrap, useSession } from '@/core/session';
import { refreshIfStale } from '@/core/tokens';
import { UpdateWatcher } from '@/features/shell/appUpdate';
import { PrivacyCover } from '@/features/shell/PrivacyCover';
import { Button, C, EmptyState, Page, ToastHost } from '@/ui';

void SplashScreen.preventAutoHideAsync();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: C.brand, background: C.bg, card: C.card, text: C.text, border: C.border },
};

export default function RootLayout() {
  const status = useSession((s) => s.status);
  const [booted, setBooted] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
  });
  const ready = booted && (fontsLoaded || !!fontError);

  useEffect(() => {
    void bootstrap().finally(() => setBooted(true));
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshIfStale();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready || status === 'booting') return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={theme}>
          <StatusBar style="dark" />
          {status === 'offline' ? (
            <Page scroll={false}>
              <EmptyState
                icon="wifi-off"
                color="slate"
                title="Không kết nối được máy chủ"
                message="Kiểm tra mạng của iPhone rồi thử lại."
                action={
                  <Button
                    title="Thử lại"
                    variant="outline"
                    size="medium"
                    onPress={() => {
                      useSession.setState({ status: 'booting' });
                      void bootstrap();
                    }}
                  />
                }
              />
            </Page>
          ) : (
            <Stack
              // Đăng nhập ↔ vào app: chuyển mờ dần thay vì trượt.
              screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: C.bg } }}>
              <Stack.Protected guard={status === 'signedIn'}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(tabs)" />
                {/* Mục mở từ Tổng quan / tab Thêm: trượt vào như trang con. */}
                <Stack.Screen name="hang-hoa" options={{ animation: 'default' }} />
                <Stack.Screen
                  name="chi-nhanh"
                  options={{
                    presentation: 'formSheet',
                    sheetAllowedDetents: [0.55, 1],
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 24,
                    contentStyle: { backgroundColor: C.bg },
                  }}
                />
              </Stack.Protected>
              <Stack.Protected guard={status === 'signedOut'}>
                <Stack.Screen name="dang-nhap" />
                <Stack.Screen name="tao-mat-khau" options={{ animation: 'default' }} />
              </Stack.Protected>
              <Stack.Screen name="auth/lark" />
              <Stack.Screen name="xem-truoc" />
            </Stack>
          )}
          <ToastHost />
          <PrivacyCover />
          <UpdateWatcher />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
