import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { ProviderId, ProviderStatus } from "../types/provider";
import providerApi from "../api/providerApi";
import { createEpicStrategy } from "../epic/auth/createEpicStrategy";
import { useAuth } from "../../auth/context/AuthContext";

export type ProviderConnectionState =
  | "loading"
  | "connecting"
  | "connected"
  | "syncing"
  | "disconnecting"
  | "disconnected"
  | "error";

export interface ProviderState {
  status: ProviderStatus;
  connectionState: ProviderConnectionState;
  loading: boolean;
  error: string | null;
  lastSuccessfulSync?: string | null;
  lastSyncAttempt?: string | null;
  lastError?: string | null;
}

export interface ProviderContextType {
  authenticate: (providerId: ProviderId) => Promise<ProviderStatus>;
  connect: (
    providerId: ProviderId,
    authorizationCode: string,
  ) => Promise<ProviderStatus>;
  disconnect: (providerId: ProviderId) => Promise<void>;
  resync: (providerId: ProviderId) => Promise<any>;
  refresh: (providerId: ProviderId) => Promise<void>;
  refreshInstallations: () => Promise<any>;
}

const initialProviderState = (providerId: ProviderId): ProviderState => ({
  status: {
    provider: providerId,
    connected: false,
    displayName: null,
    importedGames: 0,
    lastSync: null,
  },
  connectionState: "loading",
  loading: true,
  error: null,
  lastSuccessfulSync: null,
  lastSyncAttempt: null,
  lastError: null,
});

// We create separate contexts for each provider's state
const ProviderStateContexts: Record<
  ProviderId,
  React.Context<ProviderState>
> = {
  manual: createContext<ProviderState>(initialProviderState("manual")),
  epic: createContext<ProviderState>(initialProviderState("epic")),
  steam: createContext<ProviderState>(initialProviderState("steam")),
  gog: createContext<ProviderState>(initialProviderState("gog")),
  ea: createContext<ProviderState>(initialProviderState("ea")),
  ubisoft: createContext<ProviderState>(initialProviderState("ubisoft")),
  xbox: createContext<ProviderState>(initialProviderState("xbox")),
};

// We create a context for the shared, stable actions
const ProviderActionsContext = createContext<ProviderContextType | undefined>(
  undefined,
);

export function ProviderProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [epicState, setEpicState] = useState<ProviderState>(
    initialProviderState("epic"),
  );
  const [steamState, setSteamState] = useState<ProviderState>(
    initialProviderState("steam"),
  );
  const [gogState, setGogState] = useState<ProviderState>(
    initialProviderState("gog"),
  );
  const [eaState, setEaState] = useState<ProviderState>(
    initialProviderState("ea"),
  );
  const [ubisoftState, setUbisoftState] = useState<ProviderState>(
    initialProviderState("ubisoft"),
  );
  const [xboxState, setXboxState] = useState<ProviderState>(
    initialProviderState("xbox"),
  );
  const [manualState, setManualState] = useState<ProviderState>(
    initialProviderState("manual"),
  );

  const getSetter = useCallback((id: ProviderId) => {
    switch (id) {
      case "epic":
        return setEpicState;
      case "steam":
        return setSteamState;
      case "gog":
        return setGogState;
      case "ea":
        return setEaState;
      case "ubisoft":
        return setUbisoftState;
      case "xbox":
        return setXboxState;
      case "manual":
        return setManualState;
    }
  }, []);

  const updateProviderState = useCallback(
    (
      id: ProviderId,
      updater:
        | Partial<ProviderState>
        | ((prev: ProviderState) => ProviderState),
    ) => {
      const setter = getSetter(id);
      if (typeof updater === "function") {
        setter(updater);
      } else {
        setter((prev) => ({ ...prev, ...updater }));
      }
    },
    [getSetter],
  );

  const refresh = useCallback(
    async (providerId: ProviderId) => {
      if (providerId === "manual") {
        updateProviderState("manual", (prev) => ({
          ...prev,
          connectionState: "disconnected",
          loading: false,
          error: null,
        }));
        return;
      }

      try {
        const data = await providerApi.getStatus(providerId);
        updateProviderState(providerId, {
          status: data,
          connectionState: data.connected ? "connected" : "disconnected",
          loading: false,
          error: null,
        });
      } catch (err: any) {
        console.error(
          `[ProviderContext] Failed to refresh provider status for ${providerId}:`,
          err,
        );
        updateProviderState(providerId, (prev) => ({
          ...prev,
          connectionState: "disconnected",
          loading: false,
          error: err?.message || "Failed to load provider status",
        }));
      }
    },
    [updateProviderState],
  );

  const authenticate = useCallback(
    async (providerId: ProviderId): Promise<ProviderStatus> => {
      updateProviderState(providerId, (prev) => ({
        ...prev,
        connectionState: "connecting",
        loading: true,
        error: null,
      }));

      try {
        let authorizationCode: string | undefined;

        if (providerId === "epic") {
          const strategy = createEpicStrategy();
          const result = await strategy.authenticate();

          if (result.cancelled) {
            let finalStatus: ProviderStatus;
            updateProviderState(providerId, (prev) => {
              finalStatus = prev.status;
              return {
                ...prev,
                connectionState: finalStatus.connected
                  ? "connected"
                  : "disconnected",
                loading: false,
                error: null,
              };
            });
            // Wait for state transition to resolve
            return new Promise<ProviderStatus>((resolve) => {
              setEpicState((prev) => {
                resolve(prev.status);
                return prev;
              });
            });
          }

          if (!result.success || !result.authorizationCode) {
            const msg = result.error ?? "Authentication did not complete.";
            updateProviderState(providerId, (prev) => ({
              ...prev,
              connectionState: "error",
              loading: false,
              error: msg,
              lastError: msg,
            }));
            return new Promise<ProviderStatus>((resolve) => {
              setEpicState((prev) => {
                resolve(prev.status);
                return prev;
              });
            });
          }

          authorizationCode = result.authorizationCode;
        }

        updateProviderState(providerId, (prev) => ({
          ...prev,
          connectionState: "syncing",
          loading: true,
          error: null,
          lastSyncAttempt: new Date().toISOString(),
        }));

        const updated = await providerApi.connect(providerId, {
          authorizationCode,
          localGames: [],
        });

        updateProviderState(providerId, {
          status: updated,
          connectionState: updated.connected ? "connected" : "disconnected",
          loading: false,
          error: null,
          lastSuccessfulSync: updated.connected
            ? new Date().toISOString()
            : null,
        });
        return updated;
      } catch (err: any) {
        const msg =
          err?.response?.data?.Message ??
          err?.message ??
          `Failed to connect to ${providerId}.`;
        updateProviderState(providerId, (prev) => ({
          ...prev,
          connectionState: "error",
          loading: false,
          error: msg,
          lastError: msg,
        }));
        return new Promise<ProviderStatus>((resolve) => {
          const setter = getSetter(providerId);
          setter((prev) => {
            resolve(prev.status);
            return prev;
          });
        });
      }
    },
    [updateProviderState, getSetter],
  );

  const connect = useCallback(
    async (
      providerId: ProviderId,
      authorizationCode: string,
    ): Promise<ProviderStatus> => {
      updateProviderState(providerId, (prev) => ({
        ...prev,
        connectionState: "connecting",
        loading: true,
        error: null,
      }));

      try {
        updateProviderState(providerId, (prev) => ({
          ...prev,
          connectionState: "syncing",
          loading: true,
          error: null,
          lastSyncAttempt: new Date().toISOString(),
        }));

        const updated = await providerApi.connect(providerId, {
          authorizationCode,
          localGames: [],
        });

        updateProviderState(providerId, {
          status: updated,
          connectionState: updated.connected ? "connected" : "disconnected",
          loading: false,
          error: null,
          lastSuccessfulSync: updated.connected
            ? new Date().toISOString()
            : null,
        });
        return updated;
      } catch (err: any) {
        const msg = err?.message ?? `Failed to connect to ${providerId}.`;
        updateProviderState(providerId, (prev) => ({
          ...prev,
          connectionState: "error",
          loading: false,
          error: msg,
          lastError: msg,
        }));
        throw err;
      }
    },
    [updateProviderState],
  );

  const disconnect = useCallback(
    async (providerId: ProviderId): Promise<void> => {
      updateProviderState(providerId, (prev) => ({
        ...prev,
        connectionState: "disconnecting",
        loading: true,
        error: null,
      }));

      try {
        await providerApi.disconnect(providerId);

        const resetStatus: ProviderStatus = {
          provider: providerId,
          connected: false,
          displayName: null,
          importedGames: 0,
          lastSync: null,
        };

        updateProviderState(providerId, {
          status: resetStatus,
          connectionState: "disconnected",
          loading: false,
          error: null,
        });
      } catch (err: any) {
        const msg = err?.message ?? `Failed to disconnect ${providerId}.`;
        updateProviderState(providerId, (prev) => ({
          ...prev,
          connectionState: "error",
          loading: false,
          error: msg,
          lastError: msg,
        }));
        throw err;
      }
    },
    [updateProviderState],
  );

  const resync = useCallback(
    async (providerId: ProviderId): Promise<any> => {
      updateProviderState(providerId, (prev) => ({
        ...prev,
        connectionState: "syncing",
        loading: true,
        error: null,
        lastSyncAttempt: new Date().toISOString(),
      }));

      try {
        const result = await providerApi.resync(providerId, { localGames: [] });

        await refresh(providerId);
        updateProviderState(providerId, (prev) => ({
          ...prev,
          lastSuccessfulSync: new Date().toISOString(),
        }));
        return result;
      } catch (err: any) {
        const msg = err?.message ?? `Failed to resync ${providerId}.`;
        updateProviderState(providerId, (prev) => ({
          ...prev,
          connectionState: "error",
          loading: false,
          error: msg,
          lastError: msg,
        }));
        throw err;
      }
    },
    [updateProviderState, refresh],
  );

  const refreshInstallations = useCallback(async (): Promise<any> => {
    // Set epic and steam states to syncing if they are connected
    setEpicState((prev) =>
      prev.status.connected
        ? { ...prev, connectionState: "syncing", loading: true }
        : prev,
    );
    setSteamState((prev) =>
      prev.status.connected
        ? { ...prev, connectionState: "syncing", loading: true }
        : prev,
    );

    try {
      const steamScanned = window.electronAPI
        ? await window.electronAPI.scanSteamGames()
        : [];
      const epicScanned = window.electronAPI
        ? await window.electronAPI.scanEpicGames()
        : [];

      const result = await providerApi.refreshInstallations({
        steam: steamScanned,
        epic: epicScanned,
      });

      // Refresh both statuses
      await Promise.all([refresh("epic"), refresh("steam")]);

      return result;
    } catch (err: any) {
      console.error("[ProviderContext] Failed to refresh installations:", err);
      await Promise.all([refresh("epic"), refresh("steam")]);
      throw err;
    }
  }, [refresh]);

  useEffect(() => {
    if (!isAuthenticated) {
      setEpicState(initialProviderState("epic"));
      setSteamState(initialProviderState("steam"));
      // setGogState(initialProviderState("gog"));
      // setEaState(initialProviderState("ea"));
      // setUbisoftState(initialProviderState("ubisoft"));
      // setXboxState(initialProviderState("xbox"));
      setManualState(initialProviderState("manual"));
      return;
    }

    refresh("epic");
    refresh("steam");
  }, [isAuthenticated, refresh]);

  return (
    <ProviderActionsContext.Provider
      value={{
        authenticate,
        connect,
        disconnect,
        resync,
        refresh,
        refreshInstallations,
      }}
    >
      <ProviderStateContexts.manual.Provider value={manualState}>
        <ProviderStateContexts.epic.Provider value={epicState}>
          <ProviderStateContexts.steam.Provider value={steamState}>
            <ProviderStateContexts.gog.Provider value={gogState}>
              <ProviderStateContexts.ea.Provider value={eaState}>
                <ProviderStateContexts.ubisoft.Provider value={ubisoftState}>
                  <ProviderStateContexts.xbox.Provider value={xboxState}>
                    {children}
                  </ProviderStateContexts.xbox.Provider>
                </ProviderStateContexts.ubisoft.Provider>
              </ProviderStateContexts.ea.Provider>
            </ProviderStateContexts.gog.Provider>
          </ProviderStateContexts.steam.Provider>
        </ProviderStateContexts.epic.Provider>
      </ProviderStateContexts.manual.Provider>
    </ProviderActionsContext.Provider>
  );
}

export function useProvider(providerId: ProviderId) {
  const actions = useContext(ProviderActionsContext);
  if (!actions) {
    throw new Error("useProvider must be used within a ProviderProvider");
  }

  const stateContext = ProviderStateContexts[providerId];
  const state = useContext(stateContext);

  return {
    provider: state.status,
    connectionState: state.connectionState,
    loading: state.loading,
    error: state.error,
    lastSuccessfulSync: state.lastSuccessfulSync,
    lastSyncAttempt: state.lastSyncAttempt,
    lastError: state.lastError,
    authenticate: () => actions.authenticate(providerId),
    connect: (authorizationCode: string) =>
      actions.connect(providerId, authorizationCode),
    disconnect: () => actions.disconnect(providerId),
    resync: () => actions.resync(providerId),
    refresh: () => actions.refresh(providerId),
    refreshInstallations: actions.refreshInstallations,
  };
}
