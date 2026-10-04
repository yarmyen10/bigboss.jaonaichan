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
    /** text drawn over the picture on the Shop page (the mock's .banner-content). heading: up to 2 lines, 60 characters; subheading: 120; ctaLabel: 24 — the button goes to `link`, so it needs one */
    heading: string;
    subheading: string;
    ctaLabel: string;
    /** ISO date */
    updatedAt: string;
}

/** Settings saved with the list. `intervalSeconds`: seconds between two slides on the Shop page — 0 = the slider does not move by itself, otherwise a whole number 2–60 */
export interface BannerSettings { intervalSeconds: number }

/** a success body, or WordPress' error body ({ code, message, data: { status, index } }) — apiRequest does not throw on 4xx */
export interface BannerListResponse { success?: boolean; data?: Banner[]; settings?: BannerSettings; code?: string; message?: string }
export interface BannerUploadResponse { success?: boolean; url?: string; name?: string; id?: number; code?: string; message?: string }
