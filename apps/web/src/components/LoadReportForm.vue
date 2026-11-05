<script setup lang="ts">
import { ref } from 'vue';
import { NButton, NRadioGroup, NRadioButton, useMessage } from 'naive-ui';
import { Send } from 'lucide-vue-next';
import ReportSlider from './ReportSlider.vue';
import { useAuthStore } from '../stores/auth';
import { api, json } from '../api';
const props = defineProps<{ stopId: string; routeId: string }>();
const emit = defineEmits<{ sent: [] }>();
const auth = useAuthStore();
const message = useMessage();
const load = ref(40);
const action = ref('RIDING');
const busy = ref(false);
async function submit() {
  busy.value = true;
  try { await api('/reports', json({ stopId: props.stopId, routeId: props.routeId, load: load.value, action: action.value })); message.success('Спасибо! Отметка уже участвует в расчёте.'); emit('sent'); }
  catch (e) { message.error((e as Error).message); }
  finally { busy.value = false; }
}
</script>
<template>
  <form class="load-report-form" @submit.prevent="submit">
    <div class="load-report-form__heading"><h3>Как там сейчас?</h3><span>Ваша отметка поможет другим</span></div>
    <NRadioGroup v-model:value="action" name="action" class="load-report-form__actions" :disabled="!auth.user"><NRadioButton value="BOARDED">Вошёл</NRadioButton><NRadioButton value="ALIGHTED">Вышел</NRadioButton><NRadioButton value="RIDING">Еду</NRadioButton></NRadioGroup>
    <ReportSlider v-model="load" />
    <NButton v-if="auth.user" type="primary" attr-type="submit" block :disabled="!routeId" :loading="busy"><Send :size="16" /> Отправить отметку</NButton>
    <RouterLink v-else to="/login" class="load-report-form__login">Войдите, чтобы оставить отметку →</RouterLink>
    <p class="load-report-form__note">0% — пустой салон · 100% — полная посадка и стоячие места</p>
  </form>
</template>
