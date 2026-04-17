import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { AuthScreen } from './src/screens/AuthScreen';
import { palette } from './src/components/uiAirbnb';
import { OwnerWorkspaceV2 } from './src/screens/OwnerWorkspaceV2';
import { TenantWorkspaceV2 } from './src/screens/TenantWorkspaceV2';
import { useRentAppModel } from './src/state/useRentAppModel';

export default function App() {
  const { state, actions } = useRentAppModel();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.appShell}>
        {!state.session.role ? (
          <AuthScreen
            onLogin={actions.login}
            isBusy={state.isSyncing}
            backendError={state.backendError}
          />
        ) : state.session.role === 'owner' ? (
          <OwnerWorkspaceV2 state={state} actions={actions} onLogout={actions.logout} />
        ) : (
          <TenantWorkspaceV2 state={state} actions={actions} onLogout={actions.logout} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  appShell: {
    flex: 1,
    backgroundColor: palette.background,
  },
});
