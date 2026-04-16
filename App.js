import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { AuthScreen } from './src/screens/AuthScreen';
import { OwnerWorkspace } from './src/screens/OwnerWorkspace';
import { TenantWorkspace } from './src/screens/TenantWorkspace';
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
          <OwnerWorkspace state={state} actions={actions} onLogout={actions.logout} />
        ) : (
          <TenantWorkspace state={state} actions={actions} onLogout={actions.logout} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6efe4',
  },
  appShell: {
    flex: 1,
    backgroundColor: '#f6efe4',
  },
});
