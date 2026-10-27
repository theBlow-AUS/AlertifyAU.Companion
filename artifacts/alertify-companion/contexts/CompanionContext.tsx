import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import colors from '@/constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { defaultSettings, SETTINGS_KEY, TRIP_KEY, FEED_KEY, type Settings, type Trip, type Feed, distance, isCurrentTrip } from '@/lib/model';
import { fetchFeed } from '@/lib/services';
import { checkForChanges } from '@/lib/monitor';

const useCompanionValue = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [monitorError, setMonitorError] = useState('');
  const [clock, setClock] = useState(Date.now());
  const client = useQueryClient();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.multiGet([SETTINGS_KEY, TRIP_KEY, FEED_KEY]);
        const s = saved[0][1] ? JSON.parse(saved[0][1]) as Settings : defaultSettings;
        const t = saved[1][1] ? JSON.parse(saved[1][1]) as Trip : null;
        const cache = saved[2][1] ? JSON.parse(saved[2][1]) as Feed : null;
        if (cancelled) return;
        setSettings({ ...defaultSettings, ...s }); setTrip(isCurrentTrip(t) ? t : null);
        if (cache?.incidents && cache.fetchedAt) client.setQueryData(['rfs-incidents'], cache, { updatedAt: cache.fetchedAt });
      } catch { if (!cancelled) setStorageError('Saved preferences could not be loaded. Please reopen the app before changing settings.'); }
      finally { if (!cancelled) setReady(true); }
    })();
    return () => { cancelled = true; };
  }, [client]);
  const feed = useQuery({ queryKey: ['rfs-incidents'], queryFn: fetchFeed, enabled: ready, refetchInterval: 60000, staleTime: 30000, retry: 1 });
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30000);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') { setClock(Date.now()); void client.invalidateQueries({ queryKey: ['rfs-incidents'] }); }
    });
    return () => { clearInterval(timer); sub.remove(); };
  }, [client]);
  useEffect(() => {
    if (!ready || !settings.notifications) return;
    const run = () => { checkForChanges().then(() => setMonitorError('')).catch(error => setMonitorError(error instanceof Error ? error.message : 'The on-device alert check failed. Check your connection.')); };
    run();
    const timer = setInterval(run, 60000);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') run(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [ready, settings, trip]);
  async function saveSettings(update: Partial<Settings>) {
    if (!ready || storageError) throw new Error(storageError || 'Preferences are still loading.');
    const next = { ...settings, ...update };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    setSettings(next);
  }
  async function saveTrip(next: Trip | null) {
    if (!ready || storageError) throw new Error(storageError || 'Preferences are still loading.');
    if (next) await AsyncStorage.setItem(TRIP_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(TRIP_KEY);
    setTrip(next);
  }
  const nearby = (feed.data?.incidents ?? []).filter(i => settings.home && distance(settings.home, i) <= settings.radius)
    .sort((a, b) => b.severity - a.severity || distance(settings.home!, a) - distance(settings.home!, b));
  const isStale = !feed.data || clock - feed.data.fetchedAt > 5 * 60000 || feed.isError;
  return { settings, trip: isCurrentTrip(trip) ? trip : null, ready, storageError, monitorError, saveSettings, saveTrip, feed, nearby, isStale };
};
type CompanionValue = ReturnType<typeof useCompanionValue>;
const CompanionContext = createContext<CompanionValue | null>(null);
export function CompanionProvider({ children }: { children: ReactNode }) {
  const value = useCompanionValue();
  return <CompanionContext.Provider value={value}>{value.ready ? children : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.background }}><ActivityIndicator color={colors.light.primary} /></View>}</CompanionContext.Provider>;
}
export function useCompanion() {
  const context = useContext(CompanionContext);
  if (!context) throw new Error('CompanionProvider is required.');
  return context;
}
