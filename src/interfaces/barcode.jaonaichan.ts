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
    carrier: 'kerry' | 'flash' | 'jt' | 'thaipost' | 'spx';
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

// =========================================================================
// Barcode Import v2 — product list UI
// =========================================================================

export interface ImportBarcode {
    code: string;
    received_qty: number;
    last_scan_at: string;
}

export interface ImportVariant {
    variant_id: number;
    name: string;
    sku: string;
    order_qty: number;
    barcodes: ImportBarcode[];
}

export interface ImportProduct {
    product_id: number;
    name: string;
    sku: string;
    image_url: string;
    category: string;
    type: 'simple' | 'variable';
    order_qty: number;
    barcodes: ImportBarcode[];
    variants: ImportVariant[];
}

export interface GetImportProductsResponse {
    products: ImportProduct[];
}

export interface SetOrderQtyResponse {
    success: boolean;
}

export interface UpdateBarcodeQtyResponse {
    success: boolean;
    received_qty: number;
}

export interface RemoveBarcodeImportResponse {
    success: boolean;
}
