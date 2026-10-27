import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useCompanion } from '@/contexts/CompanionContext';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/colors';
import { Button, IncidentRow, Notice, Screen, openUrl, reportError, ui } from '@/components/BrandUI';
import { DANGER_URL, timeAgo, distance } from '@/lib/model';
import { fetchWeather } from '@/lib/services';

export default function HomeWatch() {
  const c = useColors();
  const { settings, saveSettings, feed, nearby, ready, storageError, monitorError, isStale, trip } = useCompanion();
  const home = settings.home;
  const coverageConfirmed = !!home && /\b(NSW|New South Wales)\b/i.test(`${home.name} ${home.detail}`);
  const weather = useQuery({ queryKey: ['weather', home?.latitude, home?.longitude], queryFn: () => fetchWeather(home!), enabled: !!home, staleTime: 600000, refetchInterval: 600000, retry: 1 });
  const sourceReady = !!feed.data && !isStale;
  const status = !home ? 'Your home, in view' : !settings.watch ? 'Home Watch is paused' : !coverageConfirmed ? 'NSW-only data connected' : !sourceReady ? 'Check the latest feed' : nearby.length ? `${nearby.length} nearby RFS ${nearby.length === 1 ? 'incident' : 'incidents'}` : 'No nearby RFS incidents';
  const sub = !home ? 'Save a place to start your local watch.' : !settings.watch ? 'Turn on Home Watch to resume local checks.' : !coverageConfirmed ? 'Local incident coverage has not been confirmed for this pin.' : !sourceReady ? 'Live information is loading or unavailable.' : `Within your ${settings.radius} km watch area. Not an all-clear.`;
  return <Screen refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => { void feed.refetch(); if (home) void weather.refetch(); }} tintColor={c.primary} />}>
    <View style={{ backgroundColor: c.headerPanel, padding: 20, gap: 17 }}>
      <View style={ui.spread}>
        <View><Text style={[ui.label, { color: c.headerMuted }]}>Your saved place</Text><Text style={[ui.title, { color: c.headerText, marginTop: 5 }]}>Home Watch</Text></View>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: settings.watch && !!home }} accessibilityLabel="Toggle Home Watch" onPress={() => home ? void saveSettings({ watch: !settings.watch }).catch(reportError) : router.push('/place')} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 30, backgroundColor: settings.watch && home ? c.on : c.headerButton }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: settings.watch && home ? c.dot : c.headerMuted }} /><Text style={{ color: c.onText, fontFamily: fonts.bold, fontSize: 11 }}>{home && settings.watch ? 'ON' : home ? 'PAUSED' : 'SET UP'}</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => router.push(home ? '/(tabs)/updates' : '/place')} style={{ backgroundColor: c.header, borderColor: c.headerBorder, borderWidth: 1, borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13 }}>
        <Feather name={sourceReady && !nearby.length ? 'shield' : 'radio'} size={25} color={c.dot} />
        <View style={{ flex: 1, gap: 5 }}><Text style={{ fontFamily: fonts.bold, fontSize: 15, color: c.headerText }}>{status}</Text><Text style={{ fontFamily: fonts.regular, fontSize: 11, lineHeight: 17, color: c.headerMuted }}>{sub}</Text></View>
        <Feather name="chevron-right" size={17} color={c.headerMuted} />
      </Pressable>
    </View>
    <View style={ui.content}>
      {!ready && <ActivityIndicator color={c.primary} />}
      {!!storageError && <Notice error>{storageError}</Notice>}
      {!!monitorError && <Notice error>{monitorError}</Notice>}
      {home && !coverageConfirmed && <Notice error>This version connects NSW RFS incidents only. Other states and territories are not covered; use your local emergency agency for current warnings.</Notice>}
      {feed.isError && <View style={{ gap: 10 }}><Notice error>Unable to refresh NSW RFS incidents. {feed.data ? 'Previously fetched data is shown below; do not treat it as current.' : 'No incident status is available.'}</Notice><Button title="Retry incident feed" secondary icon="refresh-cw" onPress={() => void feed.refetch()} /></View>}
      <View style={{ gap: 12 }}>
        <Text style={ui.h2}>Watching this address</Text>
        {home ? <Pressable onPress={() => router.push('/place')} style={[ui.card, ui.row]}>
          <View style={{ padding: 11, backgroundColor: c.secondary, borderRadius: 13 }}><Feather name="map-pin" size={21} color={c.success} /></View>
          <View style={{ flex: 1, gap: 4 }}><Text style={ui.h2} numberOfLines={2}>{home.name}</Text><Text style={ui.small} numberOfLines={2}>{home.detail}</Text></View>
          <Text style={[ui.label, { letterSpacing: 0, color: c.primary }]}>EDIT</Text>
        </Pressable> : <View style={ui.card}><Text style={ui.text}>A little awareness, close to home.</Text><Text style={ui.small}>Choose your home or another place you care about. Your saved address stays on this device.</Text><Button title="Save my home" icon="map-pin" onPress={() => router.push('/place')} testID="setup-home" /></View>}
      </View>
      <View style={{ gap: 12 }}>
        <View style={ui.spread}><Text style={ui.h2}>Nearby conditions</Text>{home && <Text style={ui.small}>{settings.radius} km area</Text>}</View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => void openUrl(DANGER_URL)} style={{ flex: 1, backgroundColor: c.accent, borderRadius: 18, padding: 15, gap: 10 }}>
            <View style={ui.spread}><Text style={[ui.label, { letterSpacing: 0.6 }]}>Fire danger</Text><Feather name="external-link" size={15} color={c.warning} /></View>
            <Text style={[ui.h2, { fontSize: 19, color: c.accentForeground }]}>View rating</Text><Text style={[ui.small, { fontSize: 11 }]}>Official NSW RFS ratings</Text>
          </Pressable>
          <Pressable onPress={() => home ? void weather.refetch() : router.push('/place')} style={{ flex: 1, backgroundColor: c.weather, borderRadius: 18, padding: 15, gap: 10 }}>
            <View style={ui.spread}><Text style={[ui.label, { letterSpacing: 0.6 }]}>Weather</Text><Feather name="cloud" size={15} color={c.weatherInk} /></View>
            <Text style={[ui.h2, { fontSize: 19 }]}>{!home ? 'Add home' : weather.isPending ? 'Loading…' : weather.isError ? 'Unavailable' : `${Math.round(weather.data.temperature)}° ${weather.data.label}`}</Text>
            <Text style={[ui.small, { fontSize: 11 }]}>{weather.data && !weather.isError ? `Wind ${Math.round(weather.data.wind)} km/h` : weather.isError ? 'Tap to retry' : 'Local conditions'}</Text>
          </Pressable>
        </View>
        {weather.data && <Text style={[ui.small, { fontSize: 10 }]}>Weather: Open-Meteo · {weather.data.time.replace('T', ' ')} Sydney time</Text>}
      </View>
      <View>
        <View style={ui.spread}><Text style={ui.h2}>{home ? 'Around your home' : 'Across NSW'}</Text><Pressable onPress={() => router.push('/(tabs)/updates')} hitSlop={12}><Text style={{ color: c.primary, fontFamily: fonts.bold, fontSize: 12 }}>See all →</Text></Pressable></View>
        <View style={[ui.card, { marginTop: 12, paddingVertical: 0 }]}>
          {feed.isPending && <ActivityIndicator style={{ padding: 25 }} color={c.primary} />}
          {(home ? nearby : [...(feed.data?.incidents ?? [])].sort((a, b) => b.severity - a.severity)).slice(0, 3).map(incident => <IncidentRow key={incident.id} incident={incident} subtitle={`${incident.category} · ${home ? `${distance(home, incident).toFixed(1)} km from home` : incident.council || incident.type}`} />)}
          {feed.data && home && !nearby.length && <View style={{ paddingVertical: 20, gap: 7 }}><Text style={ui.h2}>No NSW RFS reports in this area</Text><Text style={ui.small}>This feed covers NSW RFS incidents, not every hazard. Check official advice before making safety decisions.</Text></View>}
          {feed.data && !feed.data.incidents.length && !home && <Text style={[ui.small, { paddingVertical: 20 }]}>The RFS feed currently contains no incidents.</Text>}
        </View>
        <Text style={[ui.small, { fontSize: 10, marginTop: 8, color: isStale ? c.warning : c.mutedForeground }]}>{feed.data ? `${isStale ? 'STALE / UNVERIFIED · ' : ''}Fetched ${timeAgo(feed.data.fetchedAt)} · NSW RFS` : 'Waiting for NSW RFS data'}</Text>
      </View>
      <Pressable style={[ui.row, { padding: 16, borderRadius: 18, backgroundColor: c.secondary }]} onPress={() => router.push('/(tabs)/trips')}>
        <Feather name="arrow-up-right" size={24} color={c.success} /><View style={{ flex: 1, gap: 4 }}><Text style={ui.h2}>{trip ? 'Trip Watch is active' : 'Heading somewhere?'}</Text><Text style={ui.small}>{trip ? trip.destination.name : 'Check your route with Trip Watch'}</Text></View><Feather name="chevron-right" size={18} color={c.success} />
      </Pressable>
      <Text style={ui.small}>Not an emergency service. Call 000 in an emergency. No incident report is a guarantee of safety.</Text>
    </View>
  </Screen>;
}
