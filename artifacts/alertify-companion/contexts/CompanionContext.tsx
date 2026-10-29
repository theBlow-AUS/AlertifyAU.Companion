import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Platform, View } from 'react-native';
import colors from '@/constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { defaultSettings, normalizeSettings, SETTINGS_KEY, TRIP_KEY, FEED_KEY, type Settings, type WatchAddress, type Trip, type Feed, type Place, distance, isCurrentTrip } from '@/lib/model';
import { useGetCompanionFeeds, getGetCompanionFeedsQueryKey } from '@workspace/api-client-react';
import { fetchFeed } from '@/lib/services';
import { checkForChanges } from '@/lib/monitor';
import { stopTripBackgroundLocation, syncTripBackgroundLocation } from '@/lib/location';

const useCompanionValue = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [fireLocation, setFireLocation] = useState<Place | null>(null);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [monitorError, setMonitorError] = useState('');
  const [clock, setClock] = useState(Date.now());
  const settingsRef = useRef(defaultSettings);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
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
        const normalized = normalizeSettings(s);
        const migrated = isCurrentTrip(t) ? normalized : { ...normalized, tripBackgroundLocation: false };
        if (migrated.tripBackgroundLocation !== normalized.tripBackgroundLocation) {
          await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(migrated));
        }
        settingsRef.current = migrated;
        setSettings(migrated); setTrip(isCurrentTrip(t) ? t : null);
        if (cache?.incidents && cache.fetchedAt) client.setQueryData(['rfs-incidents'], cache, { updatedAt: cache.fetchedAt });
      } catch { if (!cancelled) setStorageError('Saved preferences could not be loaded. Please reopen the app before changing settings.'); }
      finally { if (!cancelled) setReady(true); }
    })();
    return () => { cancelled = true; };
  }, [client]);
  const feed = useQuery({ queryKey: ['rfs-incidents'], queryFn: fetchFeed, enabled: ready, refetchInterval: 60000, staleTime: 30000, retry: 1 });
  const feeds = useGetCompanionFeeds({ query: { queryKey: getGetCompanionFeedsQueryKey(), enabled: ready, refetchInterval: 120000, staleTime: 60000, retry: 1 } });
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30000);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') { setClock(Date.now()); void client.invalidateQueries({ queryKey: ['rfs-incidents'] }); void feeds.refetch(); }
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
  useEffect(() => {
    if (!ready || Platform.OS === 'web') return;
    const enabled = settings.notifications && settings.currentLocationAlerts && settings.tripBackgroundLocation && isCurrentTrip(trip);
    void syncTripBackgroundLocation(enabled).catch(error => setMonitorError(error instanceof Error ? error.message : 'Trip Watch background location could not start.'));
  }, [ready, settings.notifications, settings.currentLocationAlerts, settings.tripBackgroundLocation, trip?.startedAt]);
  async function saveSettings(update: Partial<Settings> | ((current: Settings) => Partial<Settings>)) {
    if (!ready || storageError) throw new Error(storageError || 'Preferences are still loading.');
    const operation = saveQueue.current.catch(() => undefined).then(async () => {
      const current = settingsRef.current;
      const patch = typeof update === 'function' ? update(current) : update;
      const next = normalizeSettings({ ...current, ...patch });
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      settingsRef.current = next;
      setSettings(next);
    });
    saveQueue.current = operation;
    await operation;
  }
  async function saveWatch(watch: WatchAddress) {
    await saveSettings(current => ({
      watches: current.watches.some(w => w.id === watch.id) ? current.watches.map(w => w.id === watch.id ? watch : w) : [...current.watches, watch],
      activeWatchId: watch.id,
    }));
  }
  async function deleteWatch(id: string) {
    await saveSettings(current => ({ watches: current.watches.filter(w => w.id !== id) }));
  }
  async function saveTrip(next: Trip | null) {
    if (!ready || storageError) throw new Error(storageError || 'Preferences are still loading.');
    if (!next) {
      await stopTripBackgroundLocation();
      if (settingsRef.current.tripBackgroundLocation) await saveSettings({ tripBackgroundLocation: false });
    }
    if (next) await AsyncStorage.setItem(TRIP_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(TRIP_KEY);
    setTrip(next);
  }
  const nearby = (feed.data?.incidents ?? []).filter(i => settings.home && distance(settings.home, i) <= settings.radius)
    .sort((a, b) => b.severity - a.severity || distance(settings.home!, a) - distance(settings.home!, b));
  const isStale = !feed.data || clock - feed.data.fetchedAt > 5 * 60000 || feed.isError;
  const activeWatch = settings.watches.find(w => w.id === settings.activeWatchId) ?? null;
  return { settings, activeWatch, fireLocation, setFireLocation, trip: isCurrentTrip(trip) ? trip : null, ready, storageError, monitorError, saveSettings, saveWatch, deleteWatch, saveTrip, feed, feeds, nearby, isStale };
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
