export const medicalSources = [
  "ror",
  "osm",
  "geofabrik",
  "icd11",
  "icd10",
  "pubmed",
  "orphadata",
] as const;
export type MedicalSource = (typeof medicalSources)[number];
export function isMedicalSource(value: unknown): value is MedicalSource {
  return medicalSources.some((source) => source === value);
}

export type MedicalRecord = {
  id: string;
  source: MedicalSource;
  sourceId: string;
  title: string;
  description: string;
  code: string;
  url: string;
  dataLanguage: string;
  version: string;
  fetchedAt: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
};
export type MedicalSearch = {
  source: MedicalSource;
  query: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
};
export type MedicalResult = {
  records: MedicalRecord[];
  source: MedicalSource;
  total: number | null;
  truncated: boolean;
  fetchedAt: string;
  dataLanguage: string;
};
export const medicalAttribution: Record<
  MedicalSource,
  { label: string; license: string; url: string }
> = {
  ror: { label: "Research Organization Registry", license: "CC0", url: "https://ror.org/" },
  osm: {
    label: "© OpenStreetMap contributors",
    license: "ODbL",
    url: "https://www.openstreetmap.org/copyright",
  },
  geofabrik: {
    label: "Geofabrik / © OpenStreetMap contributors",
    license: "ODbL",
    url: "https://www.geofabrik.de/data/download.html",
  },
  icd11: {
    label: "World Health Organization — ICD-11 MMS",
    license: "CC BY-ND 3.0 IGO",
    url: "https://icd.who.int/docs/icd-api/license/",
  },
  icd10: {
    label: "World Health Organization — ICD-10",
    license: "WHO terms of use",
    url: "https://icd.who.int/",
  },
  pubmed: {
    label: "PubMed / U.S. National Library of Medicine",
    license: "NLM terms; publisher rights apply",
    url: "https://www.ncbi.nlm.nih.gov/home/about/policies/",
  },
  orphadata: {
    label: "Orphadata / Orphanet",
    license: "CC BY 4.0",
    url: "https://www.orphadata.com/",
  },
};

export function filterMedicalRecords(
  records: MedicalRecord[],
  source: MedicalSource,
  query: string,
  area?: Pick<MedicalSearch, "latitude" | "longitude" | "radius">,
) {
  const needle = query.trim().toLocaleLowerCase();
  return records.filter(
    (record) =>
      record.source === source &&
      (source !== "osm" ||
        !area ||
        !Number.isFinite(area.latitude) ||
        !Number.isFinite(area.longitude) ||
        (record.latitude !== null &&
          record.longitude !== null &&
          distanceMeters(area.latitude!, area.longitude!, record.latitude, record.longitude) <=
            (area.radius ?? 5000))) &&
      `${record.title} ${record.code} ${record.description}`.toLocaleLowerCase().includes(needle),
  );
}

function distanceMeters(lat: number, lon: number, targetLat: number, targetLon: number) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const a =
    Math.sin(radians(targetLat - lat) / 2) ** 2 +
    Math.cos(radians(lat)) *
      Math.cos(radians(targetLat)) *
      Math.sin(radians(targetLon - lon) / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
