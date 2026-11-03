# Why sign-in stalled, and how to stop it happening again

## What caused it
- The backend ran out of its disk read/write allowance at 03:37 UTC today ("IO budget less than 50%" alert). When that allowance runs out, the database slows to a crawl, and sign-in stopped working for everyone.
- The main cause: the scheduled-task history log has grown to **682 MB out of the 710 MB total database**. Nothing ever clears it.
- That log grows every minute. The "process scheduled emails" task runs every minute (about 1,440 times a day), and other tasks run every 5 minutes or every hour. Each run adds a row and writes to disk.
- Your real business data is small (everything else is under 10 MB). Memory, connections and disk space are fine right now (13% disk, 45% memory).

## Fix
1. **One-off cleanup:** delete scheduled-task history older than 7 days, then reclaim the space. This should take the database from about 710 MB down to under 50 MB.
2. **Automatic daily cleanup:** add a nightly task (03:00 UTC) that deletes task history older than 7 days, so the log can never grow like this again.
3. **Less frequent email checks:** run "process scheduled emails" every 5 minutes instead of every minute. That's 80% fewer runs. Scheduled emails may go out up to 5 minutes later. (Skip this step if emails must go out within a minute.)
4. **Check the result:** confirm the database size has dropped and the read/write alert doesn't come back. Then re-check database health over the next day.

## Optional, only if alerts return
- Move the backend to a larger size. I don't recommend this yet: the cause is the history log, not traffic.

## Not touched
- No changes to the app's screens, lead logic, payments, or anything on the Manchester managed side.

## Technical details
- `cron.job_run_details` is 682 MB, `n_live_tup` reported as 0 because stats were reset when the backend restarted.
- Cleanup: `DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'; VACUUM FULL cron.job_run_details;`. Run this through run_sql, not a migration, because VACUUM can't run inside a transaction.
- Schedule: `cron.schedule('purge-cron-history-daily','0 3 * * *', $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$)`.
- `cron.alter_job` on `process-scheduled-emails` to `*/5 * * * *`.
