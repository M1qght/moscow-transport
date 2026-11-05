<script setup lang="ts">
import { NConfigProvider, NMessageProvider, NButton, NAlert } from 'naive-ui';
import { ref } from 'vue';
import { ArrowUpRight, BusFront, Map, UserRound, ShieldCheck } from 'lucide-vue-next';
import { useAuthStore } from './stores/auth';
import { useRouter } from 'vue-router';
const auth = useAuthStore();
const router = useRouter();
const logoutError = ref('');
const theme = { common: { primaryColor: '#245744', primaryColorHover: '#34765e', primaryColorPressed: '#183e31', borderRadius: '9px', fontFamily: 'Inter, Segoe UI, sans-serif' } };
async function logout() { try { logoutError.value = ''; await auth.logout(); await router.push('/'); } catch (e) { logoutError.value = (e as Error).message; } }
</script>
<template>
  <NConfigProvider :theme-overrides="theme"><NMessageProvider>
    <div class="app-shell">
      <header class="app-header">
        <RouterLink to="/" class="app-header__brand"><span class="app-header__symbol"><BusFront :size="23" /></span><span>попутно<span class="app-header__brand-dot">.</span></span><span class="app-header__city">МОСКВА</span></RouterLink>
        <nav class="app-header__nav" aria-label="Основная навигация">
          <RouterLink to="/"><Map :size="16" /> Карта</RouterLink>
          <RouterLink v-if="auth.user" to="/profile"><UserRound :size="16" /> Мой профиль</RouterLink>
          <RouterLink v-if="auth.user?.role === 'ADMIN'" to="/admin"><ShieldCheck :size="16" /> Модерация</RouterLink>
        </nav>
        <div class="app-header__account"><template v-if="auth.user"><span class="app-header__username">{{ auth.user.name }}</span><NButton quaternary @click="logout">Выйти</NButton></template><NButton v-else type="primary" @click="router.push('/login')">Войти <ArrowUpRight :size="16" /></NButton></div>
      </header>
      <NAlert v-if="logoutError" type="error">{{ logoutError }}</NAlert>
      <main><RouterView /></main>
      <footer class="app-footer"><span>Попутно © {{ new Date().getFullYear() }}</span><span>Меньше неизвестности. Больше места.</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></footer>
    </div>
  </NMessageProvider></NConfigProvider>
</template>
