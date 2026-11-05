import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
export const router = createRouter({ history: createWebHistory(), routes: [
  { path: '/', component: () => import('../views/MapView.vue') },
  { path: '/login', component: () => import('../views/AuthView.vue') },
  { path: '/profile', component: () => import('../views/ProfileView.vue'), meta: { auth: true } },
  { path: '/admin', component: () => import('../views/AdminView.vue'), meta: { admin: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
] });
router.beforeEach(async to => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.restore();
  if ((to.meta.auth || to.meta.admin) && !auth.user) return '/login';
  if (to.meta.admin && auth.user?.role !== 'ADMIN') return '/';
});
