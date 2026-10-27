import React from 'react';
import { ActivityIndicator, Share, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useCompanion } from '@/contexts/CompanionContext';
import { useColors } from '@/hooks/useColors';
import { Button, Diagram, Notice, Screen, openUrl, reportError, ui } from '@/components/BrandUI';
import { distance, RFS_URL, timeAgo } from '@/lib/model';

export default function IncidentDetail() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { feed, settings, isStale } = useCompanion();
  const incident = feed.data?.incidents.find(i => i.id === id);
  if (!incident) return <Screen back><View style={ui.content}><Text style={ui.title}>Incident unavailable</Text>{feed.isPending ? <ActivityIndicator color={c.primary} /> : <Text style={ui.text}>This incident is no longer in the current feed, or the feed is unavailable. Check the official source for the latest information.</Text>}<Button title="Check NSW RFS" icon="external-link" onPress={() => void openUrl(RFS_URL)} /><Button title="Refresh feed" secondary onPress={() => void feed.refetch()} /></View></Screen>;
  const home = settings.home;
  async function share() {
    try { await Share.share({ message: `${incident!.title}\n${incident!.category} · ${incident!.type}\n${incident!.location}\nUpdated by RFS: ${incident!.updated}\nCheck current official advice: ${RFS_URL}\nShared with Alertify.au Companion. Proximity is not an evacuation instruction.` }); }
    catch (e) { reportError(e); }
  }
  return <Screen back><View style={ui.content}>
    <Diagram points={home ? [home, incident] : [incident]} />
    <Text style={[ui.label, { color: incident.severity >= 2 ? c.destructive : c.warning }]}>{incident.category} · {incident.type}</Text>
    <Text style={ui.title}>{incident.title}</Text>
    <Text style={ui.small}>{incident.location}{home ? `\n${distance(home, incident).toFixed(1)} km from your saved home` : ''}</Text>
    {isStale && <Notice error>The feed is stale or could not be refreshed. Do not rely on this cached incident status.</Notice>}
    <Notice>Alertify proximity context: distance is measured to the reported incident point, not its perimeter. Being nearby is not an instruction to evacuate. Follow current official advice.</Notice>
    <View style={ui.card}><Text style={ui.label}>Official RFS alert level</Text><Text style={[ui.h2, { fontSize: 20 }]}>{incident.category}</Text><Text style={ui.text}>Status: {incident.status}</Text><Text style={ui.small}>Updated by source: {incident.updated}{'\n'}Feed fetched: {feed.data ? timeAgo(feed.data.fetchedAt) : 'Unavailable'}</Text><Button title="Check NSW RFS source" icon="external-link" onPress={() => void openUrl(incident.sourceUrl)} /></View>
    <View style={{ gap: 10 }}><Text style={ui.h2}>Report details</Text><View style={ui.card}><Text style={ui.text}>{incident.description}</Text></View></View>
    <Button title="Open incident location in Maps" icon="map" secondary onPress={() => void openUrl(`https://www.google.com/maps/search/?api=1&query=${incident.latitude},${incident.longitude}`)} />
    <Button title="Share incident" icon="share-2" secondary onPress={() => void share()} />
    <Text style={ui.small}>Call 000 in an emergency. Alertify is an independent companion, not an emergency authority.</Text>
  </View></Screen>;
}
