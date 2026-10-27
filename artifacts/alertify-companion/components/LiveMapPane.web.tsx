import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import colors, { fonts } from '@/constants/colors';

const c = colors.light;

export default function LiveMapPane({ reloadKey }: { reloadKey: number }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(() => { setLoading(false); setFailed(true); }, 12000);
    return () => clearTimeout(timeout);
  }, [loading, reloadKey]);
  return <View style={{ flex: 1, backgroundColor: c.background }}>
    {!failed && <iframe
      key={reloadKey}
      src="https://alertify.au/"
      title="Alertify live NSW emergency and incident map"
      allow="fullscreen"
      referrerPolicy="strict-origin-when-cross-origin"
      onLoad={() => setLoading(false)}
      onError={() => { setLoading(false); setFailed(true); }}
      style={{ flex: 1, width: '100%', height: '100%', border: 0, backgroundColor: c.background }}
    />}
    {loading && !failed && <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
      <ActivityIndicator color={c.primary} size="large" />
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.medium, fontSize: 13, marginTop: 12 }}>Loading Alertify live map…</Text>
    </View>}
    {failed && <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 }}>
      <Text style={{ color: c.foreground, fontFamily: fonts.bold, fontSize: 18 }}>The live map is taking too long</Text>
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center' }}>Try reloading, or open alertify.au in a new browser tab.</Text>
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://alertify.au/')} style={{ paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, backgroundColor: c.primary }}>
        <Text style={{ color: c.primaryForeground, fontFamily: fonts.bold }}>Open alertify.au</Text>
      </Pressable>
    </View>}
  </View>;
}
