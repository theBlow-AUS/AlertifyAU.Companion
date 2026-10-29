import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIVE_LOCATION_STATUS_KEY, type LiveLocationStatus } from './model';

export const emptyLiveLocationStatus: LiveLocationStatus = {
  lastLocationAt: null,
  lastCheckAt: null,
  error: null,
};

export async function readLiveLocationStatus(): Promise<LiveLocationStatus> {
  const saved = await AsyncStorage.getItem(LIVE_LOCATION_STATUS_KEY);
  if (!saved) return emptyLiveLocationStatus;
  try {
    const parsed = JSON.parse(saved) as Partial<LiveLocationStatus>;
    return {
      lastLocationAt: typeof parsed.lastLocationAt === 'number' ? parsed.lastLocationAt : null,
      lastCheckAt: typeof parsed.lastCheckAt === 'number' ? parsed.lastCheckAt : null,
      error: typeof parsed.error === 'string' ? parsed.error : null,
    };
  } catch {
    return emptyLiveLocationStatus;
  }
}

export async function updateLiveLocationStatus(patch: Partial<LiveLocationStatus>) {
  const current = await readLiveLocationStatus();
  await AsyncStorage.setItem(LIVE_LOCATION_STATUS_KEY, JSON.stringify({ ...current, ...patch }));
}
