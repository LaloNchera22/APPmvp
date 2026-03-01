import { Sidebar } from "@/components/dashboard/Sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-[#000000]">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-6">
        {children}
      </main>
    </div>
  )
}
