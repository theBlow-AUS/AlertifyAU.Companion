import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Notice, Screen, confirmAction, errorMessage, reportError, ui } from '@/components/BrandUI';
import { useCompanion } from '@/contexts/CompanionContext';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/colors';
import { searchPlaces } from '@/lib/services';
import { currentPlace } from '@/lib/location';
import type { Place } from '@/lib/model';

export default function SavePlace() {
  const c = useColors();
  const { settings, saveSettings, ready } = useCompanion();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [chosen, setChosen] = useState<Place | null>(settings.home);
  const [radius, setRadius] = useState(settings.radius);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  async function search() {
    if (query.trim().length < 3) { setError('Enter at least three characters, including your suburb or postcode.'); return; }
    setBusy('search'); setError('');
    try {
      const found = await searchPlaces(query.trim());
      setResults(found);
      if (!found.length) setError('No Australian address found. Try a suburb and postcode, or use your current location.');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(''); }
  }
  async function locate() {
    setBusy('location'); setError('');
    try { setChosen(await currentPlace()); setResults([]); } catch (e) { setError(errorMessage(e)); } finally { setBusy(''); }
  }
  async function save() {
    if (!chosen) return;
    setBusy('save'); setError('');
    try { await saveSettings({ home: chosen, radius, watch: true }); router.back(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(''); }
  }
  return <Screen back><View style={ui.content}>
    <View><Text style={ui.label}>Close to home</Text><Text style={[ui.title, { marginTop: 6 }]}>{settings.home ? 'Your watched place' : 'Set up Home Watch'}</Text></View>
    <Text style={ui.text}>Choose the place you care about. A saved pin is enough—Home Watch does not need continuous location access.</Text>
    <Button title="Use my current location" icon="navigation" secondary onPress={() => void locate()} busy={busy === 'location'} disabled={!!busy && busy !== 'location'} testID="use-location" />
    <Text style={ui.label}>Or search an Australian address</Text>
    <TextInput value={query} onChangeText={setQuery} placeholder="Street, suburb or postcode" placeholderTextColor={c.mutedForeground} style={ui.input} onSubmitEditing={() => void search()} returnKeyType="search" accessibilityLabel="Home address search" />
    <Button title="Find address" icon="search" onPress={() => void search()} busy={busy === 'search'} disabled={!!busy && busy !== 'search'} testID="search-home" />
    {!!error && <Notice error>{error}</Notice>}
    {error.includes('settings') && Platform.OS !== 'web' && <Button title="Open phone settings" secondary onPress={() => void Linking.openSettings().catch(reportError)} />}
    {results.map((place, i) => <Pressable key={`${place.latitude}-${place.longitude}-${i}`} style={[ui.card, { borderColor: chosen === place ? c.primary : c.border }]} onPress={() => setChosen(place)}><Text style={ui.h2}>{place.name}</Text><Text style={ui.small}>{place.detail}</Text></Pressable>)}
    {chosen && <View style={[ui.card, { backgroundColor: c.accent }]}><Text style={ui.label}>Selected place</Text><Text style={ui.h2}>{chosen.name}</Text><Text style={ui.small}>{chosen.detail}</Text><Text style={ui.small}>{chosen.latitude.toFixed(5)}, {chosen.longitude.toFixed(5)}</Text></View>}
    <View style={{ gap: 12 }}><Text style={ui.h2}>Watch radius</Text><View style={{ flexDirection: 'row', gap: 8 }}>
      {[5, 10, 25, 50].map(km => <Pressable key={km} accessibilityRole="radio" accessibilityState={{ selected: radius === km }} onPress={() => setRadius(km)} style={{ flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: radius === km ? c.header : c.secondary }}><Text style={{ textAlign: 'center', fontFamily: fonts.bold, color: radius === km ? c.headerText : c.foreground }}>{km} km</Text></Pressable>)}
    </View></View>
    <Notice>Your home pin is stored on this device. Searches are sent to OpenStreetMap’s Nominatim service; weather requests use coordinates. This version monitors NSW RFS incidents.</Notice>
    <Button title="Save Home Watch" icon="check" onPress={() => void save()} disabled={!chosen || !ready || (!!busy && busy !== 'save')} busy={busy === 'save'} testID="save-home" />
    {settings.home && <Pressable accessibilityRole="button" style={{ padding: 14 }} onPress={() => confirmAction('Remove saved home?', 'Your saved home pin will be removed from this device and Home Watch will stop. Your trip settings will be kept.', 'Remove home', () => { void saveSettings({ home: null, watch: false }).then(() => router.back()).catch(reportError); }, true)}><Text style={{ color: c.destructive, textAlign: 'center', fontFamily: fonts.bold }}>Remove saved home</Text></Pressable>}
    {busy && busy !== 'save' && <ActivityIndicator color={c.primary} />}
    <Text style={ui.small}>Address search © OpenStreetMap contributors.</Text>
  </View></Screen>;
}
