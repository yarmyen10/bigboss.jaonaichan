import { getToken, getUser, isLoggedIn, signOut, BigBossUser } from '../apis/auth';

interface UseAuthReturn {
    user: BigBossUser | null;
    isLoggedIn: boolean;
    token: string | null;
    signOut: () => void;
}

export function useAuth(): UseAuthReturn {
    return {
        user: getUser(),
        isLoggedIn: isLoggedIn(),
        token: getToken(),
        signOut,
    };
}