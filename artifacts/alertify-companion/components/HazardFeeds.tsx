import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCompanion } from '@/contexts/CompanionContext';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/colors';
import { Button, Notice, ui } from '@/components/BrandUI';

export function HazardFeeds() {
  const { feeds, settings } = useCompanion();
  const c = useColors();
  const [expanded, setExpanded] = useState(false);
  return <View style={{ gap: 12 }}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="More feeds from Alertify"
      accessibilityState={{ expanded }}
      onPress={() => setExpanded(value => !value)}
      style={[ui.card, { paddingVertical: 14 }]}
    >
      <View style={ui.spread}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={ui.h2}>More feeds from Alertify</Text>
          <Text style={ui.small}>NSW hazard and weather sources</Text>
        </View>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={19} color={c.mutedForeground} />
      </View>
    </Pressable>
    {expanded && <View style={{ gap: 12 }}>
    {feeds.isPending && <Text style={ui.small}>Loading hazards and warnings…</Text>}
    {feeds.isError && <><Notice error>Alertify hazard feeds could not be refreshed. Previously loaded reports may be out of date.</Notice><Button title="Retry feeds" secondary onPress={() => void feeds.refetch()} /></>}
    {feeds.data?.sources.map(source => <Pressable key={source.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/(tabs)/updates', params: { source: source.id } })} style={ui.card}>
      <View style={ui.spread}><Text style={[ui.h2, { flex: 1 }]}>{source.name}</Text><View style={ui.row}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: source.status === 'live' ? c.success : c.warning }}>{source.status.toUpperCase()}</Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: settings.notifications && settings.alertHazards[source.id] ? c.success : c.mutedForeground }}>{settings.notifications && settings.alertHazards[source.id] ? 'PHONE ALERT ON' : settings.alertHazards[source.id] ? 'SELECTED' : 'BROWSE ONLY'}</Text>
      </View></View>
      <Text style={ui.small}>{source.status === 'unavailable' ? source.error || 'Source unavailable—not an all-clear.' : `${source.reports.length} statewide reports · tap to view in app`}</Text>
    </Pressable>)}
    <Text style={ui.small}>Switch alert sources in Watch preferences. Feeds remain viewable here when alerts are off. An unavailable source is not an all-clear.</Text>
    </View>}
  </View>;
}
