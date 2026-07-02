export const BULK_ITEM_TEMPLATE_HEADERS = [
  "Sl. No.",
  "Component Name",
  "BOM ID",
  "Cost per item",
  "Quantity",
  "Item Description",
  "Manufacturer",
  "Preferred Supplier",
  "Country of Origin",
  "Extra spares",
  "Remarks",
] as const;

export const INVENTORY_SEARCH_EXPORT_HEADERS = [
  ...BULK_ITEM_TEMPLATE_HEADERS,
  "Exists in Zoho",
  "Zoho Item Name",
  "Zoho SKU",
  "Zoho Rate",
  "Zoho Unit",
] as const;

export function getBulkTemplateRows() {
  return [
    [...BULK_ITEM_TEMPLATE_HEADERS],
    [
      1,
      "Example component",
      "BOM-001",
      0,
      1,
      "Short item description",
      "Manufacturer name",
      "Preferred supplier",
      "India",
      "Optional spare quantity/details",
      "Optional remarks",
    ],
  ];
}
