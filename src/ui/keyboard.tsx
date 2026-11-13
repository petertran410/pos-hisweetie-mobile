import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from './theme';

/**
 * Chiều cao bàn phím đang mở trên Android (không tính thanh điều hướng),
 * 0 khi đóng. Luôn 0 trên iOS và web.
 */
export function useAndroidKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/**
 * Android vẽ app tràn viền nên bàn phím chỉ đè lên app, không đẩy nội dung lên
 * (khác iOS, nơi các ScrollView tự chừa chỗ). Bọc toàn app: khi bàn phím mở thì
 * thu app lại phía trên bàn phím, các ScrollView tự cuộn ô đang gõ lên cho thấy
 * và vẫn cuộn được tới cuối.
 */
export function KeyboardResize({ children }: { children: ReactNode }) {
  const keyboard = useAndroidKeyboardHeight();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingBottom: keyboard > 0 ? keyboard + insets.bottom : 0 }}>
      {children}
    </View>
  );
}
