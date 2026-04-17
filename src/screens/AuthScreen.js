import React, { useState } from 'react';
import { Text, View } from 'react-native';

import {
  Banner,
  ChoiceChips,
  Field,
  FeatureCard,
  PageHeader,
  palette,
  PrimaryButton,
  ScreenSurface,
  SectionCard,
} from '../components/uiAirbnb';

const AUTH_IMAGE =
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80';

export function AuthScreen({ onLogin, isBusy = false, backendError = null }) {
  const [role, setRole] = useState('owner');
  const [phone, setPhone] = useState('9000000000');
  const [otp, setOtp] = useState('123456');
  const [step, setStep] = useState('request');
  const [message, setMessage] = useState(null);

  const roleOptions = [
    { label: 'Landlord', value: 'owner', meta: 'Collections, residents, and property setup.' },
    { label: 'Tenant', value: 'tenant', meta: 'Rent payment, agreement, and stay details.' },
  ];

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setPhone(nextRole === 'owner' ? '9000000000' : '9000000001');
    setOtp('123456');
    setStep('request');
    setMessage(null);
  };

  const handleRequestOtp = () => {
    if (phone.trim().length !== 10) {
      setMessage({ tone: 'danger', text: 'Enter a valid 10-digit mobile number to continue.' });
      return;
    }

    setStep('verify');
    setMessage({
      tone: 'info',
      text: 'Demo mode is on. Use OTP 123456 to continue.',
    });
  };

  const handleLogin = async () => {
    if (otp !== '123456') {
      setMessage({ tone: 'danger', text: 'Use OTP 123456 for this demo.' });
      return;
    }

    try {
      await onLogin(role, phone);
      setMessage(null);
    } catch (error) {
      setMessage({ tone: 'danger', text: error.message });
    }
  };

  return (
    <ScreenSurface>
      <PageHeader
        eyebrow="Rent OS"
        title="Choose the stay side you want to enter"
        subtitle="Landlords manage rooms and collections. Tenants see rent, agreement, and stay details without the clutter."
        highlights={['Demo OTP 123456', 'Role-based flow', 'Airbnb-inspired surfaces']}
      />

      <FeatureCard
        imageUri={AUTH_IMAGE}
        eyebrow={role === 'owner' ? 'Landlord preview' : 'Tenant preview'}
        title={role === 'owner' ? 'Run the property calmly' : 'See only what matters for your stay'}
        description={
          role === 'owner'
            ? 'Move-ins, bills, and approvals stay together so the property never feels like an admin tool.'
            : 'Rent, profile, and agreement live in one clear flow designed for residents.'
        }
        badges={role === 'owner' ? ['Collections', 'Residents', 'Profile'] : ['Overview', 'Rent', 'Stay']}
      />

      {message ? <Banner tone={message.tone} message={message.text} /> : null}
      {backendError ? <Banner tone="danger" message={backendError} /> : null}
      {isBusy ? <Banner tone="info" message="Connecting to your workspace..." /> : null}

      <SectionCard
        title="Start with your role"
        subtitle="Pick the experience you want to preview, then use the matching demo number."
        tone="soft"
      >
        <ChoiceChips options={roleOptions} value={role} onChange={handleRoleChange} />
        <Field
          label="Mobile number"
          value={phone}
          onChangeText={setPhone}
          placeholder="10-digit phone number"
          keyboardType="phone-pad"
        />
        {step === 'verify' ? (
          <Field
            label="OTP"
            value={otp}
            onChangeText={setOtp}
            placeholder="123456"
            keyboardType="numeric"
          />
        ) : null}
        <PrimaryButton
          label={step === 'request' ? 'Get OTP' : isBusy ? 'Signing in...' : 'Enter workspace'}
          onPress={step === 'request' ? handleRequestOtp : handleLogin}
          disabled={isBusy}
        />
        <View style={{ gap: 6 }}>
          <Text style={{ color: palette.muted, lineHeight: 22 }}>
            Landlord demo: <Text style={{ fontWeight: '700', color: palette.ink }}>9000000000</Text>
          </Text>
          <Text style={{ color: palette.muted, lineHeight: 22 }}>
            Tenant demos: <Text style={{ fontWeight: '700', color: palette.ink }}>9000000001</Text> and{' '}
            <Text style={{ fontWeight: '700', color: palette.ink }}>9000000002</Text>
          </Text>
        </View>
      </SectionCard>
    </ScreenSurface>
  );
}
