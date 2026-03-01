import { Sidebar } from "@/components/dashboard/Sidebar"
import GamesPage from "@/app/dashboard/games/page"
import Navbar from "@/components/Navbar"

export default function TestLayout() {
  return (
    <>
      <Navbar />
      <div className="flex min-h-[calc(100vh-64px)] pt-16 bg-[#000000]">
        <Sidebar />
        <main className="flex-1 md:ml-64 p-6">
          <GamesPage />
        </main>
      </div>
    </>
  )
}
