import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { AuthScreen } from './src/screens/AuthScreen';
import { palette } from './src/components/uiAirbnb';
import { OwnerWorkspaceMobile } from './src/screens/OwnerWorkspaceMobile';
import { TenantWorkspaceMobile } from './src/screens/TenantWorkspaceMobile';
import { useRentAppModel } from './src/state/useRentAppModel';

export default function App() {
  const { state, actions } = useRentAppModel();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.appShell}>
        {!state.session.role ? (
          <AuthScreen
            onLogin={actions.login}
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
});
