export type SuggestedAttribute = { name: string; value: string };

/** The generator writes lowercase keys while the IA suggests display names; both mean the same attribute. */
const SYNONYMS: Record<string, string> = {
  brand: "marca",
  gtin: "ean",
  codigodebarras: "ean",
  codigodebarraseangtin: "ean",
  model: "modelo",
};

/** Normalizes an attribute name so "Marca", "marca" and "brand" collide instead of duplicating. */
export function attributeKey(name: string) {
  const normalized = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return SYNONYMS[normalized] ?? normalized;
}

/** Adds suggested attributes that carry a value, never overwriting or duplicating what the seller already confirmed. */
export function mergeSuggestedAttributes(current: Record<string, string>, suggested: SuggestedAttribute[]) {
  const merged = { ...current };
  const taken = new Set(Object.keys(current).map(attributeKey));
  for (const attribute of suggested) {
    const name = attribute.name.trim();
    const value = attribute.value.trim();
    if (!name || !value) continue;
    const key = attributeKey(name);
    if (!key || taken.has(key)) continue;
    merged[name] = value;
    taken.add(key);
  }
  return merged;
}
