const JAONAICHAN_API_URL = import.meta.env.JAONAICHAN_API_URL;
const JAONAICHAN_PREFIX = import.meta.env.JAONAICHAN_PREFIX;

export interface BigBossUser {
    username: string | undefined;
    email: string | undefined;
    displayName: string | undefined;
    roles: string[] | undefined;
    role: string | undefined;
    avatarUrl: string | undefined;
}

export interface SignInResponse {
    success?: boolean;
    message?: string;
    user?: {
        id: number;
        username: string;
        email: string;
        display_name: string;
        roles: string[];
        role: string | null;
        avatar_url: string;
    };
}

export async function signIn(username: string, password: string): Promise<SignInResponse> {
    const res = await fetch(`${JAONAICHAN_API_URL}/bigboss-auth/v1/signin`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });

    const data: SignInResponse = await res.json();

    if (data.success && data.user) {
        localStorage.setItem(JAONAICHAN_PREFIX + 'User', JSON.stringify({
            username:    data.user.username,
            email:       data.user.email,
            displayName: data.user.display_name,
            roles:       data.user.roles,
            role:        data.user.role ?? undefined,
            avatarUrl:   data.user.avatar_url,
        } satisfies BigBossUser));
    }

    return data;
}

export async function signOut(): Promise<void> {
    // Auth
    localStorage.removeItem(JAONAICHAN_PREFIX + 'Token');
    localStorage.removeItem(JAONAICHAN_PREFIX + 'User');
    // Notifications (bb_notif_status, bb_notif_items — see useNotifications.ts)
    localStorage.removeItem('bb_notif_status');
    localStorage.removeItem('bb_notif_items');
    try {
        await fetch(`${JAONAICHAN_API_URL}/bigboss-auth/v1/signout`, {
            method: 'POST',
            credentials: 'include',
        });
    } catch {
        // ignore network errors — localStorage already cleared
    }
}

export function isLoggedIn(): boolean {
    return !!localStorage.getItem(JAONAICHAN_PREFIX + 'User');
}

export function getUser(): BigBossUser | null {
    const raw = localStorage.getItem(JAONAICHAN_PREFIX + 'User');
    return raw ? JSON.parse(raw) as BigBossUser : null;
}
