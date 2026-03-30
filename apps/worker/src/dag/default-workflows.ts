import type { DAGDefinition } from "./types";

export const ORDER_FULFILLMENT_DAG: DAGDefinition = {
  nodes: [
    {
      id: "validate-stock",
      label: "Validate Stock",
      handler: "validate-stock",
      dependsOn: [],
    },
    {
      id: "route-to-supplier",
      label: "Route to Supplier",
      handler: "route-to-supplier",
      dependsOn: ["validate-stock"],
    },
    {
      id: "generate-po",
      label: "Generate PO",
      handler: "generate-po",
      dependsOn: ["route-to-supplier"],
    },
    {
      id: "create-shipment",
      label: "Create Shipment",
      handler: "create-shipment",
      dependsOn: ["generate-po"],
    },
  ],
};
