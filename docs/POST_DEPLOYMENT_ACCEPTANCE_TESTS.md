# Post-deployment acceptance tests

Run these tests on the deployed managed-agency site with fresh accounts and a controlled customer booking before launch.

## Fresh cleaner account: end-to-end test

- Create a brand-new cleaner account (do not reuse a legacy marketplace account).
- Complete the individual cleaner application, including identity, proof of address and the appropriate right-to-work route; DBS remains optional.
- Upload the required verification documents and confirm they appear once, correctly labelled, in the cleaner profile and Admin **Onboarding & Checks**.
- Confirm an admin can review the documents, record right-to-work expiry where applicable, approve checks and activate the cleaner.
- Confirm the cleaner can edit their address and service preferences, submit payment details, set availability, and send a support message.

## Managed booking: end-to-end test

- Submit a new customer cleaning request for a Greater Manchester address.
- Qualify the request, add paid add-ons, enter booking date/time and total duration, and send a quote/payment link.
- Make one controlled Stripe payment and verify the payment webhook creates the job exactly once, marks the payment as paid, shows the correct base service and add-ons, and sends the booking-confirmation email without a 404 redirect.
- Assign the fresh approved cleaner from Jobs & Schedule; confirm availability/conflict checks, assignment email and reminder queue entries.
- Have the cleaner accept, view the full address and instructions, complete the standard and add-on checklist items, upload before/after evidence, check in/out and mark the job complete.
- Approve quality, confirm the job reaches weekly cleaner pay, record a manual bank-payment reference, and confirm the payout cannot be duplicated.

## Controlled exception checks

- On a separate paid test booking only, record a cleaner no-show and verify reassignment, reschedule and cancellation/refund paths.
- Confirm a manual refund creates only a refund task; it must not call Stripe.
- Confirm a Stripe refund can only be processed once and appears in the Refund audit view.

