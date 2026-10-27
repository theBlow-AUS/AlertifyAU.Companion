import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import WebView from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import colors, { fonts } from '@/constants/colors';

const c = colors.light;
const SITE = 'https://alertify.au/';
const trustedHosts = new Set(['alertify.au', 'www.alertify.au']);
// react-native-webview 14's cross-platform prop intersection conflicts with
// the scaffold's React Native 0.88 typings; keep the cast at this library seam.
const NativeWebView: React.ComponentType<any> = WebView as any;

export default function LiveMapPane({ reloadKey }: { reloadKey: number }) {
  const webView = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(() => setFailed(true), 20000);
    return () => clearTimeout(timeout);
  }, [loading, reloadKey]);

  function allowNavigation(request: ShouldStartLoadRequest) {
    try {
      const target = new URL(request.url);
      if (target.protocol === 'https:' && trustedHosts.has(target.hostname)) return true;
      // Keep the companion's tab bar available when a user follows a link
      // to another site from within Alertify.
      if (target.protocol === 'https:' || target.protocol === 'mailto:' || target.protocol === 'tel:') {
        void Linking.openURL(request.url).catch(() => undefined);
      }
    } catch {
      // Malformed URLs and non-web schemes stay inside the WebView boundary.
    }
    return false;
  }

  function onError(_event: WebViewErrorEvent) {
    setLoading(false);
    setFailed(true);
  }

  return <View style={{ flex: 1, backgroundColor: c.background }}>
    <NativeWebView
      key={reloadKey}
      ref={webView}
      source={{ uri: SITE }}
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={allowNavigation}
      onLoadStart={() => { setLoading(true); setFailed(false); }}
      onLoadEnd={() => setLoading(false)}
      onError={onError}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="never"
      allowsBackForwardNavigationGestures
      setSupportMultipleWindows={false}
      style={{ flex: 1, backgroundColor: c.background }}
    />
    {loading && !failed && <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
      <ActivityIndicator color={c.primary} size="large" />
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.medium, fontSize: 13, marginTop: 12 }}>Loading Alertify live map…</Text>
    </View>}
    {failed && <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 13, backgroundColor: c.background }}>
      <Feather name="wifi-off" size={34} color={c.mutedForeground} />
      <Text style={{ color: c.foreground, fontFamily: fonts.bold, fontSize: 18 }}>The live map couldn’t load</Text>
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>The site may be taking too long to respond. Check your connection and try again, or open alertify.au in your browser.</Text>
      <Pressable accessibilityRole="button" onPress={() => webView.current?.reload()} style={{ paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, backgroundColor: c.primary }}>
        <Text style={{ color: c.primaryForeground, fontFamily: fonts.bold }}>Retry map</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(SITE)} style={{ padding: 10 }}>
        <Text style={{ color: c.primary, fontFamily: fonts.bold }}>Open in browser</Text>
      </Pressable>
    </View>}
  </View>;
}
