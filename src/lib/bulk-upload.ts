export type BulkUploadLineItem = {
  slNo: number;
  componentName: string;
  bomId: string;
  costPerItem: number;
  quantity: number;
  itemDescription: string;
};

type HeaderMatch = {
  label: string;
  patterns: RegExp[];
  required?: boolean;
};

const HEADER_MATCHES: Record<string, HeaderMatch> = {
  slNo: {
    label: "Sl. No.",
    patterns: [/^sl\.?\s*no\.?$/i, /^s\.?\s*no\.?$/i, /^serial(\s*no\.?)?$/i, /^#$/],
  },
  componentName: {
    label: "Component Name",
    required: true,
    patterns: [/^component\s*name$/i, /^component$/i, /^item\s*name$/i, /^item$/i, /^part\s*name$/i, /^material$/i],
  },
  bomId: {
    label: "BOM ID",
    patterns: [/^bom\s*id$/i, /^bom$/i, /^bom\s*no\.?$/i],
  },
  costPerItem: {
    label: "Cost per item",
    required: true,
    patterns: [/^cost\s*per\s*item$/i, /^unit\s*price$/i, /^unit\s*cost$/i, /^cost$/i, /^rate$/i, /^price$/i, /^amount$/i],
  },
  quantity: {
    label: "Quantity",
    required: true,
    patterns: [/^quantity$/i, /^qty$/i, /^qnty$/i],
  },
  itemDescription: {
    label: "Item Description",
    patterns: [/^item\s*description$/i, /^description$/i, /^details$/i, /^remarks$/i],
  },
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function findColumn(headers: string[], match: HeaderMatch) {
  return headers.findIndex((header) => match.patterns.some((pattern) => pattern.test(header)));
}

function getColumnIndexes(headers: string[]) {
  return {
    slNo: findColumn(headers, HEADER_MATCHES.slNo),
    componentName: findColumn(headers, HEADER_MATCHES.componentName),
    bomId: findColumn(headers, HEADER_MATCHES.bomId),
    costPerItem: findColumn(headers, HEADER_MATCHES.costPerItem),
    quantity: findColumn(headers, HEADER_MATCHES.quantity),
    itemDescription: findColumn(headers, HEADER_MATCHES.itemDescription),
  };
}

function getMissingRequiredColumns(indexes: ReturnType<typeof getColumnIndexes>) {
  return Object.entries(HEADER_MATCHES)
    .filter(([key, match]) => match.required && indexes[key as keyof typeof indexes] < 0)
    .map(([, match]) => match.label);
}

function findHeaderRow(rows: unknown[][]) {
  const candidates = rows.slice(0, 10);
  let best:
    | {
        rowIndex: number;
        headers: string[];
        indexes: ReturnType<typeof getColumnIndexes>;
        missing: string[];
      }
    | null = null;

  for (let rowIndex = 0; rowIndex < candidates.length; rowIndex++) {
    const headers = (candidates[rowIndex] ?? []).map(normalizeHeader);
    const indexes = getColumnIndexes(headers);
    const missing = getMissingRequiredColumns(indexes);
    if (missing.length === 0) return { rowIndex, headers, indexes, missing };
    if (!best || missing.length < best.missing.length) {
      best = { rowIndex, headers, indexes, missing };
    }
  }

  return best;
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "")
    .trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseBulkUploadRows(rows: unknown[][]): BulkUploadLineItem[] {
  if (rows.length < 2) {
    throw new Error("No line items found. Add a header row and at least one item row.");
  }

  const header = findHeaderRow(rows);
  const missing = header?.missing ?? ["Component Name", "Cost per item", "Quantity"];

  if (!header || missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(", ")}.`);
  }

  const indexes = header.indexes;
  const parsed: BulkUploadLineItem[] = [];
  for (let i = header.rowIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const componentName = String(row[indexes.componentName] ?? "").trim();
    const costPerItem = parseNumber(row[indexes.costPerItem]);
    const quantity = Math.max(1, Math.floor(parseNumber(row[indexes.quantity]) || 1));

    if (!componentName && costPerItem === 0) continue;
    if (!componentName) {
      throw new Error(`Bulk row ${i + 1} is missing component name.`);
    }
    if (costPerItem <= 0) {
      throw new Error(`Bulk row ${i + 1} must have a cost per item greater than 0.`);
    }

    parsed.push({
      slNo: indexes.slNo >= 0 ? Math.floor(parseNumber(row[indexes.slNo]) || i) : i,
      componentName,
      bomId: indexes.bomId >= 0 ? String(row[indexes.bomId] ?? "").trim() : "",
      costPerItem,
      quantity,
      itemDescription: indexes.itemDescription >= 0 ? String(row[indexes.itemDescription] ?? "").trim() : "",
    });
  }

  if (parsed.length === 0) {
    throw new Error("No valid line items found in the uploaded Excel file.");
  }

  return parsed;
}
