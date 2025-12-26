import AdminLayout from "@/components/admin/AdminLayout";
import { LiveVisitorsCard } from "@/components/admin/LiveVisitorsCard";
import { ConversionNotifications } from "@/components/admin/ConversionNotifications";
import { VisitorAnalyticsCard } from "@/components/admin/VisitorAnalyticsCard";
import { VisitorMapCard } from "@/components/admin/VisitorMapCard";

export default function AdminLiveData() {
  return (
    <AdminLayout title="Live Data">
      {/* Real-time conversion notifications */}
      <ConversionNotifications />

      {/* Live Visitors Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <LiveVisitorsCard />
        <VisitorMapCard />
      </div>

      {/* Analytics Section - Full Width */}
      <div className="grid grid-cols-1 gap-6">
        <VisitorAnalyticsCard />
      </div>
    </AdminLayout>
  );
}
