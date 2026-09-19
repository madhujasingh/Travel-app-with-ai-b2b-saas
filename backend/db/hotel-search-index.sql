-- Index for hotel name search (GET /hotel-catalog/search).
--
-- Run once against the database. Hibernate cannot create this from an
-- annotation - it is a GIN index over a trigram operator class, which has no
-- JPA equivalent - so it has to be applied by hand. ddl-auto=update leaves it
-- alone once created.
--
-- Why it is needed: the search matches with ILIKE '%term%', and a leading
-- wildcard makes a btree index unusable. Without this, every keystroke scans
-- all 175,000+ rows. The query is written to work either way, so search is
-- correct without this index and merely slow.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Matches the WHERE clause in HotelRepository.searchByName: one index for the
-- name on its own, one for the name-and-city form so "taj mumbai" is also
-- indexed rather than falling back to a scan.
CREATE INDEX IF NOT EXISTS hotels_name_trgm
    ON hotels USING gin (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS hotels_name_city_trgm
    ON hotels USING gin (lower(name || ' ' || coalesce(city, '')) gin_trgm_ops);

-- Confirm they are being used:
--   EXPLAIN ANALYZE SELECT * FROM hotels
--   WHERE lower(name) LIKE lower('%taj jumeirah%') LIMIT 20;
-- Expect a Bitmap Index Scan on hotels_name_trgm, not a Seq Scan.
