import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { makeMutable, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { create } from 'zustand';
import { easeOut } from '@/ui/motion';
import { DIM, EDGE_WIDTH, PARALLAX, settleDuration, shouldGoBack } from './backSwipe';
import { revealTab } from './tabTransition';

/** Lượt vuốt đang diễn ra (chung cho mọi tab, chạy trên luồng giao diện). */
const swipeX = makeMutable(0);
const swipeFrom = makeMutable('');
const swipeTo = makeMutable('');

/** Tab đang hiện sẵn bên dưới lúc vuốt: nội dung của nó hiện nguyên, không chạy hiệu ứng hiện dần. */
export const useSwipePeek = create<{ name: string | null }>(() => ({ name: null }));

function peekTab(name: string | null) {
  revealTab(name);
  useSwipePeek.setState({ name });
}

/** Kết thúc lượt vuốt: mọi tab về vị trí và trạng thái thường. */
function endSwipe() {
  swipeX.set(0);
  swipeFrom.set('');
  swipeTo.set('');
  peekTab(null);
}

/** Đợi hiệu ứng chuyển tab (280ms) xong mới thả trạng thái vuốt, để không bị giật. */
const AFTER_SWITCH_MS = 360;

/**
 * Bọc ngăn xếp màn của một tab. Ở trang đầu, vuốt từ mép trái: trang đi theo
 * ngón tay, tab `prevName` hiện bên dưới (lệch trái, hơi tối) và trượt vào.
 * Thả đủ xa / đủ nhanh thì trượt nốt rồi gọi `onBack`, không thì trượt về chỗ cũ.
 */
export function EdgeBack({
  name,
  prevName,
  enabled,
  onBack,
  children,
}: {
  name: string;
  prevName: string | null;
  enabled: boolean;
  onBack: () => void;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const onBackRef = useRef(onBack);
  useLayoutEffect(() => {
    onBackRef.current = onBack;
  });
  const finish = useCallback((done: boolean) => {
    if (!done) return endSwipe();
    onBackRef.current();
    setTimeout(endSwipe, AFTER_SWITCH_MS);
  }, []);

  const pan = usePanGesture({
    enabled,
    hitSlop: { left: 0, width: EDGE_WIDTH },
    activeOffsetX: 12,
    failOffsetY: [-12, 12],
    onBegin: () => {
      'worklet';
      // Chạm vào mép: cho tab trước hiện sẵn bên dưới (vẫn bị trang này che).
      if (prevName) scheduleOnRN(peekTab, prevName);
    },
    onActivate: () => {
      'worklet';
      swipeX.set(0);
      swipeFrom.set(name);
      swipeTo.set(prevName ?? '');
    },
    onUpdate: (e) => {
      'worklet';
      swipeX.set(Math.min(width, Math.max(0, e.translationX)));
    },
    onDeactivate: (e) => {
      'worklet';
      const done = !e.canceled && shouldGoBack(e.translationX, e.velocityX, width);
      swipeX.set(
        withTiming(done ? width : 0, { duration: settleDuration(swipeX.get(), width, done), easing: easeOut }, (finished) => {
          if (finished) scheduleOnRN(finish, done);
        }),
      );
    },
    onFinalize: () => {
      'worklet';
      // Chạm mà không vuốt: ẩn lại tab bên dưới.
      if (swipeFrom.get() !== name) scheduleOnRN(endSwipe);
    },
  });

  const moving = useAnimatedStyle(() => {
    const x = swipeX.get();
    if (swipeFrom.get() === name) return { transform: [{ translateX: x }] };
    if (swipeTo.get() === name) return { transform: [{ translateX: (x - width) * PARALLAX }] };
    return { transform: [{ translateX: 0 }] };
  });
  const dim = useAnimatedStyle(() => ({
    opacity: swipeTo.get() === name && width > 0 ? DIM * (1 - swipeX.get() / width) : 0,
  }));
  const shade = useAnimatedStyle(() => ({ opacity: swipeFrom.get() === name && swipeX.get() > 0 ? 1 : 0 }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.fill, moving]}>
        {children}
        <Animated.View style={[styles.dim, dim]} />
        <Animated.View style={[styles.shade, shade]}>
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  dim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#000', pointerEvents: 'none' },
  // Bóng mờ ở mép trái của trang đang kéo (như iOS).
  shade: { position: 'absolute', top: 0, bottom: 0, left: -14, width: 14, pointerEvents: 'none' },
});
