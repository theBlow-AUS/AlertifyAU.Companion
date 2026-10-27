import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useCompanion } from '@/contexts/CompanionContext';
import { useColors } from '@/hooks/useColors';
import { errorMessage, ui } from '@/components/BrandUI';
import { currentPlace } from '@/lib/location';
import { getGetCompanionFireDistrictQueryKey, useGetCompanionFireDistrict } from '@workspace/api-client-react';

export function FireDangerTile() {
  const c = useColors();
  const { activeWatch, fireLocation, setFireLocation, feeds } = useCompanion();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const place = activeWatch?.place ?? fireLocation;
  const params = { latitude: place?.latitude ?? 0, longitude: place?.longitude ?? 0 };
  const match = useGetCompanionFireDistrict(params, { query: {
    queryKey: getGetCompanionFireDistrictQueryKey(params), enabled: !!place,
    staleTime: 30 * 60000, refetchInterval: 30 * 60000, retry: 1,
  } });
  useEffect(() => {
    let cancelled = false;
    if (activeWatch || fireLocation) return () => { cancelled = true; };
    void Location.getForegroundPermissionsAsync().then(async permission => {
      if (!permission.granted || cancelled) return;
      const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60000, requiredAccuracy: 500 });
      if (cancelled || !last || Date.now() - last.timestamp > 5 * 60000) return;
      setFireLocation({
        name: 'Current location',
        detail: `Recent device location · ±${Math.round(last.coords.accuracy ?? 500)} m`,
        latitude: last.coords.latitude, longitude: last.coords.longitude,
      });
    }).catch(() => { /* No previous location permission or usable cached fix; the tile requests it only after a tap. */ });
    return () => { cancelled = true; };
  }, [activeWatch, fireLocation, setFireLocation]);
  const rating = feeds.data?.fireRatings;
  const district = rating?.districts.find(d => d.name === match.data?.district);
  const stale = match.data?.status === 'stale' || feeds.isError || rating?.status === 'stale' || (!!rating?.fetchedAt && Date.now() - Date.parse(rating.fetchedAt) > 15 * 60000);
  const label = !place ? (locating ? 'Finding location…' : 'Use current location') :
    !match.data && (match.isPending || match.isFetching) ? 'Finding fire district…' :
    match.data?.status === 'outside_nsw' ? 'NSW ratings only' :
    match.data?.status === 'ambiguous' ? 'Near a district boundary' :
    district ? district.today : 'Rating unavailable';
  const subtitle = locationError || (stale ? 'LAST KNOWN · tap for details' :
    district ? `${match.data?.lga} · ${district.name}${district.totalFireBan ? ' · TOTAL FIRE BAN' : ''}` :
    match.data?.error || (place ? 'Tap to view all ratings' : 'Tap to check your location'));
  async function openRatings() {
    if (place) { router.push('/fire-danger'); return; }
    setLocating(true); setLocationError('');
    try {
      const current = await currentPlace();
      setFireLocation(current);
      router.push('/fire-danger');
    } catch (error) { setLocationError(errorMessage(error)); }
    finally { setLocating(false); }
  }
  return <Pressable accessibilityRole="button" accessibilityLabel={place && district ? `Fire danger at ${place.name}: ${district.today}. View all ratings.` : 'Find fire danger rating at this location and view all ratings'} accessibilityState={{ busy: locating }} onPress={() => void openRatings()} disabled={locating} style={{ flex: 1, backgroundColor: c.accent, borderRadius: 18, padding: 15, gap: 10 }} testID="fire-danger-tile">
    <View style={ui.spread}><Text style={[ui.label, { letterSpacing: 0.6 }]}>Fire danger</Text><Feather name="chevron-right" size={15} color={c.warning} /></View>
    {locating && <ActivityIndicator size="small" color={c.primary} />}
    <Text style={[ui.h2, { fontSize: 19, color: district && /extreme|catastrophic/i.test(district.today) ? c.destructive : c.accentForeground }]}>{label}</Text>
    <Text numberOfLines={3} style={[ui.small, { fontSize: 11 }]}>{subtitle}</Text>
  </Pressable>;
}
