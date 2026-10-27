import React, { useState } from 'react';
import { Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Notice, Screen, confirmAction, errorMessage, reportError, ui } from '@/components/BrandUI';
import { useCompanion } from '@/contexts/CompanionContext';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/colors';
import { searchPlaces } from '@/lib/services';
import { currentPlace } from '@/lib/location';
import type { Place } from '@/lib/model';

export default function SavePlace() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const c = useColors();
  const { settings, saveWatch, deleteWatch, ready } = useCompanion();
  const existing = settings.watches.find(w => w.id === id);
  const [label, setLabel] = useState(existing?.label ?? '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [chosen, setChosen] = useState<Place | null>(existing?.place ?? null);
  const [radius, setRadius] = useState(existing?.radius ?? 10);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  async function search() {
    if (query.trim().length < 3) { setError('Enter at least three characters, including your suburb or postcode.'); return; }
    setBusy('search'); setError('');
    try { const found = await searchPlaces(query.trim()); setResults(found); if (!found.length) setError('No Australian address found. Try a suburb and postcode.'); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(''); }
  }
  async function locate() {
    setBusy('location'); setError('');
    try { setChosen(await currentPlace()); setResults([]); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(''); }
  }
  async function save() {
    if (!chosen || !label.trim()) { setError('Give this address a name and choose its location.'); return; }
    if (id && !existing) { setError('This saved address no longer exists. Return to Home Watch.'); return; }
    setBusy('save'); setError('');
    try {
      await saveWatch({ id: existing?.id ?? `watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, label: label.trim(), place: chosen, radius, enabled: existing?.enabled ?? true });
      router.back();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(''); }
  }
  return <Screen back><View style={ui.content}>
    <View><Text style={ui.label}>Places you care about</Text><Text style={[ui.title, { marginTop: 6 }]}>{existing ? 'Edit watch address' : 'Add watch address'}</Text></View>
    <Text style={ui.h2}>Name this address</Text>
    <TextInput accessibilityLabel="Watch address name" placeholder="Home, Mum’s place, Office…" placeholderTextColor={c.mutedForeground} value={label} onChangeText={setLabel} maxLength={60} style={ui.input} testID="watch-label" />
    <Button title="Use my current location" icon="navigation" secondary onPress={() => void locate()} busy={busy === 'location'} disabled={!!busy && busy !== 'location'} />
    <Text style={ui.label}>Search an Australian address</Text>
    <TextInput value={query} onChangeText={setQuery} placeholder="Street, suburb or postcode" placeholderTextColor={c.mutedForeground} style={ui.input} onSubmitEditing={() => void search()} returnKeyType="search" accessibilityLabel="Watch address search" testID="watch-search" />
    <Button title="Find address" icon="search" onPress={() => void search()} busy={busy === 'search'} disabled={!!busy && busy !== 'search'} />
    {!!error && <Notice error>{error}</Notice>}
    {error.includes('settings') && Platform.OS !== 'web' && <Button title="Open phone settings" secondary onPress={() => void Linking.openSettings().catch(reportError)} />}
    {results.map((place, i) => <Pressable key={`${place.latitude}-${i}`} style={ui.card} onPress={() => { setChosen(place); setResults([]); }}><Text style={ui.h2}>{place.name}</Text><Text style={ui.small}>{place.detail}</Text></Pressable>)}
    {chosen && <View style={[ui.card, { backgroundColor: c.accent }]}><Text style={ui.label}>Selected address</Text><Text style={ui.h2}>{chosen.name}</Text><Text style={ui.small}>{chosen.detail}</Text></View>}
    <View style={{ gap: 12 }}><Text style={ui.h2}>Watch radius</Text><View style={{ flexDirection: 'row', gap: 8 }}>
      {[5, 10, 25, 50].map(km => <Pressable key={km} accessibilityRole="radio" accessibilityState={{ selected: radius === km }} onPress={() => setRadius(km)} style={{ flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: radius === km ? c.header : c.secondary }}><Text style={{ textAlign: 'center', fontFamily: fonts.bold, color: radius === km ? c.headerText : c.foreground }}>{km} km</Text></Pressable>)}
    </View></View>
    <Button title={existing ? 'Save changes' : 'Save watch address'} icon="check" onPress={() => void save()} disabled={!chosen || !label.trim() || !ready || (!!busy && busy !== 'save')} busy={busy === 'save'} testID="save-watch" />
    {existing && <Pressable accessibilityRole="button" style={{ padding: 14 }} onPress={() => confirmAction(`Delete ${existing.label}?`, 'This address and its local alert checks will be removed from this device. Other saved addresses and trips will be kept.', 'Delete address', () => { void deleteWatch(existing.id).then(() => router.back()).catch(reportError); }, true)} testID="delete-watch"><Text style={{ color: c.destructive, textAlign: 'center', fontFamily: fonts.bold }}>Delete watch address</Text></Pressable>}
    <Notice>Names and saved pins are stored on this device. Searches use OpenStreetMap Nominatim, and weather requests use coordinates. Source data comes via Alertify and NSW RFS.</Notice>
  </View></Screen>;
}
