import type { WebViewProps } from 'react-native-webview';

/** Keep the document local; do not hand links or new windows to other apps. */
export function previewWebViewProps(platform: string): WebViewProps {
  return {
    originWhitelist: ['about:blank'],
    onShouldStartLoadWithRequest: (request) => request.url === 'about:blank',
    javaScriptCanOpenWindowsAutomatically: false,
    ...(platform === 'android'
      ? {
          // The preview sits inside an animated native-stack modal.
          androidLayerType: 'software' as const,
          setSupportMultipleWindows: false,
          allowFileAccess: false,
          allowFileAccessFromFileURLs: false,
          allowUniversalAccessFromFileURLs: false,
          mixedContentMode: 'never' as const,
        }
      : { dataDetectorTypes: 'none' as const, allowsLinkPreview: false }),
  };
}
