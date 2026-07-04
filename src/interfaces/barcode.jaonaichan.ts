export interface BarcodeOrderItem {
    product_id: number;
    order_item_id: number;
    name: string;
    qty: number;
}

export interface GetOrderItemsResponse {
    items: BarcodeOrderItem[];
}

export interface ValidateBarcodeResponse {
    product_id: number;
    product_name: string;
}

export interface ConfirmPackResponse {
    success: boolean;
}

export interface TrackingParcel {
    carrier: 'kerry' | 'flash' | 'jt' | 'thaipost';
    number: string;
}

// =========================================================================
// Barcode Import
// =========================================================================

export interface ProductSearchResult {
    product_id: number;
    name: string;
    sku: string;
    barcode_count: number;
    type: 'simple' | 'variable';
}

export interface ProductSearchResponse {
    products: ProductSearchResult[];
}

export interface ProductVariation {
    variation_id: number;
    name: string;
    sku: string;
    barcode_count: number;
}

export interface GetVariationsResponse {
    variations: ProductVariation[];
}

export interface BarcodeImportSaveResponse {
    success: boolean;
    message: string;
    barcode_count?: number;
}

export interface BarcodeRecord {
    id: number;
    barcode: string;
    product_id: number;
    product_name: string;
    status: 'available' | 'packed' | 'cancelled';
    created_at: string;
    image_base64?: string | null;
}

export interface BarcodeListResponse {
    barcodes: BarcodeRecord[];
    total: number;
    total_pages: number;
}

export interface BarcodeDeleteResponse {
    success: boolean;
    message?: string;
}
