import { useEffect, useRef, useState } from "react";
import CardFrame from "../../components/common/CardFrame";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import { CheckCircleIcon, AlertIcon } from "../../icons";
import { getRtsShippingSettings, updateRtsShippingSettings } from "../../services/jaonaichan";

type SaveStatus = "idle" | "saving" | "success" | "error";

export default function RtsShippingSettings() {
    const [isLoading, setIsLoading] = useState(false);
    const [cost, setCost] = useState("");
    const [methodTitle, setMethodTitle] = useState("");
    const [zoneName, setZoneName] = useState("");
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
    const hasInitialized = useRef(false);

    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;
        setIsLoading(true);
        getRtsShippingSettings()
            .then((data) => {
                setCost(String(data.cost));
                setMethodTitle(data.method_title);
                setZoneName(data.zone_name);
            })
            .catch((e) => { if (import.meta.env.DEV) console.error(e); })
            .finally(() => setTimeout(() => setIsLoading(false), 100));
    }, []);

    const handleSave = async () => {
        setSaveStatus("saving");
        try {
            const res = await updateRtsShippingSettings(parseFloat(cost) || 0);
            setCost(String(res.cost));
            setSaveStatus("success");
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch (e) {
            if (import.meta.env.DEV) console.error(e);
            setSaveStatus("error");
            setTimeout(() => setSaveStatus("idle"), 4000);
        }
    };

    return (
        <>
            <PageMeta title="RTS Shipping Settings | Bigboss" description="Configure RTS shipping cost" />
            <PageBreadcrumb pageTitle="RTS Shipping Settings" />
            <CardFrame isLoading={isLoading}>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
                    <h4 className="mb-1 text-base font-semibold text-gray-800 dark:text-white/90">
                        ⚡ RTS Shipping
                    </h4>
                    <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                        ค่าส่งที่จะถูกเพิ่มอัตโนมัติในออเดอร์ RTS — ดึงจาก WooCommerce Shipping Zone ชื่อ "rts"
                    </p>

                    <div className="space-y-5 max-w-md">
                        {zoneName && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Zone:</span>
                                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                                    {zoneName}
                                </span>
                                {methodTitle && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">· {methodTitle}</span>
                                )}
                            </div>
                        )}

                        <div>
                            <Label htmlFor="rts-cost">ค่าส่ง RTS (บาท)</Label>
                            <Input
                                id="rts-cost"
                                type="number"
                                placeholder="0"
                                value={cost}
                                onChange={(e) => setCost(e.target.value)}
                            />
                            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                                ค่านี้จะถูกอัปเดตใน WooCommerce โดยตรง — ออเดอร์ RTS ใหม่จะใช้ค่านี้ทันที
                            </p>
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
                </div>
            </CardFrame>
        </>
    );
}
