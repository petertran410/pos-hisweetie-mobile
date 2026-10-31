import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorMessage } from '@/core/http';
import { signInWithLark, signInWithPassword, useSession } from '@/core/session';
import { Banner, Button, C, Txt } from '@/ui';
import { Logo } from './Logo';

type Mode = 'lark' | 'password';

export default function LoginScreen() {
  const notice = useSession((s) => s.notice);
  const [mode, setMode] = useState<Mode>('lark');
  const [busy, setBusy] = useState<'lark' | 'password' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

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

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive">
          <View style={styles.brand}>
            <Logo />
            <Txt variant="title1" align="center">
              HiSweetie POS
            </Txt>
            <Txt variant="body" color={C.secondary} align="center">
              Lên đơn, xem công nợ và báo đơn ngay trên iPhone
            </Txt>
          </View>

          <View style={styles.bottom}>
            {notice && !error ? <Banner tone="info" icon="info.circle.fill" title={notice} /> : null}
            {error ? <Banner tone="danger" title={error} /> : null}

            {mode === 'lark' ? (
              <>
                <Button
                  title="Đăng nhập bằng Lark"
                  icon="person.badge.key.fill"
                  onPress={loginLark}
                  loading={busy === 'lark'}
                  disabled={busy !== null}
                />
                <Button
                  title="Đăng nhập bằng email và mật khẩu"
                  variant="plain"
                  size="medium"
                  onPress={() => {
                    setError(null);
                    setMode('password');
                  }}
                  disabled={busy !== null}
                />
                <Txt variant="footnote" color={C.secondary} align="center" style={styles.hint}>
                  Dùng tài khoản Lark của công ty. Đăng nhập ngay trên trang Lark vừa mở, không chọn mở
                  ứng dụng Lark.
                </Txt>
              </>
            ) : (
              <>
                <View style={styles.form}>
                  <View style={styles.field}>
                    <Txt style={styles.fieldLabel}>Email</Txt>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="ten@hisweetie.vn"
                      placeholderTextColor={C.tertiary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      textContentType="username"
                      autoComplete="email"
                      returnKeyType="next"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.separator} />
                  <View style={styles.field}>
                    <Txt style={styles.fieldLabel}>Mật khẩu</Txt>
                    <TextInput
                      ref={passwordRef}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Bắt buộc"
                      placeholderTextColor={C.tertiary}
                      secureTextEntry
                      textContentType="password"
                      autoComplete="current-password"
                      returnKeyType="go"
                      onSubmitEditing={loginPassword}
                      style={styles.input}
                    />
                  </View>
                </View>
                <Button
                  title="Đăng nhập"
                  onPress={loginPassword}
                  loading={busy === 'password'}
                  disabled={busy !== null}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setError(null);
                    setMode('lark');
                  }}
                  style={styles.back}>
                  <Txt color={C.tint}>Đăng nhập bằng Lark</Txt>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.plainBg },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 },
  brand: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 40 },
  bottom: { gap: 12 },
  hint: { marginTop: 4, paddingHorizontal: 8 },
  form: { backgroundColor: C.fill, borderRadius: 12, overflow: 'hidden' },
  field: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 16, gap: 12 },
  fieldLabel: { width: 82 },
  input: { flex: 1, fontSize: 17, color: C.label, paddingVertical: 12 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginLeft: 16 },
  back: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
});
