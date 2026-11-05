import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const db = new PrismaClient();
const stopSchema = z.object({ id: z.string().min(1), name: z.string().min(1), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
const datasetSchema = z.object({
  source: z.string().min(1), sourceUrl: z.string().url(),
  stops: z.array(stopSchema).min(1),
  routes: z.array(z.object({ id: z.string().min(1), number: z.string().min(1), title: z.string().min(1), type: z.enum(['BUS', 'TRAM']), stopIds: z.array(z.string()).min(2) })).default([]),
});
type Dataset = z.infer<typeof datasetSchema>;
type OsmElement = { type: string; id: number; lat?: number; lon?: number; tags?: Record<string, string>; members?: { type: string; ref: number; role: string }[] };
async function osm(): Promise<Dataset> {
  // Ограниченный фрагмент центра. Не скачиваем всю Москву на каждом запуске.
  const query = '[out:json][timeout:60];relation["type"="route"]["route"~"^(bus|tram)$"](55.74,37.61,55.78,37.67);out body;node(r);out body;';
  const response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(90000), headers: { 'User-Agent': 'moscow-transit-load/1.0 (local import)' } });
  if (!response.ok) throw new Error(`Overpass: ${response.status}. Попробуйте позже или используйте --file.`);
  const raw = await response.json() as { elements: OsmElement[]; remark?: string };
  if (raw.remark) throw new Error(raw.remark);
  const nodes = new Map(raw.elements.filter(e => e.type === 'node').map(e => [e.id, e]));
  const stops = new Map<string, z.infer<typeof stopSchema>>();
  const routes: Dataset['routes'] = [];
  for (const r of raw.elements.filter(e => e.type === 'relation')) {
    if (!r.tags?.ref) continue;
    const members = r.members ?? [];
    const stopMembers = members.filter(m => m.type === 'node' && /^stop($|_)/.test(m.role));
    const chosen = stopMembers.length ? stopMembers : members.filter(m => m.type === 'node' && /^platform($|_)/.test(m.role));
    const stopIds: string[] = [];
    for (const m of chosen) {
      const n = nodes.get(m.ref);
      if (!n || n.lat == null || n.lon == null || !n.tags?.name) continue;
      const id = `osm-node-${n.id}`;
      if (stopIds.includes(id)) continue;
      stops.set(id, { id, name: n.tags.name, lat: n.lat, lon: n.lon }); stopIds.push(id);
    }
    if (stopIds.length >= 2) routes.push({ id: `osm-route-${r.id}`, number: r.tags.ref, title: r.tags.name ?? `${r.tags.from ?? ''} → ${r.tags.to ?? ''}`, type: r.tags.route === 'tram' ? 'TRAM' : 'BUS', stopIds });
  }
  return { source: 'OpenStreetMap', sourceUrl: 'https://www.openstreetmap.org/copyright', stops: [...stops.values()], routes };
}
async function mos(file: string): Promise<Dataset> {
  const raw = JSON.parse(await readFile(file, 'utf8'));
  const rows = z.array(z.object({ global_id: z.union([z.string(), z.number()]).optional(), Cells: z.record(z.unknown()).optional() }).passthrough()).parse(raw);
  const stops = rows.map(row => {
    const c = row.Cells ?? row;
    const geometry = z.object({ coordinates: z.tuple([z.number(), z.number()]) }).parse(c.geoData);
    return stopSchema.parse({ id: `mos-${c.global_id ?? row.global_id ?? c.ID}`, name: c.Name, lon: geometry.coordinates[0], lat: geometry.coordinates[1] });
  });
  return { source: 'data.mos.ru', sourceUrl: 'https://data.mos.ru/opendata/752', stops, routes: [] };
}
async function main() {
  const args = process.argv.slice(2);
  let data: Dataset;
  if (args[0] === '--osm') data = await osm();
  else if (args[0] === '--mos-file' && args[1]) data = await mos(args[1]);
  else if (args[0] === '--file' && args[1]) data = JSON.parse(await readFile(args[1], 'utf8'));
  else throw new Error('Используйте --osm, --mos-file export.json или --file dataset.json');
  data = datasetSchema.parse(data);
  if (new Set(data.stops.map(s => s.id)).size !== data.stops.length || new Set(data.routes.map(r => r.id)).size !== data.routes.length) throw new Error('Повторяющиеся id');
  const ids = new Set(data.stops.map(s => s.id));
  for (const r of data.routes) if (new Set(r.stopIds).size !== r.stopIds.length || r.stopIds.some(s => !ids.has(s))) throw new Error(`Некорректный порядок/состав остановок: ${r.id}`);
  await db.$transaction(async tx => {
    for (const s of data.stops) {
      const value = { ...s, source: data.source, sourceUrl: data.sourceUrl, importedAt: new Date() };
      await tx.stop.upsert({ where: { id: s.id }, create: value, update: value });
    }
    for (const { stopIds, ...r } of data.routes) {
      const value = { ...r, source: data.source, sourceUrl: data.sourceUrl };
      await tx.route.upsert({ where: { id: r.id }, create: value, update: value });
      await tx.routeStop.deleteMany({ where: { routeId: r.id } });
      await tx.routeStop.createMany({ data: stopIds.map((stopId, order) => ({ stopId, routeId: r.id, order })) });
    }
  }, { timeout: 120000 });
  console.log(`Импортировано остановок: ${data.stops.length}; направлений: ${data.routes.length}. Источник: ${data.source}. Данные загруженности не импортируются.`);
}
main().finally(() => db.$disconnect());
