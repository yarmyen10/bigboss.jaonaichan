import { getUser, isLoggedIn, signOut, BigBossUser } from '../api/auth';

interface UseAuthReturn {
    user: BigBossUser | null;
    isLoggedIn: boolean;
    signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
    return {
        user: getUser(),
        isLoggedIn: isLoggedIn(),
        signOut,
    };
}
