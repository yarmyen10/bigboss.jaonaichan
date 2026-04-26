import { useEffect, useRef } from "react";
import ComponentCard from "../common/ComponentCard";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { OrderItemProduct } from "../../interfaces/order.jaonaichan";

interface ProductDetailsCardProps {
  product: OrderItemProduct | null;
}

export default function ProductDetailsCard({ product }: ProductDetailsCardProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [product?.id]);

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
