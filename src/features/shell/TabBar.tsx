import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, Icon, shadow, Txt, type IconName } from '@/ui';
import { easeOut, PressableScale } from '@/ui/motion';
import { useTabs, type TabDef } from './tabs';

interface Item {
  name: string;
  label: string;
  icon: IconName;
}

const INDICATOR = 28;

/** Một ô tab: icon phóng nhẹ rồi trở lại khi được chọn (êm, không nảy). */
function TabItem({ item, focused, onPress }: { item: Item; focused: boolean; onPress: () => void }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (focused)
      scale.set(withSequence(withTiming(1.12, { duration: 140, easing: easeOut }), withTiming(1, { duration: 180, easing: easeOut })));
  }, [focused, scale]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const color = focused ? C.brand : C.muted;
  return (
    <PressableScale
      onPress={onPress}
      haptic={focused ? undefined : 'selection'}
      scaleTo={0.9}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={item.label}
      style={styles.item}>
      <Animated.View style={iconStyle}>
        <Icon name={item.icon} size={23} color={color} strokeWidth={focused ? 2.2 : 1.8} />
      </Animated.View>
      <Txt variant="caption" weight={focused ? 'semibold' : 'medium'} color={color} numberOfLines={1}>
        {item.label}
      </Txt>
    </PressableScale>
  );
}

/**
 * Thanh tab tự vẽ: nền trắng, icon + nhãn, vạch chỉ báo trượt tới tab đang
 * chọn. Chỉ hiện tab người dùng có quyền.
 */
export function TabBar({
  state,
  emitter,
  navigateToTab,
  tabs,
}: BottomTabBarProps & {
  /** Chỉ dùng cho trang xem trước: danh sách tab cố định thay vì theo quyền. */
  tabs?: TabDef[];
}) {
  const insets = useSafeAreaInsets();
  const fromSession = useTabs().visible;
  const visible = tabs ?? fromSession;
  const items: Item[] = [
    ...visible.map((t) => ({ name: t.key, label: t.label, icon: t.icon })),
    { name: 'them', label: 'Thêm', icon: 'layout-grid' },
  ];
  // Tab dồn vào "Thêm" (vd Báo đơn) đang mở thì sáng ô "Thêm".
  const routeName = state.routes[state.index]?.name;
  const activeName = items.some((i) => i.name === routeName) ? routeName : 'them';
  const activeIndex = Math.max(0, items.findIndex((i) => i.name === activeName));

  const [rowWidth, setRowWidth] = useState(0);
  const slot = items.length ? rowWidth / items.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    if (slot > 0) x.set(withTiming(activeIndex * slot + (slot - INDICATOR) / 2, { duration: 260, easing: easeOut }));
  }, [activeIndex, slot, x]);
  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      <View style={styles.row} onLayout={(e: LayoutChangeEvent) => setRowWidth(e.nativeEvent.layout.width)}>
        {slot > 0 ? <Animated.View style={[styles.indicator, indicatorStyle]} /> : null}
        {items.map((item) => {
          const route = state.routes.find((r) => r.name === item.name);
          if (!route) return null;
          const focused = activeName === item.name;
          return (
            <TabItem
              key={item.name}
              item={item}
              focused={focused}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    paddingHorizontal: 6,
    ...shadow,
    shadowOffset: { width: 0, height: -2 },
  },
  row: { flexDirection: 'row' },
  item: { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 4, gap: 3, minHeight: 56 },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: INDICATOR,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.brand,
  },
});
