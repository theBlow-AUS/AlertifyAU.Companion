import React from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useCompanion } from '@/contexts/CompanionContext';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/colors';
import { Button, reportError, ui } from '@/components/BrandUI';

export function WatchAddresses() {
  const c = useColors();
  const { settings, saveSettings } = useCompanion();
  return <View style={{ gap: 12 }}>
    <View style={ui.spread}><Text style={ui.h2}>Watch addresses</Text><Text style={ui.small}>{settings.watches.filter(w => w.enabled).length} enabled</Text></View>
    {settings.watches.map(w => <View key={w.id} style={[ui.card, { borderColor: w.id === settings.activeWatchId ? c.primary : c.border }]}>
      <View style={ui.spread}>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${w.label}`} onPress={() => void saveSettings({ activeWatchId: w.id }).catch(reportError)} style={{ flex: 1, gap: 5 }} testID={`view-watch-${w.id}`}>
          <View style={ui.row}><Feather name="map-pin" size={18} color={c.success} /><Text style={ui.h2}>{w.label}</Text>{w.id === settings.activeWatchId && <Text style={[ui.small, { color: c.primary }]}>Viewing</Text>}</View>
          <Text style={ui.small}>{w.place.name}</Text>
          <Text style={ui.small}>{w.radius} km · Fire danger matched from this pin</Text>
        </Pressable>
        <Switch value={w.enabled} accessibilityLabel={`Monitor ${w.label}`} onValueChange={enabled => void saveSettings(current => ({ watches: current.watches.map(item => item.id === w.id ? { ...item, enabled } : item) })).catch(reportError)} trackColor={{ true: c.success, false: c.border }} />
      </View>
      <Pressable accessibilityLabel={`Edit ${w.label}`} onPress={() => router.push({ pathname: '/place', params: { id: w.id } })} style={{ paddingVertical: 7 }}><Text style={{ color: c.primary, fontFamily: fonts.bold, fontSize: 12 }}>Edit name, address or radius →</Text></Pressable>
    </View>)}
    <Button title="Add watch address" icon="plus" secondary onPress={() => router.push('/place')} testID="add-watch" />
    <Text style={ui.small}>Viewing an address changes this dashboard only. RFS alert checks include every enabled address while Home Watch is on.</Text>
  </View>;
}
