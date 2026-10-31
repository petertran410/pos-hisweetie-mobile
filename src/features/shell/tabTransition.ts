import { Easing } from 'react-native';
import type { BottomTabNavigationOptions } from 'expo-router/tabs';

/**
 * Chuyển tab: trang mới trượt vào 40px theo hướng tab vừa chọn và mờ dần,
 * trang cũ trượt ra phía ngược lại. Êm, không nảy.
 */
export const tabTransition: Pick<BottomTabNavigationOptions, 'animation' | 'transitionSpec' | 'sceneStyleInterpolator'> = {
  animation: 'shift',
  transitionSpec: { animation: 'timing', config: { duration: 280, easing: Easing.out(Easing.cubic) } },
  sceneStyleInterpolator: ({ current }) => ({
    sceneStyle: {
      opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
      transform: [
        { translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-40, 0, 40] }) },
      ],
    },
  }),
};
