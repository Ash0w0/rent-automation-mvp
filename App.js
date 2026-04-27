import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View, Text } from 'react-native';

import { AuthScreen } from './src/screens/AuthScreen';
import { Banner, palette } from './src/components/uiAirbnb';
import { OwnerWorkspaceMobile } from './src/screens/OwnerWorkspaceMobile';
import { TenantWorkspaceMobile } from './src/screens/TenantWorkspaceMobile';
import { useRentAppModel } from './src/state/useRentAppModel';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="light" />
          <View style={styles.appShell}>
            <View style={styles.errorWrap}>
              <Banner
                tone="danger"
                message={this.state.error?.message || 'The app hit an unexpected error.'}
              />
            </View>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const { state, actions } = useRentAppModel();

  if (!state || state.isHydrating) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AppErrorBoundary>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.appShell}>
          {!state.session.role ? (
            <AuthScreen
              onLogin={actions.login}
              onRequestOtp={actions.requestOtp}
              isBusy={state.isSyncing}
              backendError={state.backendError}
            />
          ) : state.session.role === 'owner' ? (
            <OwnerWorkspaceMobile state={state} actions={actions} onLogout={actions.logout} />
          ) : (
            <TenantWorkspaceMobile state={state} actions={actions} onLogout={actions.logout} />
          )}
        </View>
      </SafeAreaView>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.backgroundWarm,
  },
  appShell: {
    flex: 1,
    backgroundColor: palette.backgroundWarm,
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
