import React, { useState } from 'react';
import { Text, View } from 'react-native';

import {
  Banner,
  ChoiceChips,
  Field,
  PageHeader,
  PrimaryButton,
  ScreenSurface,
  SectionCard,
} from '../components/ui';

export function AuthScreen({ onLogin, isBusy = false, backendError = null }) {
  const [role, setRole] = useState('owner');
  const [phone, setPhone] = useState('9000000000');
  const [otp, setOtp] = useState('123456');
  const [step, setStep] = useState('request');
  const [message, setMessage] = useState(null);

  const roleOptions = [
    { label: 'Owner', value: 'owner', meta: 'Use 9000000000 for the seeded admin account.' },
    { label: 'Tenant', value: 'tenant', meta: 'Try 9000000001 or 9000000002 for the tenant portal.' },
  ];

  const handleRequestOtp = () => {
    if (phone.trim().length !== 10) {
      setMessage({ tone: 'danger', text: 'Enter a 10-digit phone number to continue.' });
      return;
    }

    setStep('verify');
    setMessage({
      tone: 'info',
      text: 'Demo mode is active. Use OTP 123456 to enter the app.',
    });
  };

  const handleLogin = async () => {
    if (otp !== '123456') {
      setMessage({ tone: 'danger', text: 'Use OTP 123456 in this demo app.' });
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
        eyebrow="Rent automation"
        title="Owner and tenant workflows in one mobile app"
        subtitle="This seeded MVP lets you test onboarding, room setup, monthly billing, UPI collection, payment proof review, reminders, and move-out from a single codebase."
      /> 

      {message ? <Banner tone={message.tone} message={message.text} /> : null}
      {backendError ? <Banner tone="danger" message={backendError} /> : null}
      {isBusy ? <Banner tone="info" message="Connecting to the rent backend..." /> : null}

      <SectionCard
        title="Choose your portal"
        subtitle="The owner manages the PG; the tenant sees contract, invoices, reminders, and payment history."
      >
        <ChoiceChips options={roleOptions} value={role} onChange={setRole} />
        <Field
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          placeholder="10-digit phone number"
          keyboardType="phone-pad"
        />
        {step === 'verify' ? (
          <Field
            label="One-time password"
            value={otp}
            onChangeText={setOtp}
            placeholder="123456"
            keyboardType="numeric"
          />
        ) : null}
        <PrimaryButton
          label={step === 'request' ? 'Send OTP' : isBusy ? 'Connecting...' : 'Verify and enter'}
          onPress={step === 'request' ? handleRequestOtp : handleLogin}
          disabled={isBusy}
        />
        <View style={{ gap: 6 }}>
          <Text style={{ color: '#66756d', lineHeight: 20 }}>
            Demo owner login: <Text style={{ fontWeight: '700', color: '#19231f' }}>9000000000</Text>
          </Text>
          <Text style={{ color: '#66756d', lineHeight: 20 }}>
            Demo tenant logins: <Text style={{ fontWeight: '700', color: '#19231f' }}>9000000001</Text> and{' '}
            <Text style={{ fontWeight: '700', color: '#19231f' }}>9000000002</Text>
          </Text>
        </View>
      </SectionCard>
    </ScreenSurface>
  );
}
