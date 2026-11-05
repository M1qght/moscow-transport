<script setup lang="ts">
import { computed } from 'vue';
import { LMap, LTileLayer, LMarker, LIcon } from '@vue-leaflet/vue-leaflet';
import { NInput, NButton, NAlert, NSpin } from 'naive-ui';
import { Search, ArrowUpRight, ArrowRight, MapPin, BusFront, TramFront, UsersRound, Clock3, RefreshCw } from 'lucide-vue-next';
import LoadReportForm from '../components/LoadReportForm.vue';
import { useTransportMap } from '../composables/useTransportMap';
import type { Route } from '../types';
const { stops, selected, routeId, search, transport, load, loading, error, center, zoom, filtered, routes, select, refresh, fetchStops } = useTransportMap();
const activeRoute = computed(() => routes.value.find(r => r.id === routeId.value));
const loadLabel = computed(() => load.value?.current.load === null || !load.value ? 'Нет свежих отметок' : load.value.current.load < 35 ? 'Можно ехать свободно' : load.value.current.load < 70 ? 'Есть свободные места' : 'В салоне тесно');
const chooseRoute = (r: Route) => { routeId.value = r.id; };
</script>
<template>
  <section class="map-page">
    <div class="page-intro"><div><p class="eyebrow"><span class="eyebrow__dot"></span> ГОРОД ДВИЖЕТСЯ. ВЫ В КУРСЕ.</p><h1>Знайте, где <span>свободнее.</span></h1><p class="page-intro__description">Загруженность автобусов и трамваев — глазами пассажиров.</p></div><div class="page-intro__aside"><UsersRound :size="22" /><span>Ваша поездка.<br><strong>Общая картина.</strong></span></div></div>
    <NAlert v-if="error" type="error" class="map-page__alert">{{ error }} <NButton size="small" @click="fetchStops">Повторить</NButton></NAlert>
    <div class="transport-workspace">
      <aside class="stop-browser">
        <div class="stop-browser__search"><h2>Найдём вашу остановку</h2><NInput v-model:value="search" placeholder="Название остановки" clearable aria-label="Поиск остановки"><template #prefix><Search :size="17" /></template></NInput><div class="transport-filter"><button v-for="item in [{ value: 'ALL', label: 'Все' }, { value: 'BUS', label: 'Автобусы' }, { value: 'TRAM', label: 'Трамваи' }]" :key="item.value" :class="['transport-filter__button', { 'transport-filter__button_active': transport === item.value }]" @click="transport = item.value as typeof transport">{{ item.label }}</button></div></div>
        <div class="stop-browser__list-heading"><span>ОСТАНОВКИ РЯДОМ</span><span>{{ filtered.length }}</span></div>
        <div class="stop-browser__list"><button v-for="stop in filtered" :key="stop.id" :class="['stop-card', { 'stop-card_selected': selected?.id === stop.id }]" @click="select(stop)"><span class="stop-card__icon"><MapPin :size="19" /></span><span class="stop-card__body"><strong>{{ stop.name }}</strong><span class="stop-card__routes"><span v-for="rs in stop.routeStops" :key="rs.route.id" class="route-badge"><component :is="rs.route.type === 'TRAM' ? TramFront : BusFront" :size="11" />{{ rs.route.number }}</span></span></span><ArrowUpRight :size="16" /></button><p v-if="!filtered.length" class="empty-state">Остановки не найдены. Измените поиск или импортируйте транспортные данные.</p></div>
        <div class="stop-browser__hint"><span class="stop-browser__hint-icon">i</span><p>Каждая отметка делает<br>следующую поездку понятнее.</p></div>
      </aside>
      <div class="transport-map">
        <LMap v-model:zoom="zoom" :center="center" :use-global-leaflet="false" :options="{ zoomControl: false }" class="transport-map__canvas">
          <LTileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap &copy; CARTO" />
          <LMarker v-for="stop in filtered" :key="stop.id" :lat-lng="[stop.lat, stop.lon]" @click="select(stop)"><LIcon :icon-size="[32, 38]" :icon-anchor="[16, 38]"><div :class="['stop-pin', { 'stop-pin_selected': selected?.id === stop.id }]"><BusFront :size="16" /></div></LIcon></LMarker>
        </LMap>
        <div class="transport-map__tag"><span class="eyebrow__dot"></span> {{ stops.some(s => s.source === 'DEMO') ? 'ДЕМО · УЧЕБНЫЕ ДАННЫЕ' : 'КРАУДСОРСИНГ · МОСКВА' }}</div>
        <div class="transport-map__zoom"><button aria-label="Приблизить" @click="zoom = Math.min(zoom + 1, 19)">+</button><button aria-label="Отдалить" @click="zoom = Math.max(zoom - 1, 3)">−</button></div>
        <div class="transport-map__legend"><span><i class="transport-map__legend-dot"></i> Остановка</span><span>Выберите точку на карте</span></div>
      </div>
      <aside class="load-panel" v-if="selected">
        <div class="load-panel__stop"><p class="eyebrow">ВЫБРАННАЯ ОСТАНОВКА</p><h2>{{ selected.name }}</h2><span>{{ selected.source === 'DEMO' ? 'Учебное направление · не расписание' : 'Данные открытого источника' }}</span></div>
        <div class="load-panel__routes"><button v-for="route in routes" :key="route.id" :class="['route-choice', { 'route-choice_active': routeId === route.id }]" @click="chooseRoute(route)"><component :is="route.type === 'TRAM' ? TramFront : BusFront" :size="16" /> {{ route.number }}</button><p v-if="!routes.length">Нет маршрутов выбранного типа.</p></div>
        <div v-if="routeId" class="load-summary"><div class="load-summary__heading"><span>Сейчас в {{ activeRoute?.type === 'TRAM' ? 'трамвае' : 'автобусе' }}</span><button aria-label="Обновить данные" @click="refresh"><RefreshCw :size="14" /></button></div><NSpin :show="loading"><div class="load-summary__number">{{ load?.current.load ?? '—' }}<span v-if="load?.current.load != null">%</span></div></NSpin><p class="load-summary__label">{{ loadLabel }}</p><div class="load-summary__track"><span :style="{ width: `${load?.current.load ?? 0}%`, background: (load?.current.load ?? 0) > 70 ? '#ca6b42' : '#589276' }"></span></div><p class="load-summary__meta"><Clock3 :size="12" /> {{ load?.current.samples ?? 0 }} отметок за 20 минут</p></div>
        <div v-if="load?.nextStop" class="prediction-card"><div class="prediction-card__icon"><ArrowRight :size="18" /></div><div><span>Следующая остановка</span><strong>{{ load.nextStop.name }}</strong><p>{{ load.prediction?.load == null ? 'Пока недостаточно данных' : `Ожидаем около ${load.prediction.load}%` }}</p><small v-if="load.prediction?.load != null">{{ load.prediction.confidence === 'combined' ? 'История + свежая отметка' : load.prediction.confidence === 'history' ? 'Только исторические отметки' : 'Только предыдущая остановка' }}</small></div></div>
        <div v-else-if="routeId && load" class="prediction-card">Конечная остановка направления</div>
        <LoadReportForm v-if="routeId" :stop-id="selected.id" :route-id="routeId" @sent="refresh" />
      </aside><aside v-else class="load-panel empty-state">Выберите остановку на карте</aside>
    </div>
    <div class="map-page__footnote"><span><span class="eyebrow__dot"></span> Обновление каждые 30 секунд</span><p>Это оценка пассажиров, а не датчики транспорта. Прогноз может отличаться от реальности.</p></div>
  </section>
</template>
