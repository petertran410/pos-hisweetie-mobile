import * as Haptics from 'expo-haptics';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type AccessibilityRole,
  type LayoutChangeEvent,
  type AccessibilityState,
  type Insets,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { C } from './theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Lò xo cho phản hồi khi chạm: nhanh, gần như không nảy. */
export const springSnappy = { damping: 26, stiffness: 340, mass: 0.6 } as const;

/** Đường cong êm (nhanh lúc đầu, chậm dần), không vượt quá đích → không nảy. */
export const easeOut = Easing.out(Easing.cubic);

/**
 * Vùng bấm co nhẹ khi chạm và trở lại khi thả (phản hồi cho mọi thẻ, nút,
 * lối tắt). Có thể rung nhẹ khi bấm.
 */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled,
  style,
  scaleTo = 0.97,
  haptic,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  hitSlop,
  onLayout,
  accessibilityActions,
  onAccessibilityAction,
}: {
  children?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: 'light' | 'selection';
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  /** Nới vùng chạm: cùng một số cho 4 phía, hoặc riêng từng phía. */
  hitSlop?: number | Insets;
  onLayout?: (e: LayoutChangeEvent) => void;
  /** Thao tác phụ cho trình đọc màn hình (vd "Xem cảnh báo" trên thẻ có nút lồng bên trong). */
  accessibilityActions?: readonly AccessibilityActionInfo[];
  onAccessibilityAction?: (e: AccessibilityActionEvent) => void;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      onPress={() => {
        if (haptic === 'light') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (haptic === 'selection') void Haptics.selectionAsync();
        onPress?.();
      }}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      onLayout={onLayout}
      onPressIn={() => {
        scale.set(withSpring(scaleTo, springSnappy));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, springSnappy));
      }}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}

/**
 * Hiệu ứng hiện dần: mờ → rõ, trượt lên rất nhẹ (10px), êm, không nảy.
 * Bản web (chỉ để xem trước) chỉ mờ dần: Reanimated web đặt `position:
 * absolute` cho hiệu ứng có giá trị đầu tùy chỉnh, làm các khối chồng nhau.
 */
export function gentleEntering(index = 0) {
  const delay = Math.min(index, 6) * 60;
  if (Platform.OS === 'web') return FadeIn.delay(delay).duration(320).easing(easeOut);
  return FadeInDown.withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })
    .delay(delay)
    .duration(320)
    .easing(easeOut);
}

/**
 * Màn đang được xem (`active`), đã rời đi (`idle`, vd chuyển sang tab khác),
 * hay đang hiện sẵn bên dưới lúc vuốt về (`peek`: hiện nguyên như lúc rời đi,
 * không chạy hiệu ứng). Mặc định là đang xem; mỗi tab bọc nội dung bằng
 * `MotionScope` để hiệu ứng chạy lại mỗi lần quay về tab bằng thanh tab.
 */
export type ScreenMode = 'active' | 'peek' | 'idle';

const ScreenModeContext = createContext<ScreenMode>('active');

export function MotionScope({ active, peek = false, children }: { active: boolean; peek?: boolean; children?: ReactNode }) {
  return <ScreenModeContext value={peek ? 'peek' : active ? 'active' : 'idle'}>{children}</ScreenModeContext>;
}

export const useScreenMode = () => useContext(ScreenModeContext);

export const useScreenActive = () => useContext(ScreenModeContext) === 'active';

/** Rời màn: đợi màn trượt ra hết rồi mới đưa về trạng thái ẩn (người dùng không thấy). */
export const LEAVE_RESET_MS = 320;
export const resetAfterLeave = (to = 0) => withDelay(LEAVE_RESET_MS, withTiming(to, { duration: 0 }));

/**
 * Khối dữ liệu hiện dần (mờ → rõ, nhích lên 12px), nối tiếp nhau theo
 * `index`. Chạy khi màn mở và mỗi lần quay lại màn; không chạy khi cuộn.
 */
export function Appear({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const mode = useScreenMode();
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced || mode === 'peek') p.set(1);
    else if (mode === 'active') p.set(withDelay(Math.min(index, 6) * 60, withTiming(1, { duration: 340, easing: easeOut })));
    else p.set(resetAfterLeave());
  }, [mode, index, p, reduced]);
  const animated = useAnimatedStyle(() => ({
    opacity: p.get(),
    transform: [{ translateY: (1 - p.get()) * 12 }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

function SlideIn({
  dx,
  dy,
  animate,
  children,
  style,
}: {
  dx: number;
  dy: number;
  animate: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced || !animate ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(1, { duration: 300, easing: easeOut }));
  }, [p]);
  const animated = useAnimatedStyle(() => ({
    opacity: p.get(),
    transform: [{ translateX: (1 - p.get()) * dx }, { translateY: (1 - p.get()) * dy }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * Đổi nội dung (đổi loại danh sách, đổi kỳ, dữ liệu mới về): nội dung mới
 * hiện dần. `direction` 1/-1 thì trượt vào từ phải/trái (theo chip vừa chọn),
 * 0 thì nhích lên nhẹ. `skipFirst`: lần đầu hiện ngay (khi đã có hiệu ứng khác).
 */
export function FadeSwap({
  swapKey,
  direction = 0,
  skipFirst,
  children,
  style,
}: {
  swapKey: string;
  direction?: number;
  skipFirst?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const [seen, setSeen] = useState({ key: swapKey, swapped: false });
  if (seen.key !== swapKey) setSeen({ key: swapKey, swapped: true });
  return (
    <SlideIn
      key={swapKey}
      dx={direction * 36}
      dy={direction === 0 ? 10 : 0}
      animate={!skipFirst || seen.swapped}
      style={style}>
      {children}
    </SlideIn>
  );
}

/**
 * Hướng chuyển khi đổi tab/chip: chọn mục nằm bên phải thì 1, bên trái thì -1.
 * Cùng mục mà chỉ đổi `phase` (vd đang tải → có dữ liệu) thì 0.
 */
export function useSwapDirection<T>(value: T, order: readonly T[], phase = ''): number {
  const [last, setLast] = useState({ value, phase, dir: 0 });
  if (last.value !== value || last.phase !== phase) {
    const dir = last.value === value ? 0 : order.indexOf(value) > order.indexOf(last.value) ? 1 : -1;
    setLast({ value, phase, dir });
  }
  return last.dir;
}

/**
 * Nội dung theo tab/chip/bộ lọc: đổi mục thì nội dung mới trượt vào theo
 * hướng mục vừa chọn và mờ dần. Mọi màn có chip/tab dùng chung cái này.
 * `phase` đổi (vd tải xong) thì nội dung hiện dần tại chỗ.
 */
export function TabPanel<T extends string>({
  value,
  order,
  phase,
  children,
  style,
}: {
  value: T;
  order: readonly T[];
  phase?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const direction = useSwapDirection(value, order, phase);
  return (
    <FadeSwap swapKey={phase ? `${value}:${phase}` : value} direction={direction} style={style}>
      {children}
    </FadeSwap>
  );
}

/**
 * Số chạy từ giá trị cũ tới giá trị mới (doanh thu, số đơn) khi đổi kỳ,
 * và chạy lại từ 0 mỗi lần quay lại màn.
 * Tắt khi người dùng bật "Giảm chuyển động".
 */
export function useCountUp(value: number | undefined, duration = 650): number | undefined {
  const reduced = useReducedMotion();
  const mode = useScreenMode();
  // Lần đầu có số liệu: chạy từ 0 lên. Sau đó: chạy từ số đang hiện sang số mới.
  // Rời màn thì về 0 để lần quay lại số chạy lên lại. Hiện sẵn lúc vuốt về: hiện ngay số cuối.
  const [shown, setShown] = useState(0);
  const currentRef = useRef(0);

  useEffect(() => {
    if (value === undefined || reduced) return;
    if (mode === 'idle') {
      const timer = setTimeout(() => {
        currentRef.current = 0;
        setShown(0);
      }, LEAVE_RESET_MS);
      return () => clearTimeout(timer);
    }
    const from = currentRef.current;
    const start = Date.now();
    const span = mode === 'peek' ? 0 : duration;
    let frame = 0;
    const tick = () => {
      const t = span > 0 ? Math.min(1, (Date.now() - start) / span) : 1;
      const eased = 1 - Math.pow(1 - t, 3);
      const next = t < 1 ? from + (value - from) * eased : value;
      currentRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced, mode]);

  if (value === undefined) return undefined;
  return reduced ? value : shown;
}

/** Khối xám nhấp nháy nhẹ thay cho số liệu đang tải. */
export function Skeleton({
  width = '60%',
  height = 20,
  radius = 6,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useSharedValue(0.45);
  useEffect(() => {
    opacity.set(withRepeat(withSequence(withTiming(1, { duration: 650 }), withTiming(0.45, { duration: 650 })), -1));
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      accessibilityLabel="Đang tải"
      style={[{ width, height, borderRadius: radius, backgroundColor: C.divider }, animated, style]}
    />
  );
}

export { Animated };
