import { getToken, signOut } from './auth';

interface RequestOptions extends RequestInit {
    headers?: Record<string, string>;
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const token = getToken();

    const res = await fetch(`https://yoursite.com/wp-json${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
            ...options.headers,
        },
    });

    if (res.status === 403) {
        signOut();
        window.location.href = '/signin';
        throw new Error('Unauthorized');
    }

    return res.json() as Promise<T>;
}