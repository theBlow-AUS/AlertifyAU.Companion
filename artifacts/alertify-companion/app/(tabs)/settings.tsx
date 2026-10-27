import React, { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useCompanion } from '@/contexts/CompanionContext';
import { Button, Notice, Screen, Sensitivity, errorMessage, openUrl, reportError, ui } from '@/components/BrandUI';
import { enableNotifications, setBackgroundChecks } from '@/lib/monitor';
import { alertHazardOptions } from '@/lib/model';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/colors';
import { WatchAddresses } from '@/components/WatchAddresses';

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
    <WatchAddresses />
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
      <View style={ui.spread}><View style={{ flex: 1 }}><Text style={ui.h2}>On-device notifications</Text><Text style={ui.small}>Selected hazards for watch zones and trips</Text></View><Switch accessibilityLabel="Enable on-device notifications" value={settings.notifications} onValueChange={v => void notifications(v)} disabled={busy || !ready} trackColor={{ true: c.success, false: c.border }} /></View>
      <Text style={ui.small}>Selected sources are checked against enabled watch zones and your active trip. TfNSW/SES need a mapped location; BOM warnings are labelled NSW-wide because the current feed has no geocoded warning areas. No alert is guaranteed.</Text>
      {Platform.OS === 'web' && <Notice>Notifications and background checks must be enabled in the native app, not this browser preview.</Notice>}
      <View style={[ui.spread, { marginTop: 10 }]}><View style={{ flex: 1 }}><Text style={ui.h2}>Background checks</Text><Text style={ui.small}>Optional · scheduled by your phone</Text></View><Switch accessibilityLabel="Enable background incident checks" value={settings.background} onValueChange={v => void background(v)} disabled={busy || !settings.notifications || Platform.OS === 'web'} trackColor={{ true: c.success, false: c.border }} /></View>
      <Text style={ui.small}>Requests a check about every 15 minutes, but iOS/Android decide when it runs. May require a native build and Background App Refresh. It can stop when the app is force-closed.</Text>
      {busy && <ActivityIndicator color={c.primary} />}
      {!!error && <Notice error>{error}</Notice>}
      {!!monitorError && <Notice error>{monitorError}</Notice>}
      {Platform.OS !== 'web' && <Button title="Open phone permission settings" icon="settings" secondary onPress={() => void Linking.openSettings().catch(reportError)} />}
    </View>
    <View style={ui.card} testID="hazard-alert-preferences">
      <Text style={ui.h2}>Choose alert sources</Text>
      <Text style={ui.small}>Selected feeds can alert for enabled watch zones and your active trip. Turn on-device notifications above to receive phone alerts. Source pages remain available when a source is switched off.</Text>
      {alertHazardOptions.map(option => <View key={option.key} style={[ui.spread, { gap: 14, paddingVertical: 11, borderTopWidth: 1, borderColor: c.border }]}>
        <View style={{ flex: 1, gap: 4 }}><Text style={ui.text}>{option.label}</Text><Text style={ui.small}>{option.detail}</Text></View>
        <Switch accessibilityLabel={`Include ${option.label} in alerts`} value={settings.alertHazards[option.key]} onValueChange={enabled => void saveSettings(current => ({ alertHazards: { ...current.alertHazards, [option.key]: enabled } })).catch(reportError)} disabled={!ready} trackColor={{ true: c.success, false: c.border }} />
      </View>)}
      <Text style={ui.small}>Lightning and hail alerts use Xweather events. Wind and rain thresholds are advisory estimates, not official warning levels. Unlocated TfNSW/SES reports cannot trigger local alerts; BOM warnings are clearly labelled statewide.</Text>
    </View>
    <View style={ui.card}><Text style={ui.h2}>Navigation preference</Text><Text style={ui.text}>{settings.navigationApp ?? 'Ask on each trip'}</Text><Text style={ui.small}>A choice is remembered only after you opt in on the Trip Watch screen.</Text>{settings.navigationApp && <Button title="Forget preferred app" icon="x" secondary onPress={() => void saveSettings({ navigationApp: null }).catch(reportError)} />}</View>
    <View style={ui.card}>
      <Text style={ui.label}>Alertify.au Companion</Text><Text style={ui.h2}>Awareness, not alarm.</Text>
      <Text style={ui.small}>Saved places, alert settings and trip estimates stay on your device. Selected alert checks send watch coordinates or route samples to Alertify and its listed data sources. Address searches go to Nominatim and routes to OSRM. Notifications are scheduled locally; there is no account or remote push token.</Text>
      <Text style={ui.small}>Alert feeds: NSW RFS, fire danger ratings, TfNSW, BOM, SES and Xweather Lightning, Hail Threats, Wind and Rain. Radar: RainViewer. Checks are periodic and source-dependent, not continuous monitoring. Some feeds are statewide or lack a usable location. Sources may be incomplete or unavailable. Call 000 in an emergency.</Text>
      <Button title="Open Alertify.au" icon="external-link" secondary onPress={() => void openUrl('https://alertify.au')} />
      <Pressable onPress={() => void openUrl('https://www.rfs.nsw.gov.au/feeds/majorIncidents.json')}><Text style={{ color: c.primary, fontFamily: fonts.bold, fontSize: 12, paddingVertical: 8 }}>View incident data source</Text></Pressable>
    </View>
  </View></Screen>;
}
