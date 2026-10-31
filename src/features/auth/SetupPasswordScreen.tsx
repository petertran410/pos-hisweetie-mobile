import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { errorMessage } from '@/core/http';
import { setupPassword } from '@/core/session';
import { Banner, Button, C, Screen, Section, Txt } from '@/ui';

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

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <View style={styles.intro}>
        <Txt variant="subhead" color={C.secondary}>
          Đây là lần đầu bạn đăng nhập bằng Lark. Đặt mật khẩu để đăng nhập bằng email khi không dùng
          được Lark.
        </Txt>
      </View>
      <Section footer="Ít nhất 8 ký tự.">
        <View style={styles.field}>
          <Txt style={styles.label}>Mật khẩu</Txt>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            placeholder="Mật khẩu mới"
            placeholderTextColor={C.tertiary}
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Txt style={styles.label}>Nhập lại</Txt>
          <TextInput
            ref={confirmRef}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            textContentType="newPassword"
            placeholder="Nhập lại mật khẩu"
            placeholderTextColor={C.tertiary}
            returnKeyType="done"
            onSubmitEditing={submit}
            style={styles.input}
          />
        </View>
      </Section>
      <View style={styles.actions}>
        {error ? <Banner tone="danger" title={error} /> : null}
        <Button title="Lưu mật khẩu và đăng nhập" onPress={submit} loading={busy} />
        <Button title="Huỷ" variant="plain" size="medium" onPress={() => router.back()} disabled={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: 32, paddingTop: 12 },
  field: { flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingHorizontal: 16, gap: 12 },
  label: { width: 90 },
  input: { flex: 1, fontSize: 17, color: C.label, paddingVertical: 12 },
  actions: { marginTop: 22, marginHorizontal: 16, gap: 10 },
});
