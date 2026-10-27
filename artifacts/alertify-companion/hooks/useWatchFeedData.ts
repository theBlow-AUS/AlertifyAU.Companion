import { useQueries } from '@tanstack/react-query';
import { getCompanionFireDistrict, getCompanionWeather, getGetCompanionWeatherQueryKey, getGetCompanionFireDistrictQueryKey } from '@workspace/api-client-react';
import type { WatchAddress } from '@/lib/model';

export function useWatchFeedData(watches: WatchAddress[], weatherEnabled: boolean, fireEnabled: boolean) {
  const points = [...new Set(watches.map(w => `${w.place.latitude.toFixed(4)},${w.place.longitude.toFixed(4)}`))];
  const batches = Array.from({ length: Math.ceil(points.length / 5) }, (_, i) => ({ points: points.slice(i * 5, i * 5 + 5).join(';') }));
  const weather = useQueries({ queries: batches.map(params => ({
    queryKey: getGetCompanionWeatherQueryKey(params), queryFn: () => getCompanionWeather(params),
    enabled: weatherEnabled, staleTime: 60000, refetchInterval: 120000, retry: 1,
  })) });
  const districts = useQueries({ queries: watches.map(w => {
    const params = { latitude: w.place.latitude, longitude: w.place.longitude };
    return {
      queryKey: getGetCompanionFireDistrictQueryKey(params), queryFn: () => getCompanionFireDistrict(params),
      enabled: fireEnabled, staleTime: 300000, refetchInterval: 300000, retry: 1,
    };
  }) });
  return {
    weather: weather.flatMap(q => q.data ? [q.data] : []),
    districts: districts.flatMap((q, index) => q.data ? [{ watchId: watches[index].id, match: q.data }] : []),
    loading: (weatherEnabled && weather.some(q => q.isPending)) || (fireEnabled && districts.some(q => q.isPending)),
    refreshing: (weatherEnabled && weather.some(q => q.isRefetching)) || (fireEnabled && districts.some(q => q.isRefetching)),
    errors: [
      ...(weatherEnabled ? weather.flatMap(q => q.isError || (q.data && Date.now() - Date.parse(q.data.fetchedAt) > 300000)
        ? ['Watch-zone weather could not be refreshed or retained data is over five minutes old.']
        : q.data?.sources.filter(s => s.status !== 'live').map(s => `${s.name}: ${s.status}. ${s.error ?? ''}`) ?? []) : []),
      ...(fireEnabled ? districts.flatMap(q => q.isError || (q.data && !['matched', 'outside_nsw'].includes(q.data.status)) ? ['A watch zone could not be matched to a current fire-danger district.'] : []) : []),
    ],
    refresh: () => { if (weatherEnabled) weather.forEach(q => void q.refetch()); if (fireEnabled) districts.forEach(q => void q.refetch()); },
  };
}
