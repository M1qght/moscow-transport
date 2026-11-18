export interface User {
  id: string;
  login: string;
  name: string;
  role: 'USER' | 'ADMIN';
  rating: number;
}
export interface Route {
  id: string;
  number: string;
  title: string;
  type: 'BUS' | 'TRAM';
  source: string;
}
export interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  source: string;
  sourceUrl?: string;
  routeStops: { route: Route; order: number }[];
}
export interface LoadData {
  current: {
    load: number | null;
    samples: number;
    lastReportAt: string | null;
    windowMinutes: number;
  };
  nextStop: Stop | null;
  prediction: {
    load: number | null;
    historical: number | null;
    historySamples: number;
    previousLoad: number | null;
    confidence: string;
  } | null;
}
export interface Report {
  id: string;
  load: number;
  action: string;
  status: string;
  createdAt: string;
  isDemo: boolean;
  user?: User;
  stop: Stop;
  route: Route;
}
export interface Ticket {
  id: string;
  type: string;
  subject: string;
  body: string;
  status: string;
  reply: string | null;
  createdAt: string;
  user?: User;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
}
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  }).format(new Date(value));
export const statusLabel: Record<string, string> = {
  PENDING: 'На проверке',
  CONFIRMED: 'Подтверждена',
  REJECTED: 'Недостоверная',
  OPEN: 'Открыт',
  IN_PROGRESS: 'В работе',
  CLOSED: 'Закрыт',
};
