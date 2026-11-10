import { describe, expect, it } from '@jest/globals';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { previewWebViewProps } from '../preview';

describe('print preview WebView', () => {
  it('uses software rendering for Android without changing the iOS rendering layer', () => {
    expect(previewWebViewProps('android').androidLayerType).toBe('software');
    expect(previewWebViewProps('ios').androidLayerType).toBeUndefined();
  });

  it('disables Android file access and new windows', () => {
    expect(previewWebViewProps('android')).toMatchObject({
      setSupportMultipleWindows: false,
      javaScriptCanOpenWindowsAutomatically: false,
      allowFileAccess: false,
      allowFileAccessFromFileURLs: false,
      allowUniversalAccessFromFileURLs: false,
      mixedContentMode: 'never',
    });
  });

  it.each(['ios', 'android'])('only permits the inline document on %s', (platform) => {
    const props = previewWebViewProps(platform);
    expect(props.originWhitelist).toEqual(['about:blank']);
    const allows = (url: string) => props.onShouldStartLoadWithRequest?.({ url } as ShouldStartLoadRequest);
    expect(allows('about:blank')).toBe(true);
    expect(allows('https://example.com')).toBe(false);
    expect(allows('file:///data/local/private')).toBe(false);
    expect(allows('intent://example')).toBe(false);
  });

  it('preserves iOS preview protections', () => {
    expect(previewWebViewProps('ios')).toMatchObject({
      dataDetectorTypes: 'none',
      allowsLinkPreview: false,
    });
  });
});
