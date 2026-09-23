import { useUserAppState, useSetUserAppState } from '@dynatrace-sdk/react-hooks';

const STATE_KEY = 'sre-in-a-nutshell-user-state';

type UserState = {
  lastSeen: string;
  acked: string[];
  mode: 'today' | 'week';
  isFirstVisit: boolean;
};

function getDefaultState(): UserState {
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  return {
    lastSeen: twelveHoursAgo,
    acked: [],
    mode: 'today',
    isFirstVisit: true,
  };
}

function parseState(raw: string | undefined): UserState {
  if (!raw) return getDefaultState();
  try {
    return JSON.parse(raw) as UserState;
  } catch {
    return getDefaultState();
  }
}

export function useUserState() {
  const { data, isLoading, error, refetch } = useUserAppState({ key: STATE_KEY });
  const { execute: setStateExecute } = useSetUserAppState();

  const state: UserState = parseState(data?.value);

  async function writeState(next: UserState) {
    await setStateExecute({ key: STATE_KEY, body: { value: JSON.stringify(next) } });
    await refetch();
  }

  async function markAllReviewed() {
    const next: UserState = {
      ...state,
      lastSeen: new Date().toISOString(),
      isFirstVisit: false,
    };
    await writeState(next);
  }

  async function acknowledgeItem(displayId: string) {
    const next: UserState = {
      ...state,
      acked: state.acked.includes(displayId)
        ? state.acked
        : [...state.acked, displayId],
    };
    await writeState(next);
  }

  async function setMode(mode: 'today' | 'week') {
    const next: UserState = { ...state, mode };
    await writeState(next);
  }

  return {
    state,
    isLoading,
    error,
    markAllReviewed,
    acknowledgeItem,
    setMode,
  };
}
