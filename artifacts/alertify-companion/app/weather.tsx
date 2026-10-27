import React, { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useCompanion } from '@/contexts/CompanionContext';
import { useColors } from '@/hooks/useColors';
import { Screen, ui } from '@/components/BrandUI';
import { WeatherAssessment } from '@/components/weather/WeatherAssessment';

export default function Weather() {
  const { watch: watchParam } = useLocalSearchParams<{ watch?: string }>();
  const { settings, activeWatch, trip } = useCompanion();
  const c = useColors();
  const [selected, setSelected] = useState(watchParam || activeWatch?.id || (trip ? 'trip' : ''));
  useEffect(() => { if (watchParam) setSelected(watchParam); }, [watchParam]);
  const watch = settings.watches.find(w => w.id === selected) ?? (selected !== 'trip' ? activeWatch : null);
  return <Screen back><View style={ui.content}>
    <View><Text style={ui.label}>Watch zones & trips</Text><Text style={[ui.title, { marginTop: 6 }]}>Weather & radar</Text></View>
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {[...settings.watches.map(w => ({ id: w.id, label: w.label })), ...(trip ? [{ id: 'trip', label: 'Active trip' }] : [])].map(option => <Pressable accessibilityRole="radio" accessibilityState={{ selected: selected === option.id }} key={option.id} onPress={() => setSelected(option.id)} style={{ backgroundColor: selected === option.id ? c.header : c.secondary, padding: 12, borderRadius: 20, maxWidth: '100%' }}><Text style={{ color: selected === option.id ? c.headerText : c.foreground }}>{option.label}</Text></Pressable>)}
    </View>
    <WeatherAssessment key={selected} watch={watch} route={selected === 'trip' ? trip : null} detailed />
  </View></Screen>;
}
