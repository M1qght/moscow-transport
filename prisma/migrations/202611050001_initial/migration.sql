CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "TransportType" AS ENUM ('BUS', 'TRAM');
CREATE TYPE "ReportAction" AS ENUM ('BOARDED', 'ALIGHTED', 'RIDING');
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');
CREATE TYPE "TicketType" AS ENUM ('COMPLAINT', 'QUESTION');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

CREATE TABLE "users" (
  "id" TEXT NOT NULL, "login" TEXT NOT NULL, "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL, "role" "Role" NOT NULL DEFAULT 'USER',
  "rating" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "refresh_sessions" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "stops" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "lat" DOUBLE PRECISION NOT NULL,
  "lon" DOUBLE PRECISION NOT NULL, "source" TEXT NOT NULL, "sourceUrl" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stops_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stops_coordinates_check" CHECK ("lat" BETWEEN -90 AND 90 AND "lon" BETWEEN -180 AND 180)
);
CREATE TABLE "routes" (
  "id" TEXT NOT NULL, "number" TEXT NOT NULL, "title" TEXT NOT NULL,
  "type" "TransportType" NOT NULL, "source" TEXT NOT NULL, "sourceUrl" TEXT,
  CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "route_stops" (
  "routeId" TEXT NOT NULL, "stopId" TEXT NOT NULL, "order" INTEGER NOT NULL,
  CONSTRAINT "route_stops_pkey" PRIMARY KEY ("routeId", "stopId"),
  CONSTRAINT "route_stops_order_check" CHECK ("order" >= 0)
);
CREATE TABLE "reports" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "stopId" TEXT NOT NULL,
  "routeId" TEXT NOT NULL, "load" INTEGER NOT NULL, "action" "ReportAction" NOT NULL,
  "status" "ReportStatus" NOT NULL DEFAULT 'PENDING', "isDemo" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reports_load_check" CHECK ("load" BETWEEN 0 AND 100)
);
CREATE TABLE "ratings_history" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "reportId" TEXT,
  "delta" INTEGER NOT NULL, "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ratings_history_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "tickets" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "type" "TicketType" NOT NULL,
  "subject" TEXT NOT NULL, "body" TEXT NOT NULL, "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
  "reply" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "admin_logs" (
  "id" TEXT NOT NULL, "adminId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "targetId" TEXT NOT NULL, "details" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_login_key" ON "users"("login");
CREATE INDEX "refresh_sessions_expiresAt_idx" ON "refresh_sessions"("expiresAt");
CREATE UNIQUE INDEX "route_stops_routeId_order_key" ON "route_stops"("routeId", "order");
CREATE INDEX "route_stops_stopId_idx" ON "route_stops"("stopId");
CREATE INDEX "reports_stopId_routeId_createdAt_idx" ON "reports"("stopId", "routeId", "createdAt");
CREATE INDEX "reports_userId_stopId_createdAt_idx" ON "reports"("userId", "stopId", "createdAt");
CREATE INDEX "reports_createdAt_idx" ON "reports"("createdAt");
CREATE INDEX "ratings_history_userId_createdAt_idx" ON "ratings_history"("userId", "createdAt");
CREATE INDEX "tickets_status_createdAt_idx" ON "tickets"("status", "createdAt");
CREATE INDEX "admin_logs_createdAt_idx" ON "admin_logs"("createdAt");

ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ratings_history" ADD CONSTRAINT "ratings_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ratings_history" ADD CONSTRAINT "ratings_history_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
