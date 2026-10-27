import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Header } from '@/components/BrandUI';
import LiveMapPane from '@/components/LiveMapPane';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/colors';

export default function LiveMap() {
  const c = useColors();
  const [reloadKey, setReloadKey] = useState(0);

  return <View style={{ flex: 1, backgroundColor: c.background }}>
    <Header />
    <View style={{ minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: c.foreground }}>Live Map</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: c.mutedForeground }}>Alertify.au · NSW incidents and warnings</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Reload live map" onPress={() => setReloadKey(key => key + 1)} style={{ padding: 11, borderRadius: 13, backgroundColor: c.secondary }}>
        <Feather name="refresh-cw" size={18} color={c.secondaryForeground} />
      </Pressable>
      <Pressable accessibilityRole="link" accessibilityLabel="Open Alertify in browser" onPress={() => void Linking.openURL('https://alertify.au/')} style={{ padding: 11, borderRadius: 13, backgroundColor: c.secondary }}>
        <Feather name="external-link" size={18} color={c.secondaryForeground} />
      </Pressable>
    </View>
    <LiveMapPane reloadKey={reloadKey} />
  </View>;
}
