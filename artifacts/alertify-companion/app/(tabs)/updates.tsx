import React, { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { useCompanion } from '@/contexts/CompanionContext';
import { IncidentRow, Notice, Screen, ui } from '@/components/BrandUI';
import { useColors } from '@/hooks/useColors';
import { distance, timeAgo } from '@/lib/model';
import { fonts } from '@/constants/colors';

export default function Updates() {
  const c = useColors();
  const { feed, settings, nearby, isStale } = useCompanion();
  const [scope, setScope] = useState<'home' | 'nsw'>(settings.home ? 'home' : 'nsw');
  const [search, setSearch] = useState('');
  const incidents = (scope === 'home' ? nearby : [...(feed.data?.incidents ?? [])].sort((a, b) => b.severity - a.severity))
    .filter(i => `${i.title} ${i.location} ${i.category} ${i.type}`.toLowerCase().includes(search.toLowerCase()));
  return <Screen refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => void feed.refetch()} />}>
    <View style={ui.content}>
      <View><Text style={ui.label}>The latest picture</Text><Text style={[ui.title, { marginTop: 6 }]}>Incident updates</Text></View>
      <Text style={ui.small}>Official NSW RFS incident reports. This is not a complete list of fires, floods, traffic incidents or severe weather.</Text>
      {isStale && <Notice error>{feed.data ? 'Saved data may be out of date. Pull down to refresh.' : 'Current incident information is not yet available.'}</Notice>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['home', 'nsw'] as const).map(value => <Pressable key={value} onPress={() => setScope(value)} style={{ padding: 13, borderRadius: 25, backgroundColor: scope === value ? c.header : c.secondary }} accessibilityRole="radio" accessibilityState={{ selected: scope === value }}><Text style={{ color: scope === value ? c.headerText : c.foreground, fontFamily: fonts.bold, fontSize: 12 }}>{value === 'home' ? 'Near home' : 'All NSW'}</Text></Pressable>)}
      </View>
      <TextInput accessibilityLabel="Search incident reports" placeholder="Search place, incident or warning…" placeholderTextColor={c.mutedForeground} style={ui.input} value={search} onChangeText={setSearch} autoCorrect={false} />
      <View style={[ui.card, { paddingVertical: 0 }]}>
        {feed.isPending && <ActivityIndicator color={c.primary} style={{ margin: 30 }} />}
        {incidents.map(i => <IncidentRow key={i.id} incident={i} subtitle={`${i.category} · ${settings.home ? `${distance(settings.home, i).toFixed(1)} km from home` : i.council || i.type}`} />)}
        {!feed.isPending && !incidents.length && <View style={{ paddingVertical: 24, gap: 8 }}><Text style={ui.h2}>{scope === 'home' && !settings.home ? 'Save your home first' : 'No matching reports'}</Text><Text style={ui.small}>{feed.isError ? 'The feed could not be loaded. Pull down to retry.' : 'Try a different search or view all NSW incidents.'}</Text></View>}
      </View>
      <Text style={ui.small}>{feed.data ? `Feed fetched ${timeAgo(feed.data.fetchedAt)}. Incident timestamps are supplied by NSW RFS.` : 'Source: NSW Rural Fire Service'}</Text>
    </View>
  </Screen>;
}
