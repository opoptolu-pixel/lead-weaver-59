
-- Delete duplicate page views (same visitor + same page within 5 minutes, keep the first one)
DELETE FROM page_views
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY visitor_id, page_path, 
          date_trunc('minute', created_at) -- group by same minute
        ORDER BY created_at ASC
      ) as rn
    FROM page_views
  ) sub
  WHERE rn > 1
);
