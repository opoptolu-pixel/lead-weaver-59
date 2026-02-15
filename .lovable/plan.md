

## UTM Lead Source Breakdown on Acquisition Tab

The **Acquisition tab** already has lead source charts (stacked bar, pie chart, source cards). This is the natural place to add a detailed UTM breakdown since it's where all attribution data lives.

### What will be added

**1. UTM Campaign Breakdown Table**
A new card below the existing source charts showing leads grouped by UTM campaign, medium, and source from the `utm_data` JSONB column. This will display:
- Campaign name
- Source / Medium
- Total leads
- Purchased count
- Purchase rate
- Refund count

**2. UTM Source/Medium Summary Chart**
A horizontal bar chart showing lead volume by source/medium combination (e.g., "facebook / cpc", "google / organic"), giving you a more granular view than the current top-level source field.

**3. Referrer Breakdown Table**
A compact table showing the top referrer domains extracted from `utm_data.referrer`, so you can see which websites are driving traffic.

### Data handling
- The query will fetch `utm_data` alongside existing lead fields
- For leads without `utm_data` (older leads), the display will fall back to the existing `source` field
- All charts respect the global admin date filter

### Technical details

**Files to modify:**
- `src/pages/admin/AdminAnalytics.tsx` — Add UTM breakdown section to the Acquisition tab content, extend the lead query to include `utm_data`, and add processing logic to aggregate by campaign/medium/referrer

**No database changes needed** — the `utm_data` JSONB column already exists.

