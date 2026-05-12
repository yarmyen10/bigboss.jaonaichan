export interface UserProfile {
    id: number;
    username: string;
    email: string;
    displayName: string;
    firstName: string;
    lastName: string;
    nickname: string;
    description: string;
    registeredAt: string;
    roles: string[];
    role: string;
    avatarUrl: string;
}

export interface PatchProfilePayload {
    display_name?: string;
    first_name?: string;
    last_name?: string;
    nickname?: string;
    description?: string;
}

export interface PatchProfileResponse {
    success: boolean;
    message: string;
    updated: string[];
    data: UserProfile;
}
