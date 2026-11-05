import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api, json, setToken } from '../api';
import type { User } from '../types';
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const ready = ref(false);
  async function restore() {
    try {
      const session = await api<{ accessToken: string; user: User }>('/auth/refresh', { method: 'POST' });
      user.value = session.user; setToken(session.accessToken);
    } catch { user.value = null; setToken(null); }
    finally { ready.value = true; }
  }
  async function signIn(login: string, password: string, name?: string) {
    const session = await api<{ accessToken: string; user: User }>(name ? '/auth/register' : '/auth/login', json({ login, password, ...(name ? { name } : {}) }));
    user.value = session.user; setToken(session.accessToken);
  }
  async function refreshUser() { user.value = await api<User>('/auth/me'); }
  async function logout() { await api('/auth/logout', { method: 'POST' }); user.value = null; setToken(null); }
  return { user, ready, restore, signIn, logout, refreshUser };
});
