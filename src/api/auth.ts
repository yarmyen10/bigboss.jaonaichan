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
    token?: string;
    user_nicename?: string;
    user_email?: string;
    user_display_name?: string;
    [key: string]: any
}

export async function signIn(username: string, password: string): Promise<SignInResponse> {
    const res = await fetch(`${JAONAICHAN_API_URL}/jwt-auth/v1/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });

    const data: SignInResponse = await res.json();

    if (data.token) {
        localStorage.setItem(JAONAICHAN_PREFIX + 'Token', data.token);
        localStorage.setItem(JAONAICHAN_PREFIX + 'User', JSON.stringify({
            username: data.user_nicename,
            email: data.user_email,
            displayName: data.user_display_name,
            roles: data.roles,
            role: data.role,
            avatarUrl: data.avatar_url,
        } satisfies BigBossUser));
    }

    return data;
}

export function signOut(): void {
    localStorage.removeItem(JAONAICHAN_PREFIX + 'Token');
    localStorage.removeItem(JAONAICHAN_PREFIX + 'User');
}

export function getToken(): string | null {
    return localStorage.getItem(JAONAICHAN_PREFIX + 'Token');
}

export function isLoggedIn(): boolean {
    return !!getToken();
}

export function getUser(): BigBossUser | null {
    const raw = localStorage.getItem(JAONAICHAN_PREFIX + 'User');
    return raw ? JSON.parse(raw) as BigBossUser : null;
}