import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCompanion } from '@/contexts/CompanionContext';
import { Button, Notice, Screen, ui } from '@/components/BrandUI';
import { useColors } from '@/hooks/useColors';
import { useWatchFeedData } from '@/hooks/useWatchFeedData';
import { alertHazardOptions, timeAgo } from '@/lib/model';
import { combineUpdates, selectUpdates, updateSources, type UpdateEntry, type UpdateSort } from '@/lib/unified-updates';
import { fonts } from '@/constants/colors';

const validSource = (value?: string) => updateSources.some(([id]) => id === value) ? value! : 'all';
export default function Updates() {
  const c = useColors();
  const { source: sourceParam } = useLocalSearchParams<{ source?: string }>();
  const { feed, feeds, settings, isStale } = useCompanion();
  const [selected, setSelected] = useState(validSource(sourceParam));
  const [scope, setScope] = useState<'home' | 'nsw'>(settings.watches.length ? 'home' : 'nsw');
  const [zone, setZone] = useState('all');
  const [sort, setSort] = useState<UpdateSort>(settings.watches.length ? 'distance' : 'latest');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [focused, setFocused] = useState(false);
  const [, tick] = useState(0);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => { setSelected(validSource(sourceParam)); }, [sourceParam]);
  useEffect(() => { setLimit(50); }, [selected, scope, zone, sort, search]);
  useEffect(() => { const timer = setInterval(() => tick(n => n + 1), 60000); return () => clearInterval(timer); }, []);
  const watches = zone === 'all' ? settings.watches : settings.watches.filter(w => w.id === zone);
  const showWeather = selected === 'all' || selected === 'weather';
  const showFire = selected === 'all' || selected === 'fireDanger';
  const watchData = useWatchFeedData(watches, showWeather && focused, showFire && focused);
  const entries = combineUpdates(feed.data?.incidents ?? [], feeds.data, watches, watchData.weather, watchData.districts);
  const results = selectUpdates(entries, watches, selected, scope, sort, search);
  const source = feeds.data?.sources.find(s => s.id === selected);
  const alertOption = alertHazardOptions.find(option => option.key === selected);
  const showRfs = selected === 'all' || selected === 'rfs';
  const showFeeds = selected !== 'rfs' && selected !== 'weather';
  const warnings = [...new Set([
    ...(showRfs && isStale ? ['NSW RFS is unavailable or retained data may be out of date.'] : []),
    ...(showFeeds && feeds.isError ? ['Alertify feeds could not be refreshed; retained reports may be out of date.'] : []),
    ...(feeds.data?.sources.filter(s => (selected === 'all' || s.id === selected) && s.status !== 'live').map(s => `${s.name}: ${s.status}. ${s.error ?? 'Not an all-clear.'}`) ?? []),
    ...(showFire && feeds.data && feeds.data.fireRatings.status !== 'live' ? [`Fire danger: ${feeds.data.fireRatings.status}. ${feeds.data.fireRatings.error ?? ''}`] : []),
    ...watchData.errors,
  ])];
  const unlocated = entries.filter(e => (selected === 'all' || e.source === selected) && e.latitude === null && !e.watchIds?.length).length;
  const refresh = () => { void feed.refetch(); void feeds.refetch(); watchData.refresh(); };
  function open(entry: UpdateEntry) {
    if (entry.source === 'rfs') router.push({ pathname: '/incident/[id]', params: { id: entry.originalId } });
    else if (entry.source === 'fireDanger') router.push('/fire-danger');
    else if (entry.source === 'weather') router.push({ pathname: '/weather', params: { watch: entry.watchIds?.[0] ?? '' } });
    else router.push({ pathname: '/hazard', params: { source: entry.source, id: entry.originalId } });
  }
  function availability(entry: UpdateEntry) {
    if (entry.source === 'rfs') return isStale ? 'unverified' : 'live';
    if (entry.source === 'fireDanger') return feeds.data?.fireRatings.status ?? 'unavailable';
    if (entry.source === 'weather') return watchData.errors.length ? 'check availability' : 'zone samples';
    return feeds.data?.sources.find(s => s.id === entry.source)?.status ?? 'unavailable';
  }
  const chip = (label: string, active: boolean, onPress: () => void, disabled = false, key = label) => <Pressable
    key={key} accessibilityRole="radio" accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={onPress}
    style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20, opacity: disabled ? 0.45 : 1, backgroundColor: active ? c.header : c.secondary }}
  ><Text style={{ color: active ? c.headerText : c.foreground, fontFamily: fonts.bold, fontSize: 12 }}>{label}</Text></Pressable>;
  return <Screen refreshControl={<RefreshControl refreshing={feed.isRefetching || feeds.isRefetching || watchData.refreshing} onRefresh={refresh} />}>
    <View style={ui.content}>
      <View><Text style={ui.label}>The latest picture</Text><Text style={[ui.title, { marginTop: 6 }]}>Hazards & updates</Text></View>
      <Button title="Weather & live radar" secondary icon="cloud" onPress={() => router.push('/weather')} />
      <View style={[ui.row, { flexWrap: 'wrap', gap: 7 }]}>
        {updateSources.map(([id, label]) => chip(label, selected === id, () => { setSelected(id); router.setParams({ source: id }); }))}
      </View>
      <Text style={ui.h2}>{selected === 'all' ? 'All feeds, one view' : updateSources.find(([id]) => id === selected)?.[1]}</Text>
      <View style={[ui.row, { flexWrap: 'wrap' }]}>
        {chip('Near watch zones', scope === 'home', () => setScope('home'))}
        {chip('All NSW', scope === 'nsw', () => setScope('nsw'))}
      </View>
      {settings.watches.length > 0 && <View style={{ gap: 8 }}>
        <Text style={ui.label}>Watch zones / distance reference</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
          {chip('All watch zones', zone === 'all', () => setZone('all'))}
          {settings.watches.map(w => chip(w.label, zone === w.id, () => setZone(w.id), false, w.id))}
        </ScrollView>
        <Text style={ui.small}>{zone === 'all' ? 'Distance is measured from the nearest saved watch address. Near watch zones includes each address’s radius.' : `Distance and local filtering use ${watches[0]?.label ?? 'the selected address'} and its saved radius.`} Browsing does not change alert preferences.</Text>
      </View>}
      {!watches.length && <><Notice>Add a watch address for local filtering and distance sorting. All NSW remains available.</Notice><Button title="Add watch address" secondary onPress={() => router.push('/place')} /></>}
      <View style={{ gap: 8 }}>
        <Text style={ui.label}>Sort reports</Text>
        <View style={[ui.row, { flexWrap: 'wrap', gap: 7 }]}>
          {chip('Distance', sort === 'distance', () => setSort('distance'), !watches.length)}
          {chip('Latest update', sort === 'latest', () => setSort('latest'))}
          {chip('Distance + latest', sort === 'distanceLatest', () => setSort('distanceLatest'), !watches.length)}
        </View>
        <Text style={ui.small}>{sort === 'distanceLatest' ? 'Nearest 5 km distance bands first; newest source updates within each band.' : sort === 'distance' ? 'Nearest first. Reports without a point location follow mapped reports.' : 'Newest source update first. Reports without an update time follow dated reports.'}</Text>
      </View>
      <TextInput accessibilityLabel="Search all hazard reports" placeholder="Search place, source, incident or warning…" placeholderTextColor={c.mutedForeground} style={ui.input} value={search} onChangeText={setSearch} autoCorrect={false} />
      {(selected === 'all' || selected === 'bom') && <Notice>BOM warnings are NSW-wide and not geocoded. They appear in All NSW, not as verified nearby warnings.</Notice>}
      {scope === 'home' && unlocated > 0 && <Notice>{unlocated} reports or district ratings cannot be matched to these watch zones. Review All NSW; an absent local report is not an all-clear.</Notice>}
      {showWeather && <Notice>Xweather lightning, hail, wind and rain are checked at saved watch zones only—not statewide coverage. Wind and rain entries are point observations/forecasts, not necessarily warnings. Radar remains available in Weather & radar.</Notice>}
      {warnings.map(warning => <Notice key={warning} error>{warning}</Notice>)}
      {alertOption && <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/settings')} style={ui.card}><Text style={ui.small}>{settings.notifications && settings.alertHazards[alertOption.key] ? 'PHONE ALERT ON' : settings.alertHazards[alertOption.key] ? 'SOURCE SELECTED · PHONE ALERTS OFF' : 'BROWSE ONLY'} · {alertOption.label} · change in Watch preferences</Text></Pressable>}
      {((showRfs && feed.isPending) || (showFeeds && feeds.isPending) || watchData.loading) && <ActivityIndicator color={c.primary} />}
      <Text style={ui.label}>{results.length} matching {results.length === 1 ? 'update' : 'updates'}</Text>
      {results.slice(0, limit).map(entry => <Pressable key={entry.id} accessibilityRole="button" onPress={() => open(entry)} style={ui.card}>
        <Text style={[ui.label, { color: ['live', 'zone samples'].includes(availability(entry)) ? c.primary : c.warning }]}>{entry.sourceName} · {availability(entry)}</Text>
        <Text style={ui.h2}>{entry.title}</Text><Text style={ui.small}>{entry.category} · {entry.location}</Text>
        <Text style={ui.small}>{entry.nearest ? `${entry.nearest.km.toFixed(1)} km from ${entry.nearest.watch.label}` : entry.watchIds?.length ? `Area matched to ${watches.filter(w => entry.watchIds?.includes(w.id)).map(w => w.label).join(', ')} · no point distance` : 'No mapped point · distance unavailable'}</Text>
        <Text style={ui.small}>{entry.source === 'weather' ? 'Observed / forecast issued' : 'Updated by source'}: {entry.updatedAt !== null ? new Date(entry.updatedAt).toLocaleString() : 'Not supplied'}</Text>
        {entry.source === 'fireDanger' && entry.generatedAt != null && <Text style={ui.small}>Rating data generated: {new Date(entry.generatedAt).toLocaleString()}. This is not the last rating-change time.</Text>}
        <Text style={{ fontFamily: fonts.bold, color: c.primary, fontSize: 12 }}>{entry.source === 'weather' ? 'View weather & radar' : 'Read in app'} →</Text>
      </Pressable>)}
      {!results.length && <Text style={ui.small}>No matching updates currently loaded. Check source availability, All NSW and official advice. This is not a guarantee of safety.</Text>}
      {results.length > limit && <Button title={`Show more (${results.length - limit} remaining)`} secondary onPress={() => setLimit(count => count + 50)} />}
      <Button title="Refresh all feeds" secondary icon="refresh-cw" onPress={refresh} />
      <Text style={ui.small}>{showRfs && feed.data ? `RFS fetched ${timeAgo(feed.data.fetchedAt)}. ` : ''}{source ? `${source.name}: ${source.status}. ` : ''}List filters do not change which hazards can send notifications. Sources can be delayed or unavailable. Call 000 in an emergency.</Text>
    </View>
  </Screen>;
}
