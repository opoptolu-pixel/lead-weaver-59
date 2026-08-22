# Cleanda Managed Agency Architecture

## Product boundary

Cleanda is the operator of the cleaning service. Customers contract with and pay Cleanda; Cleanda prices, schedules, dispatches and supports every booking; vetted cleaners fulfil assigned appointments and are paid by Cleanda.

The Manchester launch borrows the useful operating structure of modern home-service scheduling platforms: one CRM, calendar-led dispatch, mobile field delivery, integrated communications, quality evidence, payments and provider performance. It is not a marketplace and cleaners never buy leads.

## Roles and data visibility

| Role | Can see | Can change |
| --- | --- | --- |
| Customer | Own requests, quotes, bookings, payments and messages | Own request details before confirmation; permitted reschedule/cancellation requests |
| Cleaner applicant | Own application and documents | Own application, availability and documents |
| Active cleaner | Offered job summary; full details only after acceptance; own schedule, evidence and earnings | Accept/decline offers, clock events, evidence, checklist and completion report |
| Operations admin | All customers, bookings, cleaners, schedules and communications | Quotes, bookings, assignments, quality decisions and operational exceptions |
| Finance admin | Booking economics, payments, refunds and payouts | Payment reconciliation, holds, approvals and payout status |

Addresses, access notes and customer phone numbers must not be available to an offered cleaner until acceptance. Cleaner payout is never customer-visible. Customer price and Cleanda margin are never cleaner-visible.

## Canonical lifecycle

The database is authoritative for every transition. Screens render state; they do not invent it.

```text
request:new
  -> contacted
  -> qualified
  -> quoted
  -> accepted
  -> booking:confirmed
  -> assignment:offered
  -> assignment:accepted
  -> appointment:en_route
  -> appointment:checked_in
  -> appointment:in_progress
  -> appointment:completion_submitted
  -> quality:pending
       -> approved -> payout:approved -> paid -> booking:closed
       -> rework_required -> appointment:in_progress
       -> issue -> payout:held -> resolved or cancelled/refunded
```

Decline, cancellation, expiry and no-show are explicit terminal or exception paths with actor, timestamp and reason.

## Commercial and scheduling records

The target model separates concepts that the current foundation partly combines:

- `service_requests`: unconfirmed customer demand.
- `quotes` and `quote_items`: versioned Cleanda price offers.
- `bookings`: the customer contract and commercial totals.
- `appointments`: individual scheduled visits. A recurring booking owns many appointments.
- `assignment_offers`: the offer history for each appointment.
- `job_assignments`: the accepted cleaner relationship.
- `time_entries`: clock-in/out and approved time corrections.
- `job_checklist_items`: required delivery tasks and completion state.
- `job_evidence`: private before/after proof.
- `quality_reviews`: immutable review decisions and rework cycles.
- `customer_payments`, `refunds` and `cleaner_payouts`: separate financial ledgers.
- `activity_events`: append-only audit history for operational changes.

The current `jobs` table remains the launch-compatible booking/appointment record until a separately tested migration safely splits it. Existing jobs must never be discarded during that evolution.

## Scheduling rules

Every confirmed appointment requires:

- full address and access instructions;
- service, checklist and cleaner-visible requirements;
- confirmed start and expected end/duration;
- customer price and cleaner payout;
- payment state;
- one active assignment at most.

Cleaner eligibility is the intersection of approved/active status, service capability, Greater Manchester coverage, declared availability, travel buffer and absence of an overlapping appointment. Admin may override a warning only with a recorded reason.

## Delivery and quality rules

- A cleaner can clock in only on an accepted assignment.
- At least one before image is required before work completion.
- At least one after image and completion report are required before quality submission.
- Evidence is stored privately and linked to appointment, assignment and cleaner.
- Cleaner payout remains pending/held until quality approval.
- Rework returns the same appointment to an actionable state and preserves earlier evidence/review history.
- Admin decisions record reviewer, timestamp, notes and an audit event.

## Deployment contract

Every feature batch follows this gate:

1. Approve workflow and permissions.
2. Add an idempotent migration.
3. Deploy it to Lovable Cloud.
4. run `get_managed_agency_health()` or an equivalent schema check.
5. Regenerate `src/integrations/supabase/types.ts` from the deployed database.
6. Build frontend against those types.
7. Test customer, cleaner and admin paths on the feature branch.
8. Merge only after the preview points to the tested commit.

Frontend code must degrade safely when an optional capability is unavailable, but a release is blocked unless its required schema health check returns `ready: true`.

## Delivery phases

1. **Stabilisation:** deploy quality/evidence schema, recover the existing test job, align generated types and preview commit.
2. **Operational core:** canonical bookings/appointments, status transition functions, calendar dispatch and availability/conflict checking.
3. **Cleaner field app:** today view, offers, route/job details, clocking, checklist, evidence, completion and earnings.
4. **Admin control centre:** calendar, live dispatch, job timeline, communications, quality queue and payment/payout controls.
5. **Customer account:** confirmed bookings, payments, appointment changes, notifications, history and reviews.
6. **Automation and reporting:** reminders, escalations, scorecards, margin/utilisation and Greater Manchester demand reporting.

## Revisit after Manchester validation

- automated pricing and instant booking;
- multi-cleaner crews and route optimisation;
- native mobile applications and background location;
- automated payouts;
- additional service areas;
- sophisticated cleaner scoring and capacity forecasting.

