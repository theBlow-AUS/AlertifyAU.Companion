import React, { useState } from 'react';
import { Alert, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useCompanion } from '@/contexts/CompanionContext';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/colors';
import { Button, Diagram, IncidentRow, Notice, Screen, Sensitivity, confirmAction, errorMessage, reportError, ui } from '@/components/BrandUI';
import { currentPlace } from '@/lib/location';
import { estimateRoute, searchPlaces } from '@/lib/services';
import { openNavigation } from '@/lib/navigation';
import { type NavigationApp, type Place, type RouteEstimate, navigationUrl, routeDistance, timeAgo } from '@/lib/model';
import { WeatherAssessment } from '@/components/weather/WeatherAssessment';

export default function Trips() {
  const c = useColors();
  const { settings, saveSettings, feed, trip, saveTrip, isStale } = useCompanion();
  const [start, setStart] = useState<Place | null>(settings.home);
  const [destination, setDestination] = useState<Place | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [estimate, setEstimate] = useState<RouteEstimate | null>(null);
  const [app, setApp] = useState<NavigationApp>(settings.navigationApp ?? 'Google Maps');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const shownRoute = estimate ?? (destination ? null : trip);
  const nearby = shownRoute ? (feed.data?.incidents ?? []).filter(i => routeDistance(i, shownRoute.coordinates) <= 5).sort((a, b) => b.severity - a.severity) : [];
  async function find() {
    if (search.trim().length < 3) { setError('Enter at least three characters, including a suburb or postcode.'); return; }
    setBusy('search'); setError('');
    try { const found = await searchPlaces(search.trim()); setResults(found); if (!found.length) setError('No destination found. Try a more specific Australian location.'); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(''); }
  }
  async function locate() {
    setBusy('location'); setError('');
    try { setStart(await currentPlace()); setEstimate(null); } catch (e) { setError(errorMessage(e)); } finally { setBusy(''); }
  }
  async function check() {
    if (!start || !destination) return;
    setBusy('route'); setError('');
    try { setEstimate(await estimateRoute(start, destination)); void feed.refetch(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(''); }
  }
  async function handoff(route: RouteEstimate | null, dest: Place) {
    setBusy('handoff'); setError('');
    try {
      const chosenApp = remember ? app : settings.navigationApp ?? app;
      if (remember) await saveSettings({ navigationApp: app });
      // Persist before the app is backgrounded by the handoff, then restore on failure.
      await saveTrip(route ? { ...route, startedAt: Date.now() } : null);
      try { await openNavigation(chosenApp, dest, route?.start); }
      catch (openError) { await saveTrip(trip); throw openError; }
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(''); }
  }
  return <Screen><View style={ui.content}>
    <View><Text style={ui.label}>Know before you go</Text><Text style={[ui.title, { marginTop: 6 }]}>Trip Watch</Text><Text style={[ui.small, { marginTop: 7 }]}>Alertify checks incident proximity. Your preferred navigation app handles the drive.</Text></View>
    {trip && !estimate && <View style={ui.card}><View style={ui.spread}><Text style={ui.h2}>Trip Watch saved</Text><Feather name="radio" size={19} color={c.success} /></View><Text style={ui.text}>{trip.destination.name}</Text><Text style={ui.small}>Checks the saved route estimate, not your navigation app’s live route. {settings.background ? 'Background checks are system-scheduled.' : 'Checks run while Alertify is open.'} Ends after 24 hours unless you end it first.</Text><Button title="End Trip Watch" secondary icon="x" onPress={() => void saveTrip(null).catch(reportError)} /></View>}
    <View style={ui.card}>
      <Text style={ui.label}>Starting point</Text><Text style={ui.h2}>{start?.name ?? 'Choose a starting point'}</Text>{start && <Text style={ui.small}>{start.detail}</Text>}
      <Button title="Use my current location" icon="navigation" secondary busy={busy === 'location'} disabled={!!busy && busy !== 'location'} onPress={() => void locate()} />
      {settings.watches.map(w => <Pressable key={w.id} onPress={() => { setStart(w.place); setEstimate(null); }} style={{ paddingVertical: 8 }}><Text style={{ color: c.primary, fontFamily: fonts.bold, fontSize: 13 }}>Start from {w.label}</Text></Pressable>)}
    </View>
    <View style={{ gap: 10 }}>
      <Text style={ui.h2}>Where are you heading?</Text>
      <TextInput accessibilityLabel="Search destination" value={search} onChangeText={setSearch} placeholder="Town, address or destination" placeholderTextColor={c.mutedForeground} style={ui.input} onSubmitEditing={() => void find()} returnKeyType="search" />
      <Button title="Find destination" icon="search" onPress={() => void find()} busy={busy === 'search'} disabled={!!busy && busy !== 'search'} />
      {results.map((place, index) => <Pressable key={`${place.latitude}-${index}`} onPress={() => { setDestination(place); setEstimate(null); setResults([]); }} style={ui.card}><Text style={ui.h2}>{place.name}</Text><Text style={ui.small}>{place.detail}</Text></Pressable>)}
      {destination && <View style={[ui.card, { backgroundColor: c.accent }]}><Text style={ui.label}>Destination</Text><Text style={ui.h2}>{destination.name}</Text><Text style={ui.small}>{destination.detail}</Text></View>}
      <Button title="Check estimated route" icon="git-branch" disabled={!start || !destination || (!!busy && busy !== 'route')} busy={busy === 'route'} onPress={() => void check()} testID="check-route" />
    </View>
    {!!error && <Notice error>{error}</Notice>}
    {shownRoute && <View style={{ gap: 14 }}>
      <Diagram coordinates={shownRoute.coordinates} points={[shownRoute.start, shownRoute.destination]} />
      <Notice>RFS incident coverage is NSW only. Weather is checked separately at query points along this estimate; neither makes an interstate route fully assessed.</Notice>
      <View style={ui.spread}><Text style={ui.h2}>{Math.round(shownRoute.distance)} km estimated</Text><Text style={ui.small}>{Math.round(shownRoute.duration)} min · no live traffic</Text></View>
      <Notice>Estimate from the public OSRM routing service, based on OpenStreetMap. Google Maps or Waze may choose a different route. Alertify does not receive their live routes or traffic reports.</Notice>
      <View style={ui.spread}><Text style={ui.h2}>Along this route estimate</Text><Text style={ui.small}>5 km corridor</Text></View>
      {isStale ? <Notice error>Incident data is unavailable or stale. No current RFS assessment can be made.</Notice> : <View style={[ui.card, { paddingVertical: nearby.length ? 0 : 16 }]}>{nearby.length ? nearby.map(i => <IncidentRow key={i.id} incident={i} subtitle={`${i.category} · ${routeDistance(i, shownRoute.coordinates).toFixed(1)} km from estimated route`} />) : <><Text style={ui.h2}>No RFS reports in this corridor</Text><Text style={ui.small}>This is not a safety assessment. Review the separate sampled-weather checks below; road closures, flood areas and live traffic are not fully assessed.</Text></>}</View>}
      <Text style={ui.small}>Route calculated {timeAgo(shownRoute.calculatedAt)}. Proximity is measured to reported incident points, not fire perimeters.</Text>
      <WeatherAssessment route={shownRoute} />
    </View>}
    <View style={{ gap: 12 }}><Text style={ui.h2}>Trip alert sensitivity</Text><Sensitivity value={settings.tripLevel} onChange={tripLevel => void saveSettings({ tripLevel }).catch(reportError)} /><Text style={ui.small}>Home Watch sensitivity is kept separate.</Text></View>
    <View style={{ gap: 12 }}>
      <Text style={ui.h2}>Continue with</Text>
      {settings.navigationApp ? <View style={ui.card}><Text style={ui.text}>Preferred app: {settings.navigationApp}</Text><Text style={ui.small}>Saved because you previously opted in.</Text><Button title="Ask me each trip instead" secondary onPress={() => { setApp(settings.navigationApp!); setRemember(false); void saveSettings({ navigationApp: null }).catch(reportError); }} /></View> : <>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {(['Google Maps', 'Waze'] as const).map(option => <Pressable accessibilityRole="radio" accessibilityState={{ selected: app === option }} key={option} onPress={() => setApp(option)} style={[ui.card, { flex: 1, padding: 13, backgroundColor: app === option ? c.weather : c.card, borderColor: app === option ? c.primary : c.border }]}><View style={ui.spread}><Feather name={option === 'Waze' ? 'navigation' : 'map-pin'} size={18} color={c.primary} />{app === option && <Feather name="check" size={16} color={c.primary} />}</View><Text style={[ui.h2, { fontSize: 13 }]}>{option}</Text></Pressable>)}
        </View>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: remember }} onPress={() => setRemember(!remember)} style={[ui.row, { paddingVertical: 8 }]} testID="remember-navigation"><View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: remember ? c.primary : c.mutedForeground, backgroundColor: remember ? c.primary : c.card, alignItems: 'center', justifyContent: 'center' }}>{remember && <Feather name="check" size={15} color={c.primaryForeground} />}</View><Text style={ui.small}>Remember {app} for next time</Text></Pressable>
      </>}
      <Button title={`Open ${settings.navigationApp ?? app}`} icon="arrow-up-right" disabled={!(destination || trip?.destination) || !!busy} onPress={() => {
        const dest = destination ?? trip?.destination;
        if (!dest) return;
        const route = estimate ?? (destination ? null : trip);
        if (!route) confirmAction('No route checks', 'Open navigation without saving a Trip Watch route? Alertify will not monitor this trip.', 'Open navigation', () => void handoff(null, dest));
        else void handoff(route, dest);
      }} testID="open-navigation" />
      <Text style={ui.small}>Opens the installed navigation app when available, otherwise its website.</Text>
    </View>
    <Notice>System-managed background checks can be delayed or stopped. Always follow official instructions and your navigation app. Never interact with the phone while driving.</Notice>
    <Text style={ui.small}>Address search and routing © OpenStreetMap contributors. EV charging and CarPlay-specific interfaces are not part of this first version.</Text>
  </View></Screen>;
}
