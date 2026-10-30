import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { getGetCompanionWeatherQueryKey, useGetCompanionWeather } from '@workspace/api-client-react';
import { Button, Notice, ui } from '@/components/BrandUI';
import { type RouteEstimate, type WatchAddress } from '@/lib/model';
import { eventInScope, routeSamples } from '@/lib/weather-geometry';
import { useColors } from '@/hooks/useColors';
import RadarMap from './RadarMap';

const display = (n: number | null | undefined, unit: string) => n === null || n === undefined ? 'Not supplied' : `${n.toFixed(1)} ${unit}`;
const highest = (values: (number | null)[]) => { const ns = values.filter((n): n is number => n !== null); return ns.length ? Math.max(...ns) : null; };
const time = (value: string) => value ? new Date(value).toLocaleString() : 'Not supplied';
export function WeatherAssessment({ watch, route, detailed = false }: { watch?: WatchAddress | null; route?: RouteEstimate | null; detailed?: boolean }) {
  const c = useColors();
  const [details, setDetails] = useState(detailed);
  const [showRadar, setShowRadar] = useState(false);
  const [, tick] = useState(0);
  const points = useMemo(() => route ? routeSamples(route.coordinates) : watch ? [{ latitude: watch.place.latitude, longitude: watch.place.longitude }] : [], [route, watch]);
  const params = { points: points.map(p => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`).join(';') };
  const weather = useGetCompanionWeather(params, { query: { queryKey: getGetCompanionWeatherQueryKey(params), enabled: !!points.length, refetchInterval: 120000, staleTime: 60000, retry: 1 } });
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active' && points.length) void weather.refetch(); });
    const clock = setInterval(() => tick(n => n + 1), 60000);
    return () => { listener.remove(); clearInterval(clock); };
  }, [params.points]);
  const radius = route ? 5 : watch?.radius ?? 10;
  const data = weather.data;
  const events = (data?.events ?? []).filter(e => (!e.validTo || Date.parse(e.validTo) >= Date.now()) && (e.kind !== 'lightning' || Date.now() - Date.parse(e.validFrom) <= 60 * 60000) && eventInScope(e, watch?.place ?? null, route?.coordinates ?? null, radius));
  const old = !!data && (weather.isError || Date.now() - Date.parse(data.fetchedAt) > 5 * 60000);
  const wind = highest(data?.samples.map(s => s.windGustKph) ?? []);
  const rain = highest(data?.samples.map(s => s.rainPeakMmH) ?? []);
  if (!points.length) return <Notice>Add a watch address or calculate a trip to check Xweather and radar at that location.</Notice>;
  return <View style={{ gap: 12 }} testID="weather-assessment">
    <Text style={ui.h2}>{route ? 'Weather along this route estimate' : `Weather around ${watch?.label}`}</Text>
    <Text style={ui.small}>{route ? `${points.length} distance-spaced query points · 5 km route corridor` : `${radius} km watch zone`}. Optional on-device alerts for selected Xweather sources are controlled in Watch preferences.</Text>
    {weather.isPending && <><ActivityIndicator color={c.primary} /><Text style={ui.small}>Checking Alertify’s Xweather sources and RainViewer…</Text></>}
    {(weather.isError || old) && <Notice error>Weather could not be verified as current. Retained data, if shown, must not be treated as a current assessment.</Notice>}
    {data?.sources.map(s => <View key={s.id} style={ui.card}>
       <View style={ui.spread}><Text style={[ui.h2, { flex: 1 }]}>{s.name}</Text><Text style={[ui.label, { color: old || s.freshness?.status !== 'current' ? c.warning : c.success }]}>{old ? 'STALE' : (s.freshness?.status ?? 'unavailable').toUpperCase()}{s.status === 'partial' ? ' · PARTIAL' : ''}</Text></View>
      <Text style={ui.text}>{s.status === 'unavailable' ? 'Source unavailable—not an all-clear.' : s.id === 'lightning' ? `${events.filter(e => e.kind === 'lightning').length} returned strikes within ${radius} km · last 60 minutes` : s.id === 'hail' ? `${events.filter(e => e.kind === 'hail').length} forecast areas/periods intersect this ${route ? 'corridor' : 'zone'}` : s.id === 'wind' ? `Highest returned gust: ${display(wind, 'km/h')}` : `Highest returned rain rate: ${display(rain, 'mm/h')}`}</Text>
      {(s.status !== 'live' || s.error) && <Text style={[ui.small, { color: c.warning }]}>{s.error} Returned for {s.availablePoints}/{s.requestedPoints} query points.</Text>}
      <Text style={ui.small}>Source time: {time(s.fetchedAt)}</Text>
    </View>)}
    {data && <View style={ui.card}><View style={ui.spread}><Text style={ui.h2}>Live weather radar</Text><Text style={ui.label}>{old ? 'STALE' : data.radar.status.toUpperCase()}</Text></View><Text style={ui.small}>RainViewer · latest frame: {data.radar.frames.length ? new Date(data.radar.frames.at(-1)!.time * 1000).toLocaleString() : 'Unavailable'}</Text>{data.radar.error && <Notice error>{data.radar.error}</Notice>}<Button title={showRadar ? 'Close radar' : 'Show radar in app'} secondary icon="map" disabled={!data.radar.frames.length} onPress={() => setShowRadar(!showRadar)} testID="show-weather-radar" /></View>}
    {showRadar && data?.radar.frames.length ? <><RadarMap radar={data.radar} points={points} coordinates={route?.coordinates ?? null} radius={radius} events={events} /><Text style={ui.small}>Blue: watch zone/estimated route and query points. Amber: lightning. Coral: hail forecast polygons. Radar is the latest available imagery, not continuous live coverage; blank areas do not establish no rain.</Text></> : null}
    {route && <Notice error={points.length > 1 && route.distance / (points.length - 1) > 200}>Wind and rain are point samples, not continuous corridor coverage or forecasts matched to your arrival time. {points.length > 1 ? `Approximately ${Math.round(route.distance / (points.length - 1))} km between query points along the route. ` : ''}Lightning/hail are retrieved around these points (Alertify’s current query radii: 100/300 km), then filtered against the full route. Gaps, source limits and changes after checking can miss hazards. No automatic rerouting.</Notice>}
    {!route && <Notice>Lightning and hail are matched to the watch-zone radius. Wind and rain are sampled at the saved address point, not across the entire zone; conditions elsewhere in the zone can differ.</Notice>}
    {(wind !== null && wind >= 60 || rain !== null && rain >= 10) && <Notice error>Elevated sampled conditions: {wind !== null && wind >= 60 ? 'gusts at or above 60 km/h. ' : ''}{rain !== null && rain >= 10 ? 'rain rates at or above 10 mm/h. ' : ''}These are app advisory thresholds, not official weather warnings.</Notice>}
    {data && <Button title={details ? 'Hide weather details' : 'Show observations & matching weather'} secondary onPress={() => setDetails(!details)} />}
    {details && data?.samples.map((s, i) => <View key={`${s.latitude},${s.longitude}`} style={ui.card}><Text style={ui.h2}>{route ? `Route sample ${i + 1}` : watch?.label}</Text><Text style={ui.small}>{s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}</Text><Text style={ui.text}>Wind {display(s.windSpeedKph, 'km/h')} {s.windDirection} · gust {display(s.windGustKph, 'km/h')}{'\n'}Current rain rate: {display(s.currentRainMmH, 'mm/h')}{'\n'}60-minute rain total: {display(s.rain60minMm, 'mm')}{'\n'}Forecast peak rate: {display(s.rainPeakMmH, 'mm/h')}</Text><Text style={ui.small}>Wind observation: {time(s.windTime)}{'\n'}Rain nowcast window: {time(s.rainTime)} → {time(s.rainEnd)}</Text></View>)}
    {details && events.slice(0, 30).map(e => <View key={e.id} style={ui.card}><Text style={ui.h2}>{e.description}</Text><Text style={ui.small}>{e.kind === 'hail' ? 'Forecast polygon intersects zone/corridor; not merely its centroid.' : `${e.latitude?.toFixed(4)}, ${e.longitude?.toFixed(4)}`}{'\n'}{e.kind === 'hail' ? 'Valid from' : 'Recorded'}: {time(e.validFrom)}{e.validTo ? `\nUntil: ${time(e.validTo)}` : ''}</Text></View>)}
    {details && events.length > 30 && <Notice>Showing the first 30 of {events.length} matching weather records. The counts and radar include all returned matching records.</Notice>}
    <Button title="Refresh weather sources" secondary icon="refresh-cw" busy={weather.isRefetching} onPress={() => void weather.refetch()} />
    <Notice>Sources: Vaisala Xweather via Alertify; radar © RainViewer; base map © OpenStreetMap contributors. Checks send the selected coordinates or route samples to these services. Selected Xweather hazards can trigger on-device alerts; radar is a display layer only. Weather assessments are advisory, not official warnings. Keep following BOM/SES instructions and never use the phone while driving.</Notice>
  </View>;
}
