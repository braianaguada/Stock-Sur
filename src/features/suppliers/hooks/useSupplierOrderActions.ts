import { useMemo, type Dispatch, type SetStateAction } from "react";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import {
  addCatalogLineToOrder,
  buildSupplierOrderMessage,
  normalizeSupplierQuantityInput,
  removeOrderItemFromState,
  updateOrderItemQuantity,
} from "@/features/suppliers/state";
import type { CatalogLine, OrderLine, Supplier, SupplierCatalogVersion } from "@/features/suppliers/types";

type ToastFn = (params: { title: string; description?: string; variant?: "default" | "destructive" }) => void;

export function useSupplierOrderActions(params: {
  selectedSupplier: Supplier | null;
  activeVersion: SupplierCatalogVersion | null;
  catalogTitleById: Map<string, string>;
  orderItems: Record<string, OrderLine>;
  lineQuantities: Record<string, number>;
  setOrderItems: Dispatch<SetStateAction<Record<string, OrderLine>>>;
  setLineQuantities: Dispatch<SetStateAction<Record<string, number>>>;
  toast: ToastFn;
}) {
  const {
    selectedSupplier,
    activeVersion,
    catalogTitleById,
    orderItems,
    lineQuantities,
    setOrderItems,
    setLineQuantities,
    toast,
  } = params;

  const orderLines = useMemo(() => Object.values(orderItems), [orderItems]);
  const orderTotal = useMemo(
    () => orderLines.reduce((acc, line) => acc + (line.cost * line.quantity), 0),
    [orderLines],
  );
  const orderMessage = useMemo(() =>
    buildSupplierOrderMessage({
      selectedSupplier,
      orderLines,
      activeVersion,
      catalogTitleById,
    }),
  [selectedSupplier, orderLines, activeVersion, catalogTitleById]);
  const waLink = useMemo(
    () => buildWhatsAppLink(selectedSupplier?.whatsapp, orderMessage),
    [selectedSupplier?.whatsapp, orderMessage],
  );

  const addToOrder = (line: CatalogLine) => {
    setOrderItems((prev) => addCatalogLineToOrder(prev, lineQuantities, line));
  };

  const updateLineQuantity = (lineId: string, value: string) => {
    const quantity = normalizeSupplierQuantityInput(value);
    if (quantity === null) return;
    setLineQuantities((prev) => ({ ...prev, [lineId]: quantity }));
  };

  const updateOrderQuantity = (lineId: string, value: string) => {
    const quantity = normalizeSupplierQuantityInput(value);
    if (quantity === null) return;
    setOrderItems((prev) => updateOrderItemQuantity(prev, lineId, quantity));
  };

  const removeOrderItem = (lineId: string) => {
    setOrderItems((prev) => removeOrderItemFromState(prev, lineId));
  };

  const copyOrderMessage = async () => {
    if (orderLines.length === 0) {
      toast({ title: "Pedido vacio", description: "Agrega al menos un producto", variant: "destructive" });
      return;
    }

    await navigator.clipboard.writeText(orderMessage);
    toast({ title: "Mensaje copiado" });
  };

  const openWhatsApp = () => {
    if (orderLines.length === 0) {
      toast({ title: "Pedido vacio", description: "Agrega al menos un producto", variant: "destructive" });
      return;
    }

    if (!waLink) {
      toast({ title: "Proveedor sin WhatsApp", description: "Completa el numero para abrir WhatsApp", variant: "destructive" });
      return;
    }

    window.open(waLink, "_blank", "noopener,noreferrer");
  };

  return {
    addToOrder,
    copyOrderMessage,
    openWhatsApp,
    orderLines,
    orderTotal,
    removeOrderItem,
    updateLineQuantity,
    updateOrderQuantity,
  };
}
