export interface SocialLoginProviderLine {
    channel_id: string;
    channel_secret: string;
}

export interface SocialLoginProviderGoogle {
    client_id: string;
    client_secret: string;
}

export interface SocialLoginProviderFacebook {
    app_id: string;
    app_secret: string;
}

export interface SocialLoginSettings {
    line: SocialLoginProviderLine;
    google: SocialLoginProviderGoogle;
    facebook: SocialLoginProviderFacebook;
}

export interface SocialLoginSettingsApiResponse {
    success: boolean;
    data: SocialLoginSettings;
    message?: string;
}
