import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Screen, openUrl, ui } from '@/components/BrandUI';
import { fonts } from '@/constants/colors';
import { useColors } from '@/hooks/useColors';
import { privacyPolicy } from '@/lib/privacy-policy';

export default function PrivacyPolicyScreen() {
  const c = useColors();

  return (
    <Screen back>
      <View style={ui.content}>
        <View style={{ gap: 7 }}>
          <Text style={ui.label}>Alertify.au Companion</Text>
          <Text style={ui.title}>Privacy policy</Text>
          <Text style={ui.small}>Last updated {privacyPolicy.updatedAt}</Text>
        </View>
        <Button title="View online privacy policy" icon="external-link" secondary onPress={() => void openUrl(privacyPolicy.url)} />

        {privacyPolicy.sections.map(section => (
          <View key={section.title} style={ui.card}>
            <Text style={ui.h2}>{section.title}</Text>
            {section.paragraphs.map((paragraph, index) => (
              <Text key={index} style={ui.text}>{paragraph}</Text>
            ))}
            {'links' in section && section.links.map(link => (
              <Pressable
                key={link.url}
                accessibilityRole="link"
                accessibilityLabel={`Open ${link.label}`}
                onPress={() => void openUrl(link.url)}
                style={{ paddingVertical: 4 }}
              >
                <Text style={{ color: c.primary, fontFamily: fonts.bold, fontSize: 13 }}>
                  {link.label} ↗
                </Text>
              </Pressable>
            ))}
          </View>
        ))}

        <View style={ui.card}>
          <Text style={ui.h2}>Privacy contact</Text>
          <Pressable accessibilityRole="link" onPress={() => void openUrl('mailto:support@ignisse.app')}>
            <Text style={{ color: c.primary, fontFamily: fonts.bold, fontSize: 14 }}>
              support@ignisse.app
            </Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => void openUrl('https://alertify.au')}>
            <Text style={{ color: c.primary, fontFamily: fonts.bold, fontSize: 14 }}>
              alertify.au
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
