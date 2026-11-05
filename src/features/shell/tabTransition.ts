import { Animated, Easing } from 'react-native';
import type { BottomTabNavigationOptions } from 'expo-router/tabs';

/** 1 = tab này đang hiện sẵn bên dưới lúc vuốt về (xem EdgeBack). */
const reveal = new Map<string, Animated.Value>();

function revealValue(name: string): Animated.Value {
  let v = reveal.get(name);
  if (!v) {
    v = new Animated.Value(0);
    reveal.set(name, v);
  }
  return v;
}

/** Cho tab `name` hiện bên dưới tab đang xem (null: ẩn lại như thường). */
export function revealTab(name: string | null) {
  for (const [key, v] of reveal) v.setValue(key === name ? 1 : 0);
}

/**
 * Chuyển tab: trang mới trượt vào 40px theo hướng tab vừa chọn và mờ dần,
 * trang cũ trượt ra phía ngược lại. Êm, không nảy. Nền trong suốt để lúc vuốt
 * về thì thấy tab trước nằm bên dưới.
 */
export function tabTransitionFor(
  name: string,
): Pick<BottomTabNavigationOptions, 'animation' | 'transitionSpec' | 'sceneStyleInterpolator' | 'sceneStyle'> {
  const shown = revealValue(name);
  return {
    animation: 'shift',
    transitionSpec: { animation: 'timing', config: { duration: 280, easing: Easing.out(Easing.cubic) } },
    sceneStyle: { backgroundColor: 'transparent' },
    sceneStyleInterpolator: ({ current }) => ({
      sceneStyle: {
        opacity: Animated.add(current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }), shown).interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
          extrapolate: 'clamp',
        }),
        transform: [
          {
            translateX: Animated.multiply(
              current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-40, 0, 40] }),
              Animated.subtract(1, shown),
            ),
          },
        ],
      },
    }),
  };
}
