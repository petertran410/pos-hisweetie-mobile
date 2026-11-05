import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './icons';
import { PressableScale } from './motion';
import { Txt } from './Text';
import { C } from './theme';
import { mediaUri } from '@/core/config';

/**
 * Xem ảnh toàn màn hình: vuốt ngang để đổi ảnh, chụm 2 ngón để phóng to
 * (iOS), bấm X để đóng.
 */
export function ImageViewer({
  images,
  start,
  visible,
  onClose,
}: {
  images: string[];
  start: number;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      {visible ? <ViewerBody images={images} start={start} onClose={onClose} /> : null}
    </Modal>
  );
}

function ViewerBody({ images, start, onClose }: { images: string[]; start: number; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(start);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: start * width, y: 0 }}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {images.map((uri, i) => (
          // Mỗi ảnh nằm trong 1 ScrollView riêng để chụm phóng to.
          <ScrollView
            key={uri}
            style={{ width, height }}
            contentContainerStyle={{ width, height }}
            minimumZoomScale={1}
            maximumZoomScale={4}
            centerContent
            bouncesZoom
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            accessibilityLabel={`Ảnh ${i + 1} trên ${images.length}`}>
            <Image source={{ uri: mediaUri(uri) }} style={{ width, height }} contentFit="contain" transition={150} />
          </ScrollView>
        ))}
      </ScrollView>

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        {images.length > 1 ? (
          <View style={styles.counter}>
            <Txt variant="label" weight="semibold" color={C.white} numeric>
              {index + 1}/{images.length}
            </Txt>
          </View>
        ) : (
          <View />
        )}
        <PressableScale onPress={onClose} accessibilityLabel="Đóng ảnh" hitSlop={10} scaleTo={0.88} style={styles.close}>
          <Icon name="x" size={22} color={C.white} strokeWidth={2.4} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  counter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
