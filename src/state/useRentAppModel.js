import { useEffect, useState } from 'react';

const { createSeedState } = require('../data/seed');
const {
  addRoom,
  activateTenancy,
  changePassword,
  closeTenancy,
  completeTenantProfile,
  createProperty,
  fetchAppState,
  generateInvoice,
  hydrateStoredTokens,
  inviteTenant,
  login,
  logoutSession,
  resetTenantPassword,
  reviewMeterReading,
  reviewPayment,
  scheduleMoveOut,
  setPassword,
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

function createInitialState() {
  return {
    ...createSeedState(),
    session: emptySession,
    isHydrating: true,
    isSyncing: false,
    backendError: null,
    issuedCredential: null,
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
    issuedCredential: serverState.issuedCredential || null,
    isHydrating: false,
    isSyncing: false,
    backendError: null,
  };
}

export function useRentAppModel() {
  const [state, setState] = useState(createInitialState);

  useEffect(() => {
    let active = true;

    async function hydrateState() {
      try {
        await hydrateStoredTokens();

        let serverState = null;

        try {
          serverState = await fetchAppState();
        } catch (error) {
          const message = normalizeError(error);

          if (!/authentication required|session|token/i.test(message)) {
            throw error;
          }
        }

        if (!active) {
          return;
        }

        setState((currentState) =>
          serverState
            ? buildNextState(serverState, currentState)
            : {
                ...currentState,
                isHydrating: false,
                isSyncing: false,
                backendError: null,
              },
        );
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

  const actions = {
    login(role, phone, password) {
      return runServerAction(() => login(role, phone, password));
    },

    setPassword(password) {
      return runServerAction(() => setPassword(password), {
        preserveSession: true,
      });
    },

    changePassword(currentPassword, nextPassword) {
      return runServerAction(() => changePassword(currentPassword, nextPassword), {
        preserveSession: true,
      });
    },

    async logout() {
      await logoutSession();

      setState((currentState) => ({
        ...currentState,
        session: emptySession,
        issuedCredential: null,
        isSyncing: false,
        backendError: null,
      }));
    },

    updateProperty(payload) {
      return runServerAction(() => updateProperty(payload), {
        preserveSession: true,
      });
    },

    createProperty(payload) {
      return runServerAction(() => createProperty(payload), {
        preserveSession: true,
      });
    },

    updateSettlement(payload) {
      return runServerAction(() => updateSettlement(payload), {
        preserveSession: true,
      });
    },

    addRoom(payload) {
      return runServerAction(() => addRoom(payload), {
        preserveSession: true,
      });
    },

    inviteTenant(payload) {
      return runServerAction(() => inviteTenant(payload), {
        preserveSession: true,
      });
    },

    completeTenantProfile(input) {
      const { tenantId, ...payload } = input;

      return runServerAction(() => completeTenantProfile(tenantId, payload), {
        preserveSession: true,
      });
    },

    resetTenantPassword(tenantId) {
      return runServerAction(() => resetTenantPassword(tenantId), {
        preserveSession: true,
      });
    },

    activateTenancy(input) {
      const { tenancyId, ...payload } = input;

      return runServerAction(() => activateTenancy(tenancyId, payload), {
        preserveSession: true,
      });
    },

    generateInvoice(payload) {
      return runServerAction(() => generateInvoice(payload), {
        preserveSession: true,
      });
    },

    submitMeterReading(payload) {
      return runServerAction(() => submitMeterReading(payload), {
        preserveSession: true,
      });
    },

    reviewMeterReading(payload) {
      return runServerAction(() => reviewMeterReading(payload), {
        preserveSession: true,
      });
    },

    submitPayment(payload) {
      return runServerAction(() => submitPayment(payload), {
        preserveSession: true,
      });
    },

    reviewPayment(payload) {
      return runServerAction(() => reviewPayment(payload), {
        preserveSession: true,
      });
    },

    updateReminderStatus(reminderId, deliveryStatus) {
      return runServerAction(() => updateReminderStatus(reminderId, deliveryStatus), {
        preserveSession: true,
      });
    },

    scheduleMoveOut(input) {
      return runServerAction(() => scheduleMoveOut(input.tenancyId, input.moveOutDate), {
        preserveSession: true,
      });
    },

    closeTenancy(tenancyId) {
      return runServerAction(() => closeTenancy(tenancyId), {
        preserveSession: true,
      });
    },
  };

  return { state, actions };
}
