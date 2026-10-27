import React from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';
import { useGetCompanionFireDistrict, getGetCompanionFireDistrictQueryKey } from '@workspace/api-client-react';
import { useCompanion } from '@/contexts/CompanionContext';
import { useColors } from '@/hooks/useColors';
import { Button, Notice, Screen, ui } from '@/components/BrandUI';

export default function FireDanger() {
  const c = useColors();
  const { feeds, activeWatch, fireLocation } = useCompanion();
  const point = activeWatch?.place ?? fireLocation;
  const params = { latitude: point?.latitude ?? 0, longitude: point?.longitude ?? 0 };
  const match = useGetCompanionFireDistrict(params, { query: {
    queryKey: getGetCompanionFireDistrictQueryKey(params), enabled: !!point, staleTime: 30 * 60000, retry: 1,
  } });
  const data = feeds.data?.fireRatings;
  const matchedName = match.data?.district;
  return <Screen back refreshControl={<RefreshControl refreshing={feeds.isRefetching || match.isRefetching} onRefresh={() => { void feeds.refetch(); if (point) void match.refetch(); }} />}>
    <View style={ui.content}>
      <View><Text style={ui.label}>NSW RFS · via Alertify</Text><Text style={[ui.title, { marginTop: 6 }]}>Fire danger ratings</Text></View>
      <Text style={ui.text}>Today’s and tomorrow’s district ratings, plus total fire bans—without leaving the companion.</Text>
      {point && <Text style={ui.small}>Pin: {activeWatch?.label ?? 'Current location'} · {point.name}{point.detail ? `, ${point.detail}` : ''}</Text>}
      {fireLocation && !activeWatch && <Text style={ui.small}>Your device location is used for this match and remains temporary. It is only saved if you add a watch address.</Text>}
      {match.isPending && point && <View style={ui.row}><ActivityIndicator color={c.primary} /><Text style={ui.small}>Matching this pin to Alertify’s NSW council boundaries…</Text></View>}
      {!!matchedName && <Notice>{match.data?.status === 'stale' ? 'Last-known district match. ' : ''}This pin is in {match.data?.lga} → {matchedName}. The match uses Alertify’s NSW LGA boundaries and the same council-to-fire-district mapping as its map.</Notice>}
      {match.data?.status === 'ambiguous' && <Notice error>{match.data.error} Ratings below are shown for NSW, but no pin-specific rating is guessed.</Notice>}
      {match.data?.status === 'outside_nsw' && <Notice error>This pin is outside NSW. These are NSW RFS ratings and do not cover your location.</Notice>}
      {match.data?.status === 'unavailable' && <Notice error>Alertify could not match this pin to a current fire-weather district. Ratings below are still available for browsing. {match.data.error}</Notice>}
      {(match.data?.status === 'stale' || match.isError || feeds.isError || data?.status !== 'live') && !feeds.isPending && <Notice error>{match.isError ? 'Unable to verify this pin’s district.' : feeds.isError ? 'Unable to refresh Alertify fire ratings.' : data?.error || match.data?.error || 'Fire ratings may be out of date.'} Any retained ratings are last-known values, not verified current.</Notice>}
      <Button title="Refresh ratings and pin match" icon="refresh-cw" secondary busy={feeds.isRefetching || match.isRefetching} onPress={() => { void feeds.refetch(); if (point) void match.refetch(); }} />
      {!point && <Notice>Add a watch address to show its pin-specific rating on Home, or use the Home tile’s current-location option. You can browse every NSW district below.</Notice>}
      {data?.districts.map(d => <View key={d.name} style={[ui.card, { borderColor: matchedName === d.name ? c.primary : c.border, borderWidth: matchedName === d.name ? 2 : 1 }]} testID={`district-${d.name}`}>
        <View style={ui.spread}><Text style={ui.h2}>{d.name}</Text>{matchedName === d.name && <Text style={[ui.label, { color: c.primary }]}>PIN MATCH</Text>}</View>
        <View style={ui.spread}><View><Text style={ui.label}>Today</Text><Text style={[ui.title, { marginTop: 7, fontSize: 22, color: /extreme|catastrophic/i.test(d.today) ? c.destructive : /high/i.test(d.today) ? c.warning : c.accentForeground }]}>{d.today}</Text></View><View><Text style={ui.label}>Tomorrow</Text><Text style={[ui.h2, { marginTop: 7 }]}>{d.tomorrow}</Text></View></View>
        <Text style={[ui.text, { color: d.totalFireBan ? c.destructive : c.foreground }]}>{d.totalFireBan === null ? 'Total fire ban status not supplied' : d.totalFireBan ? 'TOTAL FIRE BAN TODAY' : 'No total fire ban reported today'}</Text>
        <Text style={ui.small}>Councils: {d.councils.join(', ')}</Text>
        <Text style={ui.small}>Checked by source: {d.checkedAt || 'Not supplied'} · NSW time</Text>
      </View>)}
      <Text style={ui.small}>Source: NSW RFS Fire Danger Ratings and Total Fire Bans via Alertify. Source generated: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'Not supplied'}.</Text>
      <Notice>“No Rating” does not mean there is no fire risk. Ratings are district-wide and can change. Always follow emergency warnings and local fire restrictions.</Notice>
    </View>
  </Screen>;
}
