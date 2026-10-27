import React, { useState } from 'react';
import { Text, View } from 'react-native';
import WebView from 'react-native-webview';
import { radarHtml, type RadarProps } from './radar-html';
import { ui } from '@/components/BrandUI';
const NativeWebView = WebView as React.ComponentType<any>;
export default function RadarMap(props: RadarProps) {
  const [error, setError] = useState(false);
  return <View style={{ height: 400, borderRadius: 16, overflow: 'hidden' }}>
    {error ? <Text style={ui.small}>Radar could not load. Close and reopen it to retry.</Text> : <NativeWebView source={{ html: radarHtml(props) }} originWhitelist={['*']} javaScriptEnabled scrollEnabled={false} onError={() => setError(true)} onShouldStartLoadWithRequest={(request: { url: string }) => request.url === 'about:blank' || request.url.startsWith('about:srcdoc')} style={{ flex: 1 }} />}
  </View>;
}
