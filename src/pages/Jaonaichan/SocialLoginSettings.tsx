import { useEffect, useRef, useState } from "react";
import CardFrame from "../../components/common/CardFrame";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import { CheckCircleIcon, AlertIcon } from "../../icons";
import type { SocialLoginSettings } from "../../interfaces/social-login.jaonaichan";
import { getSocialLoginSettings, updateSocialLoginSettings } from "../../services/jaonaichan";

type SaveStatus = "idle" | "saving" | "success" | "error";

const EMPTY: SocialLoginSettings = {
    line:     { channel_id: "", channel_secret: "" },
    google:   { client_id: "",  client_secret: "" },
    facebook: { app_id: "",     app_secret: "" },
};

export default function SocialLoginSettings() {
    const [isLoading, setIsLoading] = useState(false);
    const [settings, setSettings] = useState<SocialLoginSettings>(EMPTY);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
    const hasInitialized = useRef(false);

    const load = async () => {
        try {
            setIsLoading(true);
            const data = await getSocialLoginSettings();
            setSettings({
                line:     { channel_id: data?.line?.channel_id ?? "",     channel_secret: data?.line?.channel_secret ?? "" },
                google:   { client_id: data?.google?.client_id ?? "",     client_secret: data?.google?.client_secret ?? "" },
                facebook: { app_id: data?.facebook?.app_id ?? "",         app_secret: data?.facebook?.app_secret ?? "" },
            });
        } catch (error) {
            if (import.meta.env.DEV) console.error(error);
        } finally {
            setTimeout(() => setIsLoading(false), 100);
        }
    };

    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;
        load();
    }, []);

    const handleSave = async () => {
        setSaveStatus("saving");
        try {
            await updateSocialLoginSettings(settings);
            setSaveStatus("success");
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch (error) {
            if (import.meta.env.DEV) console.error(error);
            setSaveStatus("error");
            setTimeout(() => setSaveStatus("idle"), 4000);
        }
    };

    const setLine     = (k: keyof SocialLoginSettings["line"],     v: string) =>
        setSettings(s => ({ ...s, line:     { ...s.line,     [k]: v } }));
    const setGoogle   = (k: keyof SocialLoginSettings["google"],   v: string) =>
        setSettings(s => ({ ...s, google:   { ...s.google,   [k]: v } }));
    const setFacebook = (k: keyof SocialLoginSettings["facebook"], v: string) =>
        setSettings(s => ({ ...s, facebook: { ...s.facebook, [k]: v } }));

    return (
        <>
            <PageMeta title="Social Login Settings | Bigboss" description="Configure LINE, Google and Facebook OAuth credentials" />
            <PageBreadcrumb pageTitle="Social Login Settings" />
            <CardFrame isLoading={isLoading}>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
                    <h4 className="mb-1 text-base font-semibold text-gray-800 dark:text-white/90">
                        Social Login Plugin
                    </h4>
                    <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                        ตั้งค่า OAuth Credentials สำหรับ LINE, Google และ Facebook Login
                    </p>

                    <div className="space-y-8 max-w-md">

                        {/* LINE */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full" style={{ background: "#06C755" }}>
                                    <svg viewBox="0 0 24 24" fill="white" width="16" height="16" aria-hidden="true">
                                        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                                    </svg>
                                </span>
                                <h5 className="text-sm font-semibold text-gray-700 dark:text-white/80">LINE Login</h5>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="line-channel-id">Channel ID</Label>
                                    <Input
                                        id="line-channel-id"
                                        type="text"
                                        placeholder="1234567890"
                                        value={settings.line.channel_id}
                                        onChange={e => setLine("channel_id", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="line-channel-secret">Channel Secret</Label>
                                    <Input
                                        id="line-channel-secret"
                                        type="password"
                                        placeholder="••••••••••••••••••••••••••••••••"
                                        value={settings.line.channel_secret}
                                        onChange={e => setLine("channel_secret", e.target.value)}
                                    />
                                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                                        ดูได้ที่ LINE Developers Console → Channel → Basic settings
                                    </p>
                                </div>
                            </div>
                        </div>

                        <hr className="border-gray-100 dark:border-gray-800" />

                        {/* Google */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full" style={{ background: "#DB4437" }}>
                                    <svg viewBox="0 0 24 24" fill="white" width="16" height="16" aria-hidden="true">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                    </svg>
                                </span>
                                <h5 className="text-sm font-semibold text-gray-700 dark:text-white/80">Google Login</h5>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="google-client-id">Client ID</Label>
                                    <Input
                                        id="google-client-id"
                                        type="text"
                                        placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                                        value={settings.google.client_id}
                                        onChange={e => setGoogle("client_id", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="google-client-secret">Client Secret</Label>
                                    <Input
                                        id="google-client-secret"
                                        type="password"
                                        placeholder="GOCSPX-••••••••••••••••••••••••••"
                                        value={settings.google.client_secret}
                                        onChange={e => setGoogle("client_secret", e.target.value)}
                                    />
                                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                                        ดูได้ที่ Google Cloud Console → APIs &amp; Services → Credentials
                                    </p>
                                </div>
                            </div>
                        </div>

                        <hr className="border-gray-100 dark:border-gray-800" />

                        {/* Facebook */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full" style={{ background: "#1877F2" }}>
                                    <svg viewBox="0 0 24 24" fill="white" width="16" height="16" aria-hidden="true">
                                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                    </svg>
                                </span>
                                <h5 className="text-sm font-semibold text-gray-700 dark:text-white/80">Facebook Login</h5>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="fb-app-id">App ID</Label>
                                    <Input
                                        id="fb-app-id"
                                        type="text"
                                        placeholder="1234567890123456"
                                        value={settings.facebook.app_id}
                                        onChange={e => setFacebook("app_id", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="fb-app-secret">App Secret</Label>
                                    <Input
                                        id="fb-app-secret"
                                        type="password"
                                        placeholder="••••••••••••••••••••••••••••••••"
                                        value={settings.facebook.app_secret}
                                        onChange={e => setFacebook("app_secret", e.target.value)}
                                    />
                                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                                        ดูได้ที่ Meta for Developers → App Dashboard → App settings → Basic
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 pt-2">
                            <Button
                                size="sm"
                                variant="primary"
                                onClick={handleSave}
                                disabled={saveStatus === "saving"}
                            >
                                {saveStatus === "saving" ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
                            </Button>

                            {saveStatus === "success" && (
                                <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                                    <CheckCircleIcon className="size-4" />
                                    บันทึกแล้ว
                                </span>
                            )}
                            {saveStatus === "error" && (
                                <span className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400">
                                    <AlertIcon className="size-4" />
                                    เกิดข้อผิดพลาด
                                </span>
                            )}
                        </div>
                    </div>

                    <hr className="my-8 border-gray-100 dark:border-gray-800" />

                    <div>
                        <h5 className="mb-3 text-sm font-semibold text-gray-700 dark:text-white/80">
                            Callback URLs (Redirect URIs)
                        </h5>
                        <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
                            ใส่ URL เหล่านี้ใน Allowed Redirect URIs ของแต่ละ Provider
                        </p>
                        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                                        <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300">Provider</th>
                                        <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300">Callback URL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { label: "LINE",     path: "line" },
                                        { label: "Google",   path: "google" },
                                        { label: "Facebook", path: "facebook" },
                                    ].map(({ label, path }) => (
                                        <tr key={path} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{label}</td>
                                            <td className="px-4 py-2.5">
                                                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                                    https://jaonaichan.com/wp-json/jsl/v1/{path}/callback
                                                </code>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </CardFrame>
        </>
    );
}
