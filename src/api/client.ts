import { getToken, signOut } from './auth';

const JAONAICHAN_API_URL = import.meta.env.JAONAICHAN_API_URL;

interface RequestOptions extends RequestInit {
    headers?: Record<string, string>;
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    console.log((window as any));
    
    const token = getToken();

    const res = await fetch(`${JAONAICHAN_API_URL}${endpoint}`, {
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

export async function apiFetch(endpoint: string, options: RequestOptions = {}): Promise<Response> {
    const token = getToken();

    const res = await fetch(`${JAONAICHAN_API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            ...options.headers,
        },
    });

    if (res.status === 403) {
        signOut();
        window.location.href = '/signin';
        throw new Error('Unauthorized');
    }

    return res;
}