export interface PromptPayConfig {
    phone: string;
    slipok_key: string;
    slipok_branch_id: string;
    slipok_endpoint: string;
    qr_mode: 'phone' | 'biller';
    biller_id: string;
}

export interface UpdatePromptPayConfigResponse {
    success: boolean;
    settings: PromptPayConfig;
}
