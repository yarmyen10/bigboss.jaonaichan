export interface PromptPayConfig {
    phone: string;
    slipok_key: string;
    slipok_branch_id: string;
    slipok_endpoint: string;
}

export interface UpdatePromptPayConfigResponse {
    success: boolean;
    settings: PromptPayConfig;
}
