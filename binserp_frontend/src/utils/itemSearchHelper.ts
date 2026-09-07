import { apiGet } from "@/src/lib/api";
import { SearchableOption } from "@/src/features/store/components/SearchableSelect";

/**
 * Fast asynchronous keyword search helper across store items (RM, BO, Consumables, FG)
 * @param query keyword or code to search
 * @param type item category ('all', 'rm', 'bo', 'consumable', 'fg', or comma-separated)
 * @param limit max items to return (default 30)
 */
export const searchStoreItemsApi = async (
  query: string,
  type: string = 'all',
  limit: number = 30
): Promise<SearchableOption[]> => {
  try {
    const params = new URLSearchParams({
      query: query.trim(),
      type,
      limit: String(limit)
    });
    const res = await apiGet(`/api/store/items/search?${params.toString()}`);
    return (res.items || []).map((item: any) => ({
      value: item.value,
      label: item.label,
      description: item.description,
      code: item.code,
      badge: item.badge,
      subBadge: item.subBadge,
      unit: item.unit,
      itemType: item.itemType,
      currentStock: item.currentStock,
      ...item
    }));
  } catch (err) {
    console.error("searchStoreItemsApi error:", err);
    return [];
  }
};
