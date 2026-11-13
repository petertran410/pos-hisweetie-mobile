import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { LinearTransition, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '@/core/http';
import { canUseLarkApp, signInWithLark, signInWithPassword, useSession } from '@/core/session';
import { Banner, Button, C, Card, gentleEntering, Icon, PageBackground, TextField, Txt } from '@/ui';
import { easeOut } from '@/ui/motion';
import { Logo } from './Logo';

type Mode = 'lark' | 'password';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const notice = useSession((s) => s.notice);
  const [mode, setMode] = useState<Mode>('lark');
  const [busy, setBusy] = useState<'lark' | 'password' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  // Có app Lark trên máy thì xác thực bằng app Lark, không thì trên trang Lark.
  const [larkApp, setLarkApp] = useState(false);

  useEffect(() => {
    let alive = true;
    void canUseLarkApp().then((ok) => {
      if (alive) setLarkApp(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const loginLark = async () => {
    setError(null);
    setBusy('lark');
    try {
      const result = await signInWithLark();
      if (result.kind === 'setup') {
        router.push({ pathname: '/tao-mat-khau', params: { token: result.setupToken } });
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const loginPassword = async () => {
    if (!email.trim() || !password) {
      setError('Nhập email và mật khẩu để đăng nhập');
      return;
    }
    setError(null);
    setBusy('password');
    try {
      await signInWithPassword(email, password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const switchMode = (next: Mode) => {
    setError(null);
    setMode(next);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <PageBackground />
      {/* Android: KeyboardResize ở gốc app đã thu màn lên trên bàn phím. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive">
          <View style={styles.brand}>
            <Animated.View entering={ZoomIn.duration(380).easing(easeOut)}>
              <Logo size={76} />
            </Animated.View>
            <Txt variant="label" weight="bold" color={C.brand} style={styles.brandName}>
              HISWEETIE POS
            </Txt>
            <Txt variant="title" align="center">
              Đăng nhập vào tài khoản
            </Txt>
            <Txt variant="body" color={C.muted} align="center">
              Lên đơn, xem công nợ và báo đơn ngay trên iPhone
            </Txt>
          </View>

          {/* Mở màn: khung hiện dần; đổi giữa Lark và email: khung co giãn mượt. */}
          <Animated.View entering={gentleEntering(2)} layout={LinearTransition.duration(250)}>
          <Card style={styles.panel}>
            {notice && !error ? <Banner tone="info" title={notice} /> : null}
            {error ? <Banner tone="danger" title={error} /> : null}

            {mode === 'lark' ? (
              <View key="lark" style={styles.modeBody}>
                <Button
                  title="Đăng nhập bằng Lark"
                  icon="key-round"
                  onPress={loginLark}
                  loading={busy === 'lark'}
                  disabled={busy !== null}
                />
                <Button
                  title="Email và mật khẩu"
                  icon="mail"
                  variant="outline"
                  onPress={() => switchMode('password')}
                  disabled={busy !== null}
                />
                <View style={styles.hint}>
                  <Icon name="info" size={16} color={C.muted} />
                  <Txt variant="caption" color={C.muted} style={{ flex: 1 }}>
                    {larkApp
                      ? 'Dùng tài khoản Lark của công ty. App Lark sẽ mở để bạn bấm đồng ý, xong tự quay lại đây.'
                      : 'Dùng tài khoản Lark của công ty. Đăng nhập ngay trên trang Lark vừa mở, không chọn mở ứng dụng Lark.'}
                  </Txt>
                </View>
              </View>
            ) : (
              <View key="password" style={styles.modeBody}>
                <TextField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="ten@congty.vn"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="username"
                  autoComplete="email"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
                <TextField
                  ref={passwordRef}
                  label="Mật khẩu"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Nhập mật khẩu"
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  autoComplete="current-password"
                  returnKeyType="go"
                  onSubmitEditing={loginPassword}
                  right={
                    <Pressable
                      onPress={() => setShowPassword((v) => !v)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                      <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color={C.muted} />
                    </Pressable>
                  }
                />
                <Button
                  title="Đăng nhập"
                  onPress={loginPassword}
                  loading={busy === 'password'}
                  disabled={busy !== null}
                  style={{ marginTop: 4 }}
                />
                <Button
                  title="Quay lại đăng nhập bằng Lark"
                  variant="ghost"
                  size="medium"
                  onPress={() => switchMode('lark')}
                  disabled={busy !== null}
                />
              </View>
            )}
          </Card>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 20, justifyContent: 'center', gap: 28 },
  brand: { alignItems: 'center', gap: 10 },
  brandName: { letterSpacing: 2, marginTop: 6 },
  panel: { padding: 18, gap: 14 },
  modeBody: { gap: 14 },
  hint: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingTop: 2 },
});
