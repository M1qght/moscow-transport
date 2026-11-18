import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { api } from '../api';
import type { LoadData, Stop } from '../types';

export function useTransportMap() {
  const stops = ref<Stop[]>([]);
  const selected = ref<Stop | null>(null);
  const routeId = ref('');
  const search = ref('');
  const transport = ref<'ALL' | 'BUS' | 'TRAM'>('ALL');
  const load = ref<LoadData | null>(null);
  const loading = ref(false);
  const error = ref('');
  const center = ref<[number, number]>([55.758, 37.64]);
  const zoom = ref(14);
  const filtered = computed(() =>
    stops.value.filter(
      (s) =>
        s.name.toLocaleLowerCase('ru').includes(search.value.toLocaleLowerCase('ru')) &&
        (transport.value === 'ALL' || s.routeStops.some((rs) => rs.route.type === transport.value)),
    ),
  );
  const routes = computed(
    () =>
      selected.value?.routeStops
        .filter((rs) => transport.value === 'ALL' || rs.route.type === transport.value)
        .map((rs) => rs.route) ?? [],
  );
  let request = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  async function refresh() {
    const current = ++request;
    if (!selected.value || !routeId.value) {
      load.value = null;
      return;
    }
    loading.value = true;
    try {
      const result = await api<LoadData>(
        `/stops/${encodeURIComponent(selected.value.id)}/load?routeId=${encodeURIComponent(routeId.value)}`,
      );
      if (current === request) {
        load.value = result;
        error.value = '';
      }
    } catch (e) {
      if (current === request) error.value = (e as Error).message;
    } finally {
      if (current === request) loading.value = false;
    }
  }
  function select(stop: Stop) {
    selected.value = stop;
    center.value = [stop.lat, stop.lon];
  }
  async function fetchStops() {
    try {
      stops.value = await api<Stop[]>('/stops?limit=1000');
      error.value = '';
      if (!selected.value && stops.value.length)
        select(stops.value.find((s) => s.id === 'demo-chistye') ?? stops.value[0]);
    } catch (e) {
      error.value = (e as Error).message;
    }
  }
  watch(routes, (value) => {
    if (!value.some((r) => r.id === routeId.value)) routeId.value = value[0]?.id ?? '';
  });
  watch([selected, routeId], () => {
    load.value = null;
    void refresh();
  });
  onMounted(() => {
    void fetchStops();
    timer = setInterval(() => {
      void refresh();
    }, 30000);
  });
  onUnmounted(() => {
    clearInterval(timer);
    request++;
  });
  return {
    stops,
    selected,
    routeId,
    search,
    transport,
    load,
    loading,
    error,
    center,
    zoom,
    filtered,
    routes,
    select,
    refresh,
    fetchStops,
  };
}
