import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { errorMessage } from '@/core/http';
import { setupPassword } from '@/core/session';
import { Banner, Button, C, Card, IconBadge, Page, SubHeader, TextField, Txt } from '@/ui';

/** Lần đầu đăng nhập Lark: đặt mật khẩu để lúc cần có thể đăng nhập bằng email. */
export default function SetupPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);

  const submit = async () => {
    if (password.trim().length < 8) return setError('Mật khẩu phải có ít nhất 8 ký tự');
    if (password !== confirm) return setError('Mật khẩu xác nhận không khớp');
    if (!token) return setError('Phiên đặt mật khẩu không hợp lệ. Đăng nhập Lark lại.');
    setError(null);
    setBusy(true);
    try {
      await setupPassword(token, password, confirm);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  // Android: KeyboardResize ở gốc app đã thu màn lên trên bàn phím.
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Page stickyHeader header={<SubHeader title="Tạo mật khẩu" />}>
        <View style={styles.intro}>
          <IconBadge name="lock" color="teal" size={56} round />
          <Txt variant="body" color={C.muted} align="center">
            Lần đầu bạn đăng nhập bằng Lark. Đặt mật khẩu để đăng nhập bằng email khi không dùng được
            Lark.
          </Txt>
        </View>
        <Card style={styles.panel}>
          <TextField
            label="Mật khẩu mới"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            placeholder="Ít nhất 8 ký tự"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          <TextField
            ref={confirmRef}
            label="Nhập lại mật khẩu"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            textContentType="newPassword"
            placeholder="Nhập lại mật khẩu"
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          {error ? <Banner tone="danger" title={error} /> : null}
          <Button title="Lưu mật khẩu và đăng nhập" onPress={submit} loading={busy} />
          <Button title="Huỷ" variant="ghost" size="medium" onPress={() => router.back()} disabled={busy} />
        </Card>
      </Page>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 12 },
  panel: { padding: 18, gap: 14 },
});
