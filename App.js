import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Animated, Easing, SafeAreaView, StyleSheet, View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthScreen } from './src/screens/AuthScreen';
import { Banner, palette } from './src/components/uiAirbnb';
import { ChangePasswordScreen } from './src/screens/ChangePasswordScreen';
import { OwnerWorkspaceMobile } from './src/screens/OwnerWorkspaceMobile';
import { SuperAdminWorkspace } from './src/screens/SuperAdminWorkspace';
import { TenantWorkspaceMobile } from './src/screens/TenantWorkspaceMobile';
import { ToastProvider } from './src/components/ToastHost';
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

function SyncIndicator({ visible }) {
  const progress = useRef(new Animated.Value(0)).current;
  const loop = useRef(null);

  useEffect(() => {
    if (visible) {
      progress.setValue(0);
      loop.current = Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      );
      loop.current.start();
    } else {
      if (loop.current) loop.current.stop();
      progress.setValue(0);
    }
    return () => { if (loop.current) loop.current.stop(); };
  }, [visible, progress]);

  if (!visible) return null;

  const width = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0%', '70%', '100%'] });

  return (
    <View style={styles.syncBar} pointerEvents="none">
      <Animated.View style={[styles.syncBarFill, { width }]} />
    </View>
  );
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppErrorBoundary>
        <ToastProvider>
          <SafeAreaView style={styles.safeArea}>
            <StatusBar style="dark" backgroundColor="transparent" translucent />
            <View style={styles.appShell}>
              <SyncIndicator visible={state.isSyncing} />
              {!state.session.role ? (
                <AuthScreen
                  onLogin={actions.login}
                  onForgotPasswordRequestOtp={actions.forgotPasswordRequestOtp}
                  onForgotPasswordReset={actions.forgotPasswordReset}
                  isBusy={state.isSyncing}
                  backendError={state.backendError}
                />
              ) : state.mustChangePassword ? (
                <ChangePasswordScreen
                  onChangePassword={actions.changePassword}
                  isBusy={state.isSyncing}
                  backendError={state.backendError}
                  forced
                  onLogout={actions.logout}
                />
              ) : state.session.role === 'super_admin' ? (
                <SuperAdminWorkspace state={state} actions={actions} onLogout={actions.logout} />
              ) : state.session.role === 'owner' ? (
                <OwnerWorkspaceMobile state={state} actions={actions} onLogout={actions.logout} />
              ) : (
                <TenantWorkspaceMobile state={state} actions={actions} onLogout={actions.logout} />
              )}
            </View>
          </SafeAreaView>
        </ToastProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
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
  syncBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 100,
    backgroundColor: 'rgba(0,199,168,0.2)',
  },
  syncBarFill: {
    height: 3,
    backgroundColor: '#00C7A8',
  },
});
