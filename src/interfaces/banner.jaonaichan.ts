// Shop banners — theme src/api/banners_api.php. Same model as the designer's Banner Management package.
export interface Banner {
    /** "new-…" until the first save, then a real id from the server */
    id: string;
    title: string;
    description: string;
    isActive: boolean;
    image: { url: string; name?: string } | null;
    /** empty, an http(s) URL or a site path such as "/shop" */
    link: string;
    /** ISO date */
    updatedAt: string;
}

/** a success body, or WordPress' error body ({ code, message, data: { status, index } }) — apiRequest does not throw on 4xx */
export interface BannerListResponse { success?: boolean; data?: Banner[]; code?: string; message?: string }
export interface BannerUploadResponse { success?: boolean; url?: string; name?: string; id?: number; code?: string; message?: string }
