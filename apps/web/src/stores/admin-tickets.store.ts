import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api, json } from '../api';
import type { Page, Ticket } from '../types';
export const useAdminTicketsStore = defineStore('admin-tickets', () => {
  const items = ref<Ticket[]>([]); const total = ref(0); const page = ref(1); const status = ref<string | null>(null); const type = ref<string | null>(null);
  async function fetchTickets() {
    const query = new URLSearchParams({ page: String(page.value) });
    if (status.value) query.set('status', status.value);
    if (type.value) query.set('type', type.value);
    const result = await api<Page<Ticket>>(`/admin/tickets?${query}`); items.value = result.items; total.value = result.total;
  }
  async function update(ticketId: string, nextStatus: string, reply: string) { await api(`/admin/tickets/${ticketId}`, json({ status: nextStatus, reply }, 'PATCH')); await fetchTickets(); }
  return { items, total, page, status, type, fetchTickets, update };
});
