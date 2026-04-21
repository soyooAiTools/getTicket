INSERT INTO "Event" (
  "id",
  "title",
  "city",
  "venueName",
  "venueAddress",
  "coverImageUrl",
  "description",
  "published",
  "refundEntryEnabled",
  "saleStatus",
  "minPrice",
  "createdAt",
  "updatedAt"
) VALUES (
  'event-local-demo-01',
  'Local Smoke Concert',
  'Shanghai',
  'Local Arena',
  '100 Demo Road, Shanghai',
  NULL,
  'Demo event for local load-control smoke runs.',
  true,
  false,
  'ON_SALE',
  980,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "city" = EXCLUDED."city",
  "venueName" = EXCLUDED."venueName",
  "venueAddress" = EXCLUDED."venueAddress",
  "coverImageUrl" = EXCLUDED."coverImageUrl",
  "description" = EXCLUDED."description",
  "published" = EXCLUDED."published",
  "refundEntryEnabled" = EXCLUDED."refundEntryEnabled",
  "saleStatus" = EXCLUDED."saleStatus",
  "minPrice" = EXCLUDED."minPrice",
  "updatedAt" = NOW();

INSERT INTO "EventSession" (
  "id",
  "eventId",
  "name",
  "startsAt",
  "endsAt",
  "saleStartsAt",
  "saleEndsAt",
  "createdAt",
  "updatedAt"
) VALUES (
  'session-local-demo-01',
  'event-local-demo-01',
  '2026-05-01 19:30',
  '2026-05-01T19:30:00.000Z',
  '2026-05-01T22:00:00.000Z',
  '2026-04-01T10:00:00.000Z',
  '2026-06-01T10:00:00.000Z',
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO UPDATE SET
  "eventId" = EXCLUDED."eventId",
  "name" = EXCLUDED."name",
  "startsAt" = EXCLUDED."startsAt",
  "endsAt" = EXCLUDED."endsAt",
  "saleStartsAt" = EXCLUDED."saleStartsAt",
  "saleEndsAt" = EXCLUDED."saleEndsAt",
  "updatedAt" = NOW();

INSERT INTO "TicketTier" (
  "id",
  "sessionId",
  "name",
  "price",
  "inventory",
  "ticketType",
  "createdAt",
  "updatedAt"
) VALUES (
  'tier-local-demo-01',
  'session-local-demo-01',
  'E-Ticket General',
  980,
  500,
  'E_TICKET',
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO UPDATE SET
  "sessionId" = EXCLUDED."sessionId",
  "name" = EXCLUDED."name",
  "price" = EXCLUDED."price",
  "inventory" = EXCLUDED."inventory",
  "ticketType" = EXCLUDED."ticketType",
  "updatedAt" = NOW();
