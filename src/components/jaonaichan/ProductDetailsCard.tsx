import { useEffect, useRef } from "react";
import ComponentCard from "../common/ComponentCard";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { OrderItemProduct } from "../../interfaces/order.jaonaichan";

interface ProductDetailsCardProps {
  product: OrderItemProduct | null;
  /** "card" (default) = wrapped in ComponentCard, for side-panel/sheet use.
   *  "flat" = bare layout, for use inside a Modal that already provides the container. */
  variant?: "card" | "flat";
}

function Field({ label, value }: { label: string; value: string | number | undefined | null }) {
  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 dark:text-white/90 break-all">
        {value !== undefined && value !== null && value !== ""
          ? String(value)
          : <span className="text-gray-300 dark:text-gray-600">—</span>}
      </p>
    </div>
  );
}

function FlatContent({ product }: { product: OrderItemProduct | null }) {
  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800 pr-14">
        <h4 className="text-base font-semibold text-gray-800 dark:text-white/90 leading-tight">
          Product Details
        </h4>
        {product && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{product.name}</p>
        )}
      </div>

      {!product ? (
        <div className="flex items-center justify-center h-32 text-sm text-gray-400 dark:text-gray-500">
          Select a product to view details
        </div>
      ) : (
        <div className="px-5 py-4 space-y-4">
          {product.image?.thumbnail && (
            <div className="w-full rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
              <img
                src={product.image.full ?? product.image.medium ?? product.image.thumbnail}
                alt={product.name}
                className="w-full object-contain max-h-56"
              />
            </div>
          )}
          <div className="space-y-3">
            <Field label="Name" value={product.name} />
            <Field label="SKU" value={product.sku} />
            <Field label="Type" value={product.type} />
          </div>
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 px-4 py-3">
            <Field label="Price" value={product.price ? `฿${Number(product.price).toLocaleString()}` : null} />
            <Field label="Regular" value={product.regular_price ? `฿${Number(product.regular_price).toLocaleString()}` : null} />
            <Field label="Sale" value={product.sale_price ? `฿${Number(product.sale_price).toLocaleString()}` : null} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stock" value={product.stock} />
            <Field label="Stock Status" value={product.stock_status} />
          </div>
          {product.categories.length > 0 && (
            <Field label="Categories" value={product.categories.join(", ")} />
          )}
          {product.tags.length > 0 && (
            <Field label="Tags" value={product.tags.join(", ")} />
          )}
          {product.permalink && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Permalink</p>
              <a
                href={product.permalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-brand-500 hover:underline"
              >
                View Product
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function ProductDetailsCard({ product, variant = "card" }: ProductDetailsCardProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [product?.id]);

  if (variant === "flat") {
    return (
      <div ref={bodyRef} className="flex flex-col">
        <FlatContent product={product} />
      </div>
    );
  }

  return (
    <ComponentCard
      title="Product Details"
      className="flex flex-col flex-1 min-h-0"
      classNameBody="flex-1 min-h-0 overflow-y-auto custom-scrollbar"
      bodyRef={bodyRef}
    >
      {!product ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Select a product to view details</p>
      ) : (
        <div className="space-y-4">
          {product.image?.thumbnail && (
            <div className="flex justify-center">
              <img
                src={product.image.full ?? product.image.medium ?? product.image.thumbnail}
                alt={product.name}
                className="h-full w-80 rounded object-cover"
              />
            </div>
          )}
          <div>
            <Label htmlFor="pd-name">Name</Label>
            <Input id="pd-name" value={product.name} disabled />
          </div>
          <div>
            <Label htmlFor="pd-sku">SKU</Label>
            <Input id="pd-sku" value={product.sku} disabled />
          </div>
          <div>
            <Label htmlFor="pd-type">Type</Label>
            <Input id="pd-type" value={product.type} disabled />
          </div>
          <div>
            <Label htmlFor="pd-price">Price</Label>
            <Input id="pd-price" type="number" value={product.price} disabled />
          </div>
          <div>
            <Label htmlFor="pd-regular-price">Regular Price</Label>
            <Input id="pd-regular-price" type="number" value={product.regular_price} disabled />
          </div>
          <div>
            <Label htmlFor="pd-sale-price">Sale Price</Label>
            <Input id="pd-sale-price" type="number" value={product.sale_price} disabled />
          </div>
          <div>
            <Label htmlFor="pd-stock">Stock</Label>
            <Input id="pd-stock" type="number" value={product.stock ?? ''} disabled />
          </div>
          <div>
            <Label htmlFor="pd-stock-status">Stock Status</Label>
            <Input id="pd-stock-status" value={product.stock_status} disabled />
          </div>
          <div>
            <Label htmlFor="pd-categories">Categories</Label>
            <Input id="pd-categories" value={product.categories.join(', ')} disabled />
          </div>
          <div>
            <Label htmlFor="pd-tags">Tags</Label>
            <Input id="pd-tags" value={product.tags.join(', ')} disabled />
          </div>
          <div>
            <Label htmlFor="pd-permalink">Permalink</Label>
            <Input id="pd-permalink" value={product.permalink} disabled />
          </div>
        </div>
      )}
    </ComponentCard>
  );
}
