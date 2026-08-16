import { Users } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";

export default function AdminCustomers() {
  return (
    <AdminLayout title="Customers">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">
            Customer profiles, addresses, booking history and service notes.
          </p>
        </div>
        <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
          <Users className="mx-auto h-10 w-10 text-secondary" />
          <h2 className="mt-4 text-lg font-semibold">
            Customer workspace is being prepared
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Existing customer and booking records remain safely stored. They
            will be brought together here without changing or deleting the
            original data.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
