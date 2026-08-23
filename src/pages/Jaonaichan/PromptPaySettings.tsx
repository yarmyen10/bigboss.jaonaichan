import { useEffect, useRef, useState } from "react";
import CardFrame from "../../components/common/CardFrame";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import { CheckCircleIcon, AlertIcon } from "../../icons";
import { PromptPayConfig } from "../../interfaces/promptpay.jaonaichan";
import { getPromptPayConfig, updatePromptPayConfig } from "../../services/jaonaichan";

type SaveStatus = "idle" | "saving" | "success" | "error";

export default function PromptPaySettings() {
    const [isLoading, setIsLoading] = useState(false);
    const [phone, setPhone] = useState("");
    const [slipokKey, setSlipokKey] = useState("");
    const [slipokBranchId, setSlipokBranchId] = useState("");
    const [slipokEndpoint, setSlipokEndpoint] = useState("");
    const [qrMode, setQrMode] = useState<"phone" | "biller">("phone");
    const [billerId, setBillerId] = useState("");
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
    const hasInitialized = useRef(false);

    const load = async () => {
        try {
            setIsLoading(true);
            const config: PromptPayConfig = await getPromptPayConfig();
            setPhone(config.phone ?? "");
            setSlipokKey(config.slipok_key ?? "");
            setSlipokBranchId(config.slipok_branch_id ?? "");
            setSlipokEndpoint(config.slipok_endpoint ?? "");
            setQrMode(config.qr_mode ?? "phone");
            setBillerId(config.biller_id ?? "");
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
            await updatePromptPayConfig({ phone: phone.trim(), slipok_key: slipokKey.trim(), slipok_branch_id: slipokBranchId.trim(), slipok_endpoint: slipokEndpoint.trim(), qr_mode: qrMode, biller_id: billerId.trim() });
            setSaveStatus("success");
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch (error) {
            if (import.meta.env.DEV) console.error(error);
            setSaveStatus("error");
            setTimeout(() => setSaveStatus("idle"), 4000);
        }
    };

    return (
        <>
            <PageMeta title="PromptPay QR Settings | Bigboss" description="Configure PromptPay phone number and SlipOK API key" />
            <PageBreadcrumb pageTitle="PromptPay QR Settings" />
            <CardFrame isLoading={isLoading}>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
                    <h4 className="mb-1 text-base font-semibold text-gray-800 dark:text-white/90">
                        PromptPay QR Plugin
                    </h4>
                    <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                        ตั้งค่าเบอร์ PromptPay และ SlipOK API Key สำหรับรับชำระเงิน
                    </p>

                    <div className="space-y-5 max-w-md">
                        <div>
                            <Label>ประเภท QR</Label>
                            <div className="mt-1.5 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setQrMode("phone")}
                                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${qrMode === "phone" ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400" : "border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700"}`}
                                >
                                    เบอร์โทร (PromptPay)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setQrMode("biller")}
                                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${qrMode === "biller" ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400" : "border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700"}`}
                                >
                                    K-Shop
                                </button>
                            </div>
                        </div>

                        {qrMode === "phone" && (
                        <div>
                            <Label htmlFor="promptpay-phone">เบอร์ PromptPay</Label>
                            <Input
                                id="promptpay-phone"
                                type="tel"
                                placeholder="0812345678"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                                เบอร์โทรที่ผูกกับ PromptPay
                            </p>
                        </div>
                        )}

                        {qrMode === "biller" && (
                        <div>
                            <Label htmlFor="biller-id">K-Shop Biller ID</Label>
                            <Input
                                id="biller-id"
                                type="text"
                                placeholder="KB000002147245"
                                value={billerId}
                                onChange={(e) => setBillerId(e.target.value)}
                            />
                            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                                เลขอ้างอิงจาก K-Shop / Biller QR
                            </p>
                        </div>
                        )}

                        <div>
                            <Label htmlFor="slipok-branch-id">SlipOK Branch ID</Label>
                            <Input
                                id="slipok-branch-id"
                                type="text"
                                placeholder="12345"
                                value={slipokBranchId}
                                onChange={(e) => setSlipokBranchId(e.target.value)}
                            />
                            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                                Branch ID ที่ใช้ใน URL — ดูได้จาก dashboard ของ slipok.com
                            </p>
                        </div>

                        <div>
                            <Label htmlFor="slipok-key">SlipOK API Key</Label>
                            <Input
                                id="slipok-key"
                                type="text"
                                placeholder="SLIPOK_xxxxxxxx"
                                value={slipokKey}
                                onChange={(e) => setSlipokKey(e.target.value)}
                            />
                            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                                API Key สำหรับ header <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">x-authorization</code> —
                                สมัครฟรีได้ที่ slipok.com (ฟรี 100 ครั้ง/เดือน) — ถ้าไม่ใส่ ระบบจะรอ Admin อนุมัติแทน
                            </p>
                        </div>

                        <div>
                            <Label htmlFor="slipok-endpoint">SlipOK API Endpoint</Label>
                            <Input
                                id="slipok-endpoint"
                                type="url"
                                placeholder="https://api.slipok.com/api/line/apikey/"
                                value={slipokEndpoint}
                                onChange={(e) => setSlipokEndpoint(e.target.value)}
                            />
                            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                                เว้นว่างเพื่อใช้ค่าเริ่มต้น (https://api.slipok.com/api/line/apikey/)
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

                    <hr className="my-8 border-gray-100 dark:border-gray-800" />

                    <div>
                        <h5 className="mb-3 text-sm font-semibold text-gray-700 dark:text-white/80">
                            วิธีใช้ Shortcode
                        </h5>
                        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                                        <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300">Shortcode</th>
                                        <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300">การทำงาน</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-gray-100 dark:border-gray-800">
                                        <td className="px-4 py-2.5">
                                            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                                [promptpay_qr]
                                            </code>
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">ดึงยอดจาก WooCommerce Cart อัตโนมัติ</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-2.5">
                                            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                                [promptpay_qr phone="0812345678" amount="500"]
                                            </code>
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">ระบุเบอร์และยอดเงินเอง</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </CardFrame>
        </>
    );
}
