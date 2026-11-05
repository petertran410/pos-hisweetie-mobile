import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';
import type { PickedFile } from './draft';

/** Chụp ảnh bằng camera (hỏi quyền trước; đã từ chối thì chỉ đường mở Cài đặt). */
export async function takePhoto(purpose = 'chụp ảnh chứng từ'): Promise<PickedFile[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Chưa có quyền camera', `Bật quyền camera cho app trong Cài đặt để ${purpose}.`, [
      { text: 'Để sau', style: 'cancel' },
      { text: 'Mở Cài đặt', onPress: () => void Linking.openSettings() },
    ]);
    return [];
  }
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });
  if (res.canceled) return [];
  return res.assets.map((a) => ({ uri: a.uri, name: a.fileName ?? 'Ảnh chụp', type: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? null, width: a.width, height: a.height }));
}

/** Chọn nhiều ảnh có sẵn trong máy (tối đa `limit`). */
export async function pickPhotos(limit: number): Promise<PickedFile[]> {
  if (limit <= 0) return [];
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    orderedSelection: true,
    quality: 0.9,
    exif: false,
  });
  if (res.canceled) return [];
  return res.assets
    .slice(0, limit)
    .map((a) => ({ uri: a.uri, name: a.fileName ?? 'Ảnh', type: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? null, width: a.width, height: a.height }));
}

/** Chọn tệp (PDF, ảnh…) trong Tệp của iPhone. */
export async function pickDocuments(): Promise<PickedFile[]> {
  const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: '*/*' });
  if (res.canceled) return [];
  return res.assets.map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType ?? null, size: a.size ?? null }));
}
