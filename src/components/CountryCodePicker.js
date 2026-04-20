import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette } from './uiAirbnb';
const { COUNTRY_PHONE_OPTIONS, getCountryByDialCode } = require('../lib/countryPhone');

export function CountryCodePicker({
  dialCode,
  onDialCodeChange,
  phone,
  onPhoneChange,
  placeholder = 'Enter mobile number',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = useMemo(() => getCountryByDialCode(dialCode), [dialCode]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Mobile number</Text>
      <View style={styles.phoneField}>
        <Pressable
          onPress={() => setIsOpen((current) => !current)}
          style={({ pressed }) => [styles.trigger, pressed && styles.chipPressed]}
        >
          <Text style={styles.flag}>{selected.flag}</Text>
          <Text style={styles.triggerDial}>{selected.dialCode}</Text>
          <Text style={styles.chevron}>{isOpen ? '▲' : '▼'}</Text>
        </Pressable>
        <TextInput
          value={phone}
          onChangeText={onPhoneChange}
          placeholder={placeholder}
          placeholderTextColor={palette.mutedSoft}
          keyboardType="phone-pad"
          selectionColor={palette.accent}
          style={styles.phoneInput}
        />
      </View>
      <Text style={styles.helperText}>{selected.label}</Text>

      {isOpen ? (
        <View style={styles.dropdown}>
          <ScrollView nestedScrollEnabled style={styles.dropdownScroll}>
            {COUNTRY_PHONE_OPTIONS.map((option) => {
              const isSelected = option.iso === selected.iso;
              return (
                <Pressable
                  key={`${option.iso}-${option.dialCode}`}
                  onPress={() => {
                    onDialCodeChange(option.dialCode);
                    setIsOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.optionRow,
                    isSelected && styles.optionRowSelected,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={styles.flag}>{option.flag}</Text>
                  <Text style={[styles.optionCountry, isSelected && styles.optionCountrySelected]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.optionDialCode, isSelected && styles.optionCountrySelected]}>
                    {option.dialCode}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    color: palette.ink,
    fontWeight: '700',
    fontSize: 13,
  },
  phoneField: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 8,
    gap: 8,
  },
  trigger: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F6FBFA',
  },
  chipPressed: {
    transform: [{ scale: 0.985 }],
  },
  flag: {
    fontSize: 16,
  },
  triggerDial: {
    color: palette.ink,
    fontWeight: '800',
    fontSize: 14,
  },
  phoneInput: {
    flex: 1,
    color: palette.ink,
    fontSize: 15,
    paddingVertical: 10,
    paddingRight: 8,
  },
  chevron: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  helperText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
    paddingLeft: 2,
  },
  dropdown: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    maxHeight: 210,
    overflow: 'hidden',
  },
  dropdownScroll: {
    width: '100%',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F6F5',
  },
  optionRowSelected: {
    backgroundColor: palette.surfaceTint,
  },
  optionCountry: {
    flex: 1,
    color: palette.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  optionDialCode: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  optionCountrySelected: {
    color: palette.accentDeep,
  },
});

