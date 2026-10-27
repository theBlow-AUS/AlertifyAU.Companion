import React from 'react';
import { Text, View } from 'react-native';
import colors, { fonts } from '@/constants/colors';

// Generic resolver fallback; Metro uses LiveMapPane.native.tsx or .web.tsx.
export default function LiveMapPane({ reloadKey: _reloadKey }: { reloadKey: number }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.background }}>
    <Text style={{ color: colors.light.mutedForeground, fontFamily: fonts.regular }}>Live Map is not available on this platform.</Text>
  </View>;
}
