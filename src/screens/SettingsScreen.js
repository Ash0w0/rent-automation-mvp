import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

import { ChoiceChips, SectionCard, palette, elevation } from '../components/uiAirbnb';
import { usePreferences } from '../state/PreferencesProvider';

export function SettingsScreen({ onBack }) {
  const { t } = useTranslation();
  const { language, fontScale, fontScales, setLanguage, setFontScale } = usePreferences();

  const languageOptions = [
    { value: 'en', label: t('settings.english') },
    { value: 'hi', label: t('settings.hindi') },
  ];

  const fontScaleLabels = [
    t('settings.small'),
    t('settings.default'),
    t('settings.large'),
    t('settings.xlarge'),
  ];

  const fontScaleOptions = fontScales.map((scale, index) => ({
    value: String(scale),
    label: fontScaleLabels[index],
    meta: `${Math.round(scale * 100)}%`,
  }));

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title}>{t('settings.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionCard title={t('settings.language')}>
          <ChoiceChips
            options={languageOptions}
            value={language}
            onChange={setLanguage}
          />
        </SectionCard>

        <SectionCard title={t('settings.fontSize')}>
          <ChoiceChips
            options={fontScaleOptions}
            value={String(fontScale)}
            onChange={(v) => setFontScale(parseFloat(v))}
          />
          <Text style={[styles.previewText, { fontSize: 15 * fontScale }]}>
            The quick brown fox jumps over the lazy dog.
          </Text>
        </SectionCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  header: {
    paddingHorizontal: 22,
    paddingTop: 58,
    paddingBottom: 18,
    gap: 4,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    ...elevation.e1,
  },
  backBtn: { marginBottom: 4 },
  backBtnText: { color: palette.accent, fontSize: 14, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '800', color: palette.ink, letterSpacing: -0.3 },
  content: { padding: 22, gap: 16, paddingBottom: 48 },
  previewText: {
    color: palette.inkSoft,
    lineHeight: 24,
    marginTop: 8,
  },
});
