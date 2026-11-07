import { createCollection, localStorageCollectionOptions } from "@tanstack/db";

import type { MedicalRecord } from "@/src/lib/medical-catalog";

// Public source records only. No patient data, query history or user edits.
// These are downloaded references, not a writable Convex-synchronized collection.
export function createMedicalCache(storage: Storage) {
  return createCollection(
    localStorageCollectionOptions<MedicalRecord>({
      id: "cure-public-medical-cache-v1",
      storageKey: "cure.public-medical-cache.v1",
      storage,
      getKey: (row) => row.id,
    }),
  );
}
export async function saveMedicalRecords(
  collection: ReturnType<typeof createMedicalCache>,
  records: MedicalRecord[],
) {
  await collection.toArrayWhenReady();
  const incoming = new Map(records.map((record) => [record.id, record]));
  const updates = [...incoming.keys()].filter((id) => collection.has(id));
  const inserts = [...incoming.values()].filter((record) => !collection.has(record.id));
  if (updates.length)
    await collection
      .update(updates, (drafts) => {
        for (const draft of drafts) Object.assign(draft, incoming.get(draft.id));
      })
      .when("settled");
  if (inserts.length) await collection.insert(inserts).when("settled");
  const all = collection.toArray;
  if (all.length > 1000) {
    const old = all
      .filter((record) => !incoming.has(record.id))
      .sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt))
      .slice(0, all.length - 1000);
    if (old.length) await collection.delete(old.map((record) => record.id)).when("settled");
  }
}
