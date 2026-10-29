import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Switch, Text, View } from 'react-native';
import { useCompanion } from '@/contexts/CompanionContext';
import { useColors } from '@/hooks/useColors';
import { currentLocationRadiusLimits, timeAgo } from '@/lib/model';
import { readLiveLocationStatus } from '@/lib/live-location-status';
import { requestCurrentLocationPermission, stopTripBackgroundLocation } from '@/lib/location';
import { errorMessage, Notice, ui } from './BrandUI';

export function CurrentLocationAlerts() {
  const c = useColors();
  const { settings, saveSettings, monitorError } = useCompanion();
  const [radiusDraft, setRadiusDraft] = useState(settings.currentLocationRadiusKm);
  const radiusRef = useRef(radiusDraft);
  const [trackWidth, setTrackWidth] = useState(0);
  const [status, setStatus] = useState<{ lastLocationAt: number | null; lastCheckAt: number | null; error: string | null }>({
    lastLocationAt: null, lastCheckAt: null, error: null,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const disabled = !settings.notifications || busy;

  useEffect(() => {
    let live = true;
    const refresh = () => { void readLiveLocationStatus().then(next => { if (live) setStatus(next); }); };
    refresh();
    const timer = setInterval(refresh, 10_000);
    return () => { live = false; clearInterval(timer); };
  }, []);

  function radiusFromX(x: number) {
    if (!trackWidth) return radiusRef.current;
    const ratio = Math.max(0, Math.min(1, (x - 10) / Math.max(1, trackWidth - 20)));
    return Math.round(currentLocationRadiusLimits.min + ratio * (currentLocationRadiusLimits.max - currentLocationRadiusLimits.min));
  }
  function updateDraft(value: number) {
    const next = Math.max(currentLocationRadiusLimits.min, Math.min(currentLocationRadiusLimits.max, Math.round(value)));
    radiusRef.current = next;
    setRadiusDraft(next);
  }
  async function saveRadius() {
    try { await saveSettings({ currentLocationRadiusKm: radiusRef.current }); }
    catch (e) { setError(errorMessage(e)); }
  }
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: event => updateDraft(radiusFromX(event.nativeEvent.locationX)),
    onPanResponderMove: event => updateDraft(radiusFromX(event.nativeEvent.locationX)),
    onPanResponderRelease: () => { void saveRadius(); },
    onPanResponderTerminate: () => { void saveRadius(); },
  }), [trackWidth, settings.notifications]);

  async function setAlerts(enabled: boolean) {
    setBusy(true); setError('');
    try {
      if (enabled) {
        await requestCurrentLocationPermission();
        await saveSettings({ currentLocationAlerts: true });
      } else {
        await stopTripBackgroundLocation();
        await saveSettings({ currentLocationAlerts: false, tripBackgroundLocation: false });
      }
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  async function adjustForAccessibility(actionName: string) {
    const delta = actionName === 'increment' ? 1 : -1;
    updateDraft(radiusRef.current + delta);
    try { await saveSettings({ currentLocationRadiusKm: radiusRef.current }); }
    catch (e) { setError(errorMessage(e)); }
  }

  const locationText = status.lastLocationAt
    ? Date.now() - status.lastLocationAt > 120_000
      ? `Last location ${timeAgo(status.lastLocationAt)} · stale`
      : `Location updated ${timeAgo(status.lastLocationAt)}`
    : 'Waiting for a fresh location fix';
  const checkText = status.lastCheckAt ? `Last checked ${timeAgo(status.lastCheckAt)}` : 'No location check recorded yet';
  const statusError = status.error || monitorError;

  return <View style={ui.card} testID="current-location-alerts">
    <View style={ui.spread}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={ui.h2}>Current-location alerts</Text>
        <Text style={ui.small}>Check selected hazard feeds around your live position</Text>
      </View>
      <Switch
        accessibilityLabel="Enable current-location hazard alerts"
        value={settings.currentLocationAlerts}
        onValueChange={value => void setAlerts(value)}
        disabled={disabled}
        trackColor={{ true: c.success, false: c.border }}
      />
    </View>
    <Text style={ui.small}>Radius: {radiusDraft} km · 1–50 km. Uses {settings.tripBackgroundLocation ? 'Trip' : 'Home'} alert sensitivity. This is a periodic check, not continuous monitoring.</Text>
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Current-location alert radius"
      accessibilityValue={{ min: currentLocationRadiusLimits.min, max: currentLocationRadiusLimits.max, now: radiusDraft, text: `${radiusDraft} km` }}
      accessibilityActions={[{ name: 'increment', label: 'Increase radius' }, { name: 'decrement', label: 'Decrease radius' }]}
      onAccessibilityAction={event => { void adjustForAccessibility(event.nativeEvent.actionName); }}
      onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
      {...(settings.notifications ? responder.panHandlers : {})}
      style={{ height: 40, justifyContent: 'center', paddingHorizontal: 10, opacity: settings.notifications ? 1 : 0.5 }}
    >
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.border, overflow: 'visible' }}>
        <View style={{ width: `${((radiusDraft - currentLocationRadiusLimits.min) / (currentLocationRadiusLimits.max - currentLocationRadiusLimits.min)) * 100}%`, height: 6, borderRadius: 3, backgroundColor: c.primary }} />
      </View>
      <View style={{ position: 'absolute', left: 10 + ((radiusDraft - currentLocationRadiusLimits.min) / (currentLocationRadiusLimits.max - currentLocationRadiusLimits.min)) * Math.max(0, trackWidth - 20), width: 20, height: 20, marginLeft: -10, borderRadius: 10, backgroundColor: c.primary, borderWidth: 2, borderColor: c.card }} />
    </View>
    <View style={ui.spread}><Text style={ui.small}>1 km</Text><Text style={ui.small}>50 km</Text></View>
    {!settings.notifications && <Notice>Turn on-device notifications on first to enable live-location alerts.</Notice>}
    {settings.currentLocationAlerts && <View style={{ gap: 4 }}>
      <Text style={ui.small}>{locationText}</Text>
      <Text style={ui.small}>{checkText}</Text>
      {!!statusError && <Notice error>{statusError}</Notice>}
    </View>}
    {!!error && <Notice error>{error}</Notice>}
    {busy && <Text style={ui.small}>Updating location permission…</Text>}
    {!settings.currentLocationAlerts && !busy && <Text style={ui.small}>Location access is requested only when you turn this on. Coordinates are used for feed checks and are not saved as a location history.</Text>}
  </View>;
}
