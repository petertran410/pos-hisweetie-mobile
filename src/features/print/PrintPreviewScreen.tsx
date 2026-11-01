import { useQuery } from '@tanstack/react-query';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams } from 'expo-router';
import { createElement, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { WebView } from 'react-native-webview';
import { errorMessage } from '@/core/http';
import { Button, C, ErrorState, SheetHeader, toast, Txt } from '@/ui';
import {
  choosePrinter,
  loadPrinter,
  makePrintPdf,
  pageCssWidth,
  printDocument,
  printToPrinter,
  renameTemp,
  renderPrint,
  type PrintKind,
  type RenderedPrint,
  type SavedPrinter,
} from './print';

const TITLE: Record<PrintKind, string> = { invoice: 'Hóa đơn', order: 'Phiếu đặt hàng' };

/** Hỏi gửi dạng ảnh hay PDF (bảng chọn của iOS). */
function askSendFormat(onPick: (format: 'image' | 'pdf') => void) {
  const options = ['Gửi ảnh', 'Gửi file PDF', 'Hủy'];
  const message = 'Ảnh hiện thẳng trong khung chat; PDF giữ đúng khổ giấy để in lại.';
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Gửi phiếu', message, options, cancelButtonIndex: 2 },
      (i) => {
        if (i === 0) onPick('image');
        if (i === 1) onPick('pdf');
      },
    );
    return;
  }
  Alert.alert('Gửi phiếu', message, [
    { text: options[0], onPress: () => onPick('image') },
    { text: options[1], onPress: () => onPick('pdf') },
    { text: options[2], style: 'cancel' },
  ]);
}

export function PrintPreviewView({
  title,
  html,
  pageWidth,
  loading,
  error,
  onRetry,
  printing,
  sending,
  onPrint,
  onChangePrinter,
  onSendPdf,
  onSendImage,
}: {
  title: string;
  /** Trang HTML bản màn hình (`printDocument(r, { screen: true })`). */
  html?: string | null;
  /** Bề ngang tờ giấy theo px CSS. */
  pageWidth: number;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  printing?: boolean;
  sending?: boolean;
  onPrint: () => void;
  /** Giữ lâu nút "In ngay": chọn máy in khác. */
  onChangePrinter: () => void;
  onSendPdf: () => void;
  onSendImage: (imageUri: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const shotRef = useRef<ComponentRef<typeof View>>(null);
  const webRef = useRef<ComponentRef<typeof WebView>>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [docHeight, setDocHeight] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const fitted = useRef<(() => void) | null>(null);

  // Tờ phiếu thu nhỏ vừa bề ngang màn hình; khung cao vừa khít nội dung.
  const scale = area.width && pageWidth ? area.width / pageWidth : 1;
  const contentHeight = docHeight * scale;
  const boxHeight = docHeight ? Math.min(area.height, contentHeight) : area.height;
  const ready = !loading && !error && !!html;

  const captureImage = async (): Promise<string | null> => {
    if (Platform.OS === 'web' || !shotRef.current || !webRef.current) {
      toast.info('Bản xem thử trên trình duyệt không chụp được ảnh');
      return null;
    }
    // Trang tự đo lại và thu cả tờ phiếu vừa khung, báo "fitted" rồi mới chụp.
    await new Promise<void>((resolve) => {
      fitted.current = resolve;
      webRef.current?.injectJavaScript('window.__hsFit && window.__hsFit(); true;');
      setTimeout(resolve, 1000);
    });
    fitted.current = null;
    try {
      return await captureRef(shotRef, { format: 'png', result: 'tmpfile' });
    } finally {
      webRef.current?.injectJavaScript('window.__hsUnfit && window.__hsUnfit(); true;');
    }
  };

  const send = () =>
    askSendFormat(async (format) => {
      if (format === 'pdf') return onSendPdf();
      setCapturing(true);
      try {
        const uri = await captureImage();
        if (uri) onSendImage(uri);
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setCapturing(false);
      }
    });

  return (
    <View style={{ flex: 1, backgroundColor: '#E9EEF2' }}>
      <SheetHeader title={title} cancelLabel="Đóng" />
      <View
        style={styles.paperWrap}
        onLayout={(e) => setArea({ width: e.nativeEvent.layout.width - 32, height: e.nativeEvent.layout.height - 32 })}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.brand} />
            <Txt variant="label" color={C.muted}>
              Đang tạo phiếu…
            </Txt>
          </View>
        ) : error ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : html && area.width > 0 ? (
          <View style={[styles.paper, { height: boxHeight }]}>
            <View ref={shotRef} collapsable={false} style={styles.shot}>
              {Platform.OS === 'web' ? (
                createElement('iframe', {
                  srcDoc: html,
                  title: 'Bản xem trước phiếu',
                  sandbox: '',
                  style: { width: '100%', height: '100%', border: 0, background: '#fff' },
                })
              ) : (
                <WebView
                  ref={webRef}
                  source={{ html }}
                  originWhitelist={['about:blank']}
                  // Chỉ hiện đúng phiếu, không cho mở trang/đường dẫn nào khác.
                  onShouldStartLoadWithRequest={(req) => req.url === 'about:blank'}
                  dataDetectorTypes="none"
                  allowsLinkPreview={false}
                  javaScriptCanOpenWindowsAutomatically={false}
                  onMessage={(e) => {
                    try {
                      const msg = JSON.parse(e.nativeEvent.data) as { type?: string; height?: number };
                      if (msg.type === 'fitted') fitted.current?.();
                      else if (msg.height && msg.height > 0) setDocHeight(msg.height);
                    } catch {
                      // bỏ qua tin nhắn lạ
                    }
                  }}
                  style={{ flex: 1, backgroundColor: C.white }}
                />
              )}
            </View>
          </View>
        ) : null}
      </View>

      <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.actions}>
          <Button
            title="Gửi"
            icon="share-2"
            variant="outline"
            onPress={send}
            loading={sending || capturing}
            disabled={!ready}
            style={{ flex: 1 }}
          />
          <Button
            title="In ngay"
            icon="printer"
            onPress={onPrint}
            onLongPress={Platform.OS === 'ios' ? onChangePrinter : undefined}
            accessibilityHint="Giữ lâu để đổi máy in"
            loading={printing}
            disabled={!ready}
            style={{ flex: 1.3 }}
          />
        </View>
      </View>
    </View>
  );
}

/** Xem trước phiếu rồi in thẳng tới máy in đã chọn, hoặc gửi ảnh / PDF (Zalo, AirDrop...). */
export default function PrintPreviewScreen() {
  const params = useLocalSearchParams<{ kind: string; id: string; code?: string }>();
  const kind: PrintKind = params.kind === 'invoice' ? 'invoice' : 'order';
  const id = Number(params.id);
  const code = params.code || `${kind}-${id}`;
  const [printer, setPrinter] = useState<SavedPrinter | null>(null);
  const [printing, setPrinting] = useState(false);
  const [sending, setSending] = useState(false);
  const pdfRef = useRef<{ key: RenderedPrint; uri: Promise<string> } | null>(null);

  useEffect(() => {
    void loadPrinter().then(setPrinter);
  }, []);

  const doc = useQuery({
    queryKey: ['print-preview', kind, id],
    enabled: Number.isFinite(id) && id > 0,
    queryFn: async () => {
      const rendered = await renderPrint(kind, id);
      return { rendered, html: printDocument(rendered, { screen: true }) };
    },
    gcTime: 0,
    retry: false,
  });

  /** PDF chỉ dựng khi cần (in hoặc gửi PDF), dùng lại cho các lần sau. */
  const getPdf = (): Promise<string> | null => {
    const rendered = doc.data?.rendered;
    if (!rendered) return null;
    if (pdfRef.current?.key !== rendered) pdfRef.current = { key: rendered, uri: makePrintPdf(rendered, code) };
    return pdfRef.current.uri;
  };

  const pick = async () => {
    const p = await choosePrinter();
    if (p) setPrinter(p);
    return p;
  };

  /** In tới máy in đã nhớ (chưa có thì chọn); lỗi thì hỏi chọn máy in khác. */
  const print = async (current: SavedPrinter | null) => {
    const target = current ?? (await pick());
    if (!target) return;
    setPrinting(true);
    try {
      const pdf = await getPdf();
      if (!pdf) return;
      await printToPrinter(pdf, target);
      toast.success(`Đã gửi lệnh in tới ${target.name}`);
    } catch {
      Alert.alert(
        'Không in được',
        `Không gửi được tới “${target.name}”. Kiểm tra máy in đã bật và cùng Wi-Fi với iPhone.`,
        [
          { text: 'Đóng', style: 'cancel' },
          {
            text: 'Chọn máy in khác',
            onPress: async () => {
              const other = await pick();
              if (other) void print(other);
            },
          },
        ],
      );
    } finally {
      setPrinting(false);
    }
  };

  const share = async (uri: string, mimeType: string, UTI: string) => {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Máy này không hỗ trợ chia sẻ file');
    await Sharing.shareAsync(uri, { mimeType, UTI, dialogTitle: code });
  };

  return (
    <PrintPreviewView
      title={TITLE[kind]}
      html={doc.data?.html}
      pageWidth={doc.data ? pageCssWidth(doc.data.rendered.paperSize, doc.data.rendered.landscape) : 559}
      loading={doc.isLoading}
      error={doc.isError ? doc.error : undefined}
      onRetry={() => void doc.refetch()}
      printing={printing}
      sending={sending}
      onChangePrinter={async () => {
        const p = await pick();
        if (p) toast.success(`Đã chọn máy in ${p.name}`);
      }}
      onPrint={() => void print(printer)}
      onSendPdf={async () => {
        setSending(true);
        try {
          const pdf = await getPdf();
          if (pdf) await share(pdf, 'application/pdf', 'com.adobe.pdf');
        } catch (e) {
          toast.error(errorMessage(e));
        } finally {
          setSending(false);
        }
      }}
      onSendImage={async (imageUri) => {
        setSending(true);
        try {
          await share(await renameTemp(imageUri, code, 'png'), 'image/png', 'public.png');
        } catch (e) {
          toast.error(errorMessage(e));
        } finally {
          setSending(false);
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  paperWrap: { flex: 1, padding: 16, alignItems: 'stretch' },
  paper: {
    borderRadius: 10,
    backgroundColor: C.white,
    shadowColor: '#0F3A42',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  shot: { flex: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: C.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  panel: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: C.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  actions: { flexDirection: 'row', gap: 10 },
});
