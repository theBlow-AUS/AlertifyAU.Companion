import React, { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useCompanion } from '@/contexts/CompanionContext';
import { Button, Notice, Screen, Sensitivity, errorMessage, openUrl, reportError, ui } from '@/components/BrandUI';
import { enableNotifications, setBackgroundChecks } from '@/lib/monitor';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/colors';

export default function Preferences() {
  const c = useColors();
  const { settings, saveSettings, ready, storageError, monitorError } = useCompanion();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function notifications(enabled: boolean) {
    setBusy(true); setError('');
    try {
      if (enabled) await enableNotifications();
      else if (settings.background) await setBackgroundChecks(false);
      await saveSettings({ notifications: enabled, ...(!enabled ? { background: false } : {}) });
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function background(enabled: boolean) {
    setBusy(true); setError('');
    try { await setBackgroundChecks(enabled); await saveSettings({ background: enabled }); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <Screen><View style={ui.content}>
    <View><Text style={ui.label}>Make it yours</Text><Text style={[ui.title, { marginTop: 6 }]}>Watch preferences</Text></View>
    {!!storageError && <Notice error>{storageError}</Notice>}
    <Pressable onPress={() => router.push('/place')} style={[ui.card, ui.row]}><Feather name="map-pin" size={23} color={c.success} /><View style={{ flex: 1, gap: 5 }}><Text style={ui.h2}>{settings.home?.name ?? 'Set your home location'}</Text><Text style={ui.small}>{settings.home ? `${settings.radius} km watch radius · tap to edit` : 'Save a place before enabling Home Watch'}</Text></View><Feather name="chevron-right" size={18} color={c.mutedForeground} /></Pressable>
    <View style={ui.card}><Text style={ui.h2}>Home alert sensitivity</Text><Sensitivity value={settings.homeLevel} onChange={homeLevel => void saveSettings({ homeLevel }).catch(reportError)} /></View>
    <View style={ui.card}><Text style={ui.h2}>Trip alert sensitivity</Text><Sensitivity value={settings.tripLevel} onChange={tripLevel => void saveSettings({ tripLevel }).catch(reportError)} /><Text style={ui.small}>Changes here never change your Home Watch sensitivity.</Text></View>
    <View style={ui.card}>
      <View style={ui.spread}><View style={{ flex: 1 }}><Text style={ui.h2}>Quiet hours</Text><Text style={ui.small}>Silences all local alerts, including urgent ones</Text></View><Switch accessibilityLabel="Enable quiet hours" value={settings.quietHours} onValueChange={quietHours => void saveSettings({ quietHours }).catch(reportError)} trackColor={{ true: c.success, false: c.border }} /></View>
      {settings.quietHours && <>
        <Text style={ui.small}>Choose a window in your phone’s local time. Updates received during quiet hours are not replayed.</Text>
        {([{ key: 'quietStart', label: 'Start' }, { key: 'quietEnd', label: 'End' }] as const).map(({ key, label }) => <View key={key} style={ui.spread}><Text style={ui.text}>{label}</Text><View style={ui.row}><Pressable accessibilityLabel={`Move ${label.toLowerCase()} hour earlier`} onPress={() => void saveSettings({ [key]: (settings[key] + 23) % 24 }).catch(reportError)} style={{ padding: 12 }}><Feather name="minus" size={18} color={c.primary} /></Pressable><Text style={ui.h2}>{String(settings[key]).padStart(2, '0')}:00</Text><Pressable accessibilityLabel={`Move ${label.toLowerCase()} hour later`} onPress={() => void saveSettings({ [key]: (settings[key] + 1) % 24 }).catch(reportError)} style={{ padding: 12 }}><Feather name="plus" size={18} color={c.primary} /></Pressable></View></View>)}
        {settings.quietStart === settings.quietEnd && <Notice error>Matching start and end times silence alerts all day.</Notice>}
      </>}
    </View>
    <View style={ui.card}>
      <View style={ui.spread}><View style={{ flex: 1 }}><Text style={ui.h2}>On-device notifications</Text><Text style={ui.small}>New incidents and warning-level changes</Text></View><Switch accessibilityLabel="Enable on-device notifications" value={settings.notifications} onValueChange={v => void notifications(v)} disabled={busy || !ready} trackColor={{ true: c.success, false: c.border }} /></View>
      <Text style={ui.small}>Off until you opt in. Checks run while the app is open. No server push service is connected, and no alert is guaranteed.</Text>
      {Platform.OS === 'web' && <Notice>Notifications and background checks must be enabled in the native app, not this browser preview.</Notice>}
      <View style={[ui.spread, { marginTop: 10 }]}><View style={{ flex: 1 }}><Text style={ui.h2}>Background checks</Text><Text style={ui.small}>Optional · scheduled by your phone</Text></View><Switch accessibilityLabel="Enable background incident checks" value={settings.background} onValueChange={v => void background(v)} disabled={busy || !settings.notifications || Platform.OS === 'web'} trackColor={{ true: c.success, false: c.border }} /></View>
      <Text style={ui.small}>Requests a check about every 15 minutes, but iOS/Android decide when it runs. May require a native build and Background App Refresh. It can stop when the app is force-closed.</Text>
      {busy && <ActivityIndicator color={c.primary} />}
      {!!error && <Notice error>{error}</Notice>}
      {!!monitorError && <Notice error>{monitorError}</Notice>}
      {Platform.OS !== 'web' && <Button title="Open phone permission settings" icon="settings" secondary onPress={() => void Linking.openSettings().catch(reportError)} />}
    </View>
    <View style={ui.card}><Text style={ui.h2}>Navigation preference</Text><Text style={ui.text}>{settings.navigationApp ?? 'Ask on each trip'}</Text><Text style={ui.small}>A choice is remembered only after you opt in on the Trip Watch screen.</Text>{settings.navigationApp && <Button title="Forget preferred app" icon="x" secondary onPress={() => void saveSettings({ navigationApp: null }).catch(reportError)} />}</View>
    <View style={ui.card}>
      <Text style={ui.label}>Alertify.au Companion</Text><Text style={ui.h2}>Awareness, not alarm.</Text>
      <Text style={ui.small}>Saved places, alert settings and trip estimates stay on your device. Address searches are sent to Nominatim, route coordinates to OSRM, and weather coordinates to Open-Meteo. Notifications are generated on device; no account or remote push token is collected.</Text>
      <Text style={ui.small}>Incident information: NSW RFS. Coverage does not include all traffic, weather, flood or emergency warnings. Use official sources, and call 000 in an emergency.</Text>
      <Button title="Open Alertify.au" icon="external-link" secondary onPress={() => void openUrl('https://alertify.au')} />
      <Pressable onPress={() => void openUrl('https://www.rfs.nsw.gov.au/feeds/majorIncidents.json')}><Text style={{ color: c.primary, fontFamily: fonts.bold, fontSize: 12, paddingVertical: 8 }}>View incident data source</Text></Pressable>
    </View>
  </View></Screen>;
}
