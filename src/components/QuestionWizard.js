import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Field, PrimaryButton, palette } from './uiAirbnb';
import { spring as springTokens } from '../lib/motion';

export function QuestionWizard({ steps, onComplete, onExit, isBusy = false }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [values, setValues] = useState(() =>
    Object.fromEntries(steps.map((s) => [s.key, s.defaultValue ?? ''])),
  );
  const [error, setError] = useState(null);
  const fieldRef = useRef(null);

  const opacity = useSharedValue(1);
  const translateX = useSharedValue(0);

  const currentStep = steps[currentIndex];
  const isLast = currentIndex === steps.length - 1;

  useEffect(() => {
    const timer = setTimeout(() => fieldRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [currentIndex]);

  function animateTransition(direction, callback) {
    const outX = direction === 'forward' ? -30 : 30;
    const inX = direction === 'forward' ? 30 : -30;
    opacity.value = withTiming(0, { duration: 150 });
    translateX.value = withTiming(outX, { duration: 150 }, () => {
      translateX.value = inX;
      callback();
      opacity.value = withTiming(1, { duration: 180 });
      translateX.value = withSpring(0, springTokens.gentle);
    });
  }

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  function goNext() {
    const val = values[currentStep.key];
    if (currentStep.validate) {
      const msg = currentStep.validate(val);
      if (msg) { setError(msg); return; }
    } else if (currentStep.required !== false && !String(val).trim()) {
      setError(`${currentStep.question} is required.`);
      return;
    }
    setError(null);

    if (isLast) {
      onComplete(values);
      return;
    }
    animateTransition('forward', () => setCurrentIndex((i) => i + 1));
  }

  function goBack() {
    if (currentIndex === 0) { onExit?.(); return; }
    setError(null);
    animateTransition('backward', () => setCurrentIndex((i) => i - 1));
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Progress dots */}
      <View style={styles.dots}>
        {steps.map((_, idx) => (
          <View
            key={idx}
            style={[styles.dot, idx === currentIndex && styles.dotActive, idx < currentIndex && styles.dotDone]}
          />
        ))}
      </View>

      <Animated.View style={[styles.card, cardStyle]}>
        {/* Step counter */}
        <Text style={styles.stepCount}>
          Step {currentIndex + 1} of {steps.length}
        </Text>

        {/* Question */}
        <Text style={styles.question}>{currentStep.question}</Text>
        {currentStep.helper ? <Text style={styles.helper}>{currentStep.helper}</Text> : null}

        {/* Input */}
        <Field
          ref={fieldRef}
          label=""
          value={values[currentStep.key]}
          onChangeText={(v) => {
            setValues((prev) => ({ ...prev, [currentStep.key]: v }));
            if (error) setError(null);
          }}
          placeholder={currentStep.placeholder ?? ''}
          keyboardType={currentStep.keyboardType ?? 'default'}
          multiline={currentStep.multiline ?? false}
          returnKeyType={isLast ? 'done' : 'next'}
          onSubmitEditing={goNext}
          blurOnSubmit={isLast}
          error={error}
        />
      </Animated.View>

      {/* Navigation */}
      <View style={styles.nav}>
        <Pressable onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{currentIndex === 0 ? 'Exit' : '← Back'}</Text>
        </Pressable>
        <View style={styles.nextWrap}>
          <PrimaryButton
            label={isLast ? 'Finish' : 'Next →'}
            onPress={goNext}
            loading={isBusy && isLast}
            disabled={isBusy && isLast}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 24,
  },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.border,
  },
  dotActive: { backgroundColor: palette.accent, width: 20 },
  dotDone: { backgroundColor: palette.accentDeep },
  card: { gap: 10 },
  stepCount: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  question: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: -0.3,
    lineHeight: 34,
  },
  helper: {
    fontSize: 14,
    color: palette.inkSoft,
    lineHeight: 21,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.muted,
  },
  nextWrap: { flex: 1 },
});
