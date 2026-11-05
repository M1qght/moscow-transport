<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NButton, NInput, NSelect, NPagination, NTag, useMessage } from 'naive-ui';
import { Award, MessageSquare } from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import { api, json } from '../api';
import { dateLabel, statusLabel, type Page, type Report, type Ticket } from '../types';
const auth = useAuthStore(); const message = useMessage();
const history = ref<Page<Report>>({ items: [], total: 0, page: 1 });
const tickets = ref<Ticket[]>([]);
const ratings = ref<{ id: string; delta: number; reason: string; createdAt: string }[]>([]);
const page = ref(1); const busy = ref(false);
const type = ref('QUESTION'); const subject = ref(''); const body = ref('');
async function fetchData() {
  try { const [reports, myTickets, myRatings] = await Promise.all([api<Page<Report>>(`/me/reports?page=${page.value}`), api<Ticket[]>('/me/tickets'), api<typeof ratings.value>('/me/ratings')]); history.value = reports; tickets.value = myTickets; ratings.value = myRatings; await auth.refreshUser(); }
  catch (e) { message.error((e as Error).message); }
}
async function sendTicket() { busy.value = true; try { await api('/tickets', json({ type: type.value, subject: subject.value, body: body.value })); subject.value = ''; body.value = ''; message.success('Обращение отправлено'); await fetchData(); } catch (e) { message.error((e as Error).message); } finally { busy.value = false; } }
onMounted(fetchData);
</script>
<template>
  <section class="content-page"><div class="page-intro"><div><p class="eyebrow">ЛИЧНЫЙ КАБИНЕТ</p><h1>Привет, {{ auth.user?.name }}.</h1><p class="page-intro__description">Ваш вклад в более понятные поездки.</p></div><div class="rating-card"><Award :size="30" /><strong>{{ auth.user?.rating ?? 0 }}</strong><span>{{ (auth.user?.rating ?? 0) >= 20 ? 'Доверенный пассажир' : 'Новичок' }}</span></div></div>
    <div class="profile-grid"><div class="surface"><h2>История отметок</h2><div class="table-scroll"><table class="data-table"><thead><tr><th>Остановка / маршрут</th><th>Загрузка</th><th>Статус</th><th>Время, МСК</th></tr></thead><tbody><tr v-for="report in history.items" :key="report.id"><td>{{ report.stop.name }}<small>{{ report.route.number }} {{ report.isDemo ? '· DEMO' : '' }}</small></td><td>{{ report.load }}%</td><td><NTag size="small" :type="report.status === 'CONFIRMED' ? 'success' : report.status === 'REJECTED' ? 'error' : 'default'">{{ statusLabel[report.status] }}</NTag></td><td>{{ dateLabel(report.createdAt) }}</td></tr></tbody></table><p v-if="!history.items.length" class="empty-state">Пока нет отметок. Начните с карты.</p></div><NPagination v-model:page="page" :item-count="history.total" :page-size="25" @update:page="fetchData" /><h3>Изменения рейтинга</h3><p class="muted">Подтверждение +2, недостоверная отметка −3. Статус доверенного — от 20 баллов.</p><div v-for="entry in ratings" :key="entry.id" class="rating-entry"><strong>{{ entry.delta > 0 ? '+' : '' }}{{ entry.delta }}</strong><span>{{ entry.reason }}</span><small>{{ dateLabel(entry.createdAt) }}</small></div><p v-if="!ratings.length" class="muted">Изменений ещё нет.</p></div>
    <div class="surface"><h2><MessageSquare :size="20" /> Связаться с нами</h2><form class="ticket-form" @submit.prevent="sendTicket"><NSelect v-model:value="type" :options="[{ label: 'Вопрос', value: 'QUESTION' }, { label: 'Жалоба', value: 'COMPLAINT' }]" aria-label="Тип обращения" /><NInput v-model:value="subject" placeholder="Тема (от 3 символов)" :maxlength="120" required aria-label="Тема обращения" /><NInput v-model:value="body" type="textarea" placeholder="Расскажите подробнее (от 10 символов)" :maxlength="4000" required aria-label="Текст обращения" /><NButton type="primary" attr-type="submit" :loading="busy">Отправить обращение</NButton></form><h3>Мои обращения</h3><article v-for="ticket in tickets" :key="ticket.id" class="ticket-card"><strong>{{ ticket.subject }}</strong><NTag size="small">{{ statusLabel[ticket.status] }}</NTag><p>{{ ticket.body }}</p><p v-if="ticket.reply" class="ticket-card__reply">Ответ: {{ ticket.reply }}</p></article><p v-if="!tickets.length" class="muted">Здесь появятся обращения и ответы администратора.</p></div></div>
  </section>
</template>
