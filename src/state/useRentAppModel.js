import { useEffect, useState } from 'react';

const { createSeedState } = require('../data/seed');
const {
  addRoom,
  activateTenancy,
  closeTenancy,
  completeTenantProfile,
  demoLogin,
  fetchAppState,
  generateInvoice,
  inviteTenant,
  reviewMeterReading,
  reviewPayment,
  scheduleMoveOut,
  submitMeterReading,
  submitPayment,
  updateProperty,
  updateReminderStatus,
  updateSettlement,
} = require('../lib/apiClient');

const emptySession = {
  role: null,
  phone: '',
  currentTenantId: null,
  currentOwnerId: null,
};

const isDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'false';

function createInitialState() {
  return {
    ...createSeedState(),
    session: emptySession,
    isHydrating: true,
    isSyncing: false,
    backendError: null,
    isDemoMode,
  };
}

function normalizeError(error) {
  return error instanceof Error ? error.message : 'Something went wrong while talking to the backend.';
}

function buildNextState(serverState, currentState, options = {}) {
  const preserveSession =
    options.preserveSession &&
    currentState.session?.role &&
    !serverState.session?.role;

  return {
    ...serverState,
    session: preserveSession ? currentState.session : serverState.session || emptySession,
    isHydrating: false,
    isSyncing: false,
    backendError: null,
  };
}

export function useRentAppModel() {
  const [state, setState] = useState(createInitialState);

  useEffect(() => {
    if (isDemoMode) {
      setState((currentState) => ({
        ...currentState,
        isHydrating: false,
        isSyncing: false,
        backendError: null,
      }));
      return undefined;
    }

    let active = true;

    async function hydrateState() {
      try {
        const serverState = await fetchAppState();

        if (!active) {
          return;
        }

        setState((currentState) => buildNextState(serverState, currentState));
      } catch (error) {
        if (!active) {
          return;
        }

        setState((currentState) => ({
          ...currentState,
          isHydrating: false,
          isSyncing: false,
          backendError: normalizeError(error),
        }));
      }
    }

    hydrateState();

    return () => {
      active = false;
    };
  }, []);

  async function runServerAction(task, options = {}) {
    setState((currentState) => ({
      ...currentState,
      isSyncing: true,
      backendError: null,
    }));

    try {
      const serverState = await task();

      setState((currentState) => buildNextState(serverState, currentState, options));
      return serverState;
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        isHydrating: false,
        isSyncing: false,
        backendError: normalizeError(error),
      }));

      throw error;
    }
  }

  function runDemoLogin(role, phone) {
    const normalizedPhone = String(phone || '').trim();

    if (role === 'owner') {
      if (normalizedPhone !== state.owner.phone) {
        throw new Error('Use owner demo login 9000000000 for this preview.');
      }

      setState((currentState) => ({
        ...currentState,
        session: {
          role: 'owner',
          phone: normalizedPhone,
          currentTenantId: null,
          currentOwnerId: currentState.owner.id,
        },
        isHydrating: false,
        isSyncing: false,
        backendError: null,
      }));
      return Promise.resolve();
    }

    const tenant = state.tenants.find((record) => record.phone === normalizedPhone);
    if (!tenant) {
      throw new Error('Use tenant demo login 9000000001 or 9000000002 for this preview.');
    }

    setState((currentState) => ({
      ...currentState,
      session: {
        role: 'tenant',
        phone: normalizedPhone,
        currentTenantId: tenant.id,
        currentOwnerId: null,
      },
      isHydrating: false,
      isSyncing: false,
      backendError: null,
    }));
    return Promise.resolve();
  }

  function rejectDemoAction() {
    return Promise.reject(
      new Error('This public Vercel preview is read-only. Local and backend-connected builds still support editing.'),
    );
  }

  const actions = {
    login(role, phone) {
      if (isDemoMode) {
        return runDemoLogin(role, phone);
      }

      return runServerAction(() => demoLogin(role, phone), {
        preserveSession: false,
      });
    },

    logout() {
      setState((currentState) => ({
        ...currentState,
        session: emptySession,
        isSyncing: false,
        backendError: null,
      }));
    },

    updateProperty(payload) {
      if (isDemoMode) {
        return rejectDemoAction();
      }
      return runServerAction(() => updateProperty(payload), {
        preserveSession: true,
      });
    },

    updateSettlement(payload) {
      if (isDemoMode) {
        return rejectDemoAction();
      }
      return runServerAction(() => updateSettlement(payload), {
        preserveSession: true,
      });
    },

    addRoom(payload) {
      if (isDemoMode) {
        return rejectDemoAction();
      }
      return runServerAction(() => addRoom(payload), {
        preserveSession: true,
      });
    },

    inviteTenant(payload) {
      if (isDemoMode) {
        return rejectDemoAction();
      }
      return runServerAction(() => inviteTenant(payload), {
        preserveSession: true,
      });
    },

    completeTenantProfile(input) {
      if (isDemoMode) {
        return rejectDemoAction();
      }
      const { tenantId, ...payload } = input;

      return runServerAction(() => completeTenantProfile(tenantId, payload), {
        preserveSession: true,
      });
    },

    activateTenancy(input) {
      if (isDemoMode) {
        return rejectDemoAction();
      }
      const { tenancyId, ...payload } = input;

      return runServerAction(() => activateTenancy(tenancyId, payload), {
        preserveSession: true,
      });
    },

    generateInvoice(payload) {
      if (isDemoMode) {
        return rejectDemoAction();
      }
      return runServerAction(() => generateInvoice(payload), {
        preserveSession: true,
      });
    },

    submitMeterReading(payload) {
      if (isDemoMode) {
        return rejectDemoAction();
      }
      return runServerAction(() => submitMeterReading(payload), {
        preserveSession: true,
      });
    },

    reviewMeterReading(payload) {
      if (isDemoMode) {
        return rejectDemoAction();
      }
      return runServerAction(() => reviewMeterReading(payload), {
        preserveSession: true,
      });
    },

    submitPayment(payload) {
      if (isDemoMode) {
        return rejectDemoAction();
      }
      return runServerAction(() => submitPayment(payload), {
        preserveSession: true,
      });
    },

    reviewPayment(payload) {
      if (isDemoMode) {
        return rejectDemoAction();
      }
      return runServerAction(() => reviewPayment(payload), {
        preserveSession: true,
      });
    },

    updateReminderStatus(reminderId, deliveryStatus) {
      if (isDemoMode) {
        return rejectDemoAction();
      }
      return runServerAction(() => updateReminderStatus(reminderId, deliveryStatus), {
        preserveSession: true,
      });
    },

    scheduleMoveOut(input) {
      if (isDemoMode) {
        return rejectDemoAction();
      }
      return runServerAction(() => scheduleMoveOut(input.tenancyId, input.moveOutDate), {
        preserveSession: true,
      });
    },

    closeTenancy(tenancyId) {
      if (isDemoMode) {
        return rejectDemoAction();
      }
      return runServerAction(() => closeTenancy(tenancyId), {
        preserveSession: true,
      });
    },
  };

  return { state, actions };
}
