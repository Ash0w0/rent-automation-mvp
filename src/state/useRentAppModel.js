import { useEffect, useState } from 'react';

const { createSeedState } = require('../data/seed');
const {
  addRoom,
  activateTenancy,
  changePassword,
  closeTenancy,
  completeTenantProfile,
  createProperty,
  deleteOwner,
  fetchAppState,
  forgotPasswordRequestOtp,
  forgotPasswordReset,
  generateInvoice,
  hydrateStoredTokens,
  inviteOwner,
  inviteTenant,
  loginWithPassword,
  logoutSession,
  ownerResetTenantPassword,
  reviewMeterReading,
  reviewPayment,
  scheduleMoveOut,
  submitMeterReading,
  submitPayment,
  superAdminResetOwnerPassword,
  updateProperty,
  updateReminderStatus,
  updateSettlement,
  updateTenant,
  updateMeterReading,
  markInvoicePaid,
} = require('../lib/apiClient');

const emptySession = {
  role: null,
  phone: '',
  currentTenantId: null,
  currentOwnerId: null,
  currentSuperAdminId: null,
};

function createInitialState() {
  return {
    ...createSeedState(),
    session: emptySession,
    mustChangePassword: false,
    isHydrating: true,
    isSyncing: false,
    backendError: null,
    loginHint: null,
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
    mustChangePassword:
      options.mustChangePassword !== undefined
        ? options.mustChangePassword
        : currentState.mustChangePassword || false,
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
      // Restore auth (tokens or cookies)
      await hydrateStoredTokens();

      let serverState = null;

      try {
        serverState = await fetchAppState();
      } catch (error) {
        const message = normalizeError(error);

        // Ignore auth errors silently (user not logged in)
        if (!/authentication required|session|token|expired|log in again/i.test(message)) {
          throw error;
        }
      }

      if (!active) return;
      setState((currentState) =>
        serverState
          ? buildNextState(serverState, currentState)
          : {
              ...currentState,
              isHydrating: false,
              isSyncing: false,
              backendError: null,
            }
      );
    } catch (error) {
      if (!active) return;

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
    forgotPasswordRequestOtp(phone) {
      setState((currentState) => ({
        ...currentState,
        isSyncing: true,
        backendError: null,
      }));

      return forgotPasswordRequestOtp(phone)
        .then((payload) => {
          setState((currentState) => ({
            ...currentState,
            isSyncing: false,
            backendError: null,
          }));
          return payload;
        })
        .catch((error) => {
          setState((currentState) => ({
            ...currentState,
            isHydrating: false,
            isSyncing: false,
            backendError: normalizeError(error),
          }));
          throw error;
        });
    },

    forgotPasswordReset(phone, code, newPassword) {
      setState((currentState) => ({
        ...currentState,
        isSyncing: true,
        backendError: null,
      }));

      return forgotPasswordReset(phone, code, newPassword)
        .then((payload) => {
          setState((currentState) => ({
            ...currentState,
            isSyncing: false,
            backendError: null,
          }));
          return payload;
        })
        .catch((error) => {
          setState((currentState) => ({
            ...currentState,
            isHydrating: false,
            isSyncing: false,
            backendError: normalizeError(error),
          }));
          throw error;
        });
    },

    async login(phone, password) {
      setState((currentState) => ({
        ...currentState,
        isSyncing: true,
        backendError: null,
      }));

      try {
        const { state: serverState, mustChangePassword } = await loginWithPassword(
          phone,
          password,
        );
        setState((currentState) =>
          buildNextState(serverState, currentState, { mustChangePassword }),
        );
        return { mustChangePassword };
      } catch (error) {
        setState((currentState) => ({
          ...currentState,
          isHydrating: false,
          isSyncing: false,
          backendError: normalizeError(error),
        }));
        throw error;
      }
    },

    async changePassword(currentPassword, newPassword) {
      setState((currentState) => ({ ...currentState, isSyncing: true, backendError: null }));
      try {
        await changePassword(currentPassword, newPassword);
        const serverState = await fetchAppState();
        setState((currentState) =>
          buildNextState(serverState, currentState, {
            preserveSession: true,
            mustChangePassword: false,
          }),
        );
      } catch (error) {
        setState((currentState) => ({
          ...currentState,
          isSyncing: false,
          backendError: normalizeError(error),
        }));
        throw error;
      }
    },

    async logout() {
      await logoutSession();

      setState((currentState) => ({
        ...currentState,
        session: emptySession,
        isSyncing: false,
        backendError: null,
      }));
    },

    clearLoginHint() {
      setState((currentState) => ({ ...currentState, loginHint: null }));
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

    async inviteTenant(payload) {
      setState((currentState) => ({ ...currentState, isSyncing: true, backendError: null }));
      try {
        const response = await inviteTenant(payload);
        setState((currentState) =>
          buildNextState(response.state, currentState, { preserveSession: true }),
        );
        return { tempPassword: response.tempPassword, invitedTenant: response.invitedTenant };
      } catch (error) {
        setState((currentState) => ({
          ...currentState,
          isHydrating: false,
          isSyncing: false,
          backendError: normalizeError(error),
        }));
        throw error;
      }
    },

    async inviteOwner(payload) {
      setState((currentState) => ({ ...currentState, isSyncing: true, backendError: null }));
      try {
        const response = await inviteOwner(payload);
        const refreshed = await fetchAppState();
        setState((currentState) =>
          buildNextState(refreshed, currentState, { preserveSession: true }),
        );
        return { tempPassword: response.tempPassword, owner: response.owner };
      } catch (error) {
        setState((currentState) => ({
          ...currentState,
          isHydrating: false,
          isSyncing: false,
          backendError: normalizeError(error),
        }));
        throw error;
      }
    },

    async deleteOwner(ownerId) {
      setState((currentState) => ({ ...currentState, isSyncing: true, backendError: null }));
      try {
        await deleteOwner(ownerId);
        const refreshed = await fetchAppState();
        setState((currentState) =>
          buildNextState(refreshed, currentState, { preserveSession: true }),
        );
      } catch (error) {
        setState((currentState) => ({
          ...currentState,
          isHydrating: false,
          isSyncing: false,
          backendError: normalizeError(error),
        }));
        throw error;
      }
    },

    async resetOwnerPassword(ownerId) {
      setState((currentState) => ({ ...currentState, isSyncing: true, backendError: null }));
      try {
        const response = await superAdminResetOwnerPassword(ownerId);
        setState((currentState) => ({ ...currentState, isSyncing: false, backendError: null }));
        return response;
      } catch (error) {
        setState((currentState) => ({
          ...currentState,
          isHydrating: false,
          isSyncing: false,
          backendError: normalizeError(error),
        }));
        throw error;
      }
    },

    async resetTenantPassword(tenantId) {
      setState((currentState) => ({ ...currentState, isSyncing: true, backendError: null }));
      try {
        const response = await ownerResetTenantPassword(tenantId);
        setState((currentState) => ({ ...currentState, isSyncing: false, backendError: null }));
        return response;
      } catch (error) {
        setState((currentState) => ({
          ...currentState,
          isHydrating: false,
          isSyncing: false,
          backendError: normalizeError(error),
        }));
        throw error;
      }
    },

    completeTenantProfile(input) {
      const { tenantId, ...payload } = input;

      return runServerAction(() => completeTenantProfile(tenantId, payload), {
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

    updateTenant(tenantId, payload) {
      return runServerAction(() => updateTenant(tenantId, payload), {
        preserveSession: true,
      });
    },

    updateMeterReading(readingId, payload) {
      return runServerAction(() => updateMeterReading(readingId, payload), {
        preserveSession: true,
      });
    },

    markInvoicePaid(invoiceId) {
      return runServerAction(() => markInvoicePaid(invoiceId), {
        preserveSession: true,
      });
    },

    refresh() {
      return runServerAction(() => fetchAppState(), { preserveSession: true });
    },
  };

  return { state, actions };
}
