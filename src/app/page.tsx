"use client"

import { useState, useEffect } from "react"
import { Auth } from "@/components/Auth"
import { ReceiptForm } from "@/components/ReceiptForm"
import { ReceiptList } from "@/components/ReceiptList"
import { ReceiptView } from "@/components/ReceiptView"
import { Button } from "@/components/ui/button"
import { LogOut, Receipt as ReceiptIcon, History, Plus, User, Sparkles, ArrowLeft, LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"

const NIKHIL_DUMMY_ID = "00000000-0000-0000-0000-000000000000"

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [activeReceipt, setActiveReceipt] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showWelcome, setShowWelcome] = useState(false)
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create')

  useEffect(() => {
    const init = async () => {
      const isAuthed = localStorage.getItem("receipt_gen_auth") === "true"
      const phone = localStorage.getItem("receipt_gen_phone")
      
      if (isAuthed && phone) {
        setUser({ id: NIKHIL_DUMMY_ID, phone })
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      setLoading(false)
    }
    
    init()
  }, [])

  const handleLoginSuccess = () => {
    const phone = localStorage.getItem("receipt_gen_phone")
    setUser({ id: NIKHIL_DUMMY_ID, phone })
    setShowWelcome(true)
    setTimeout(() => setShowWelcome(false), 3000)
  }

  const handleLogout = async () => {
    localStorage.removeItem("receipt_gen_auth")
    localStorage.removeItem("receipt_gen_phone")
    setUser(null)
    setActiveReceipt(null)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-6 text-center overflow-hidden" style={{ backgroundColor: '#FBE580' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-primary/5" />
        <div className="relative animate-in zoom-in-50 duration-1000">
          <div className="absolute inset-0 bg-primary/10 blur-[100px] rounded-full scale-150 animate-pulse" />
          <div className="bg-white/90 border border-black/5 p-10 rounded-[3rem] relative shadow-2xl">
            <div className="bg-zinc-950 p-4 rounded-2xl shadow-xl">
              <ReceiptIcon className="h-20 w-20 text-[#FBE580]" />
            </div>
          </div>
        </div>
        <div className="mt-12 space-y-3 relative">
          <h1 className="text-4xl font-black text-foreground tracking-tighter text-gradient animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
            ReceiptGen
          </h1>
          <div className="flex gap-2 justify-center animate-in fade-in duration-1000 delay-500">
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />
  }

  if (showWelcome) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-1000 overflow-hidden" style={{ backgroundColor: '#FBE580' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-primary/10 opacity-50" />
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-zinc-950/10 blur-3xl rounded-full scale-150 animate-pulse" />
          <div className="bg-white/95 border-4 border-zinc-950 p-8 rounded-[2.5rem] relative shadow-2xl transform hover:rotate-3 transition-transform duration-500">
            <div className="bg-zinc-950 p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] ring-4 ring-white/20">
              <ReceiptIcon className="h-20 w-20 text-[#FBE580] animate-bounce" />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-black text-zinc-900 tracking-tighter mb-2 animate-in slide-in-from-bottom-8 duration-1000 delay-200 uppercase">
            Welcome to
          </h1>
          <div className="relative inline-block px-8 py-4 bg-zinc-950 rounded-[2rem] shadow-2xl transform -rotate-2 animate-in slide-in-from-bottom-4 duration-1000 delay-500">
            <p className="text-[#FBE580] text-4xl font-black tracking-tight uppercase italic">
              Janakpuri
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col pb-20 sm:pb-24" style={{ backgroundColor: '#FBE580' }}>
      {/* App Header */}
      <header className="sticky top-0 z-50 bg-white/40 backdrop-blur-xl px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center border-b border-black/5">
        <div className="flex items-center gap-2 sm:gap-3">
          {activeReceipt ? (
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full -ml-1 sm:-ml-2 h-8 w-8 sm:h-10 sm:w-10"
              onClick={() => setActiveReceipt(null)}
            >
              <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          ) : (
            <div className="bg-zinc-950 p-1 sm:p-1.5 rounded-lg">
              <ReceiptIcon className="h-4 w-4 sm:h-5 sm:w-5 text-[#FBE580]" />
            </div>
          )}
          <h1 className="font-black tracking-tight text-lg sm:text-xl text-zinc-900">
            {activeReceipt ? "Receipt Detail" : activeTab === 'create' ? "Generate" : "History"}
          </h1>
        </div>
        {!activeReceipt && (
          <Button variant="ghost" size="icon" className="rounded-full text-zinc-400 hover:text-zinc-900 h-8 w-8 sm:h-10 sm:w-10" onClick={handleLogout}>
            <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        )}
      </header>

      <main className="flex-1 p-3 sm:p-6 max-w-lg mx-auto w-full">
        {activeReceipt ? (
          <div className="animate-in slide-in-from-right-8 duration-500">
            <ReceiptView 
              receipt={activeReceipt} 
              onClose={() => setActiveReceipt(null)} 
            />
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
            {activeTab === 'create' ? (
              <>
                {/* Profile Card */}
                <div className="bg-white/90 backdrop-blur-md rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 shadow-2xl shadow-black/5 border border-white/50 flex items-center justify-between transition-all hover:scale-[1.02]">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-xl sm:rounded-[1.5rem] bg-zinc-950 flex items-center justify-center shadow-lg">
                      <User className="h-6 w-6 sm:h-8 sm:w-8 text-[#FBE580]" />
                    </div>
                    <div>
                      <p className="text-base sm:text-lg font-black text-zinc-900 tracking-tight">Nikhil Mehta</p>
                      <p className="text-[8px] sm:text-[10px] uppercase font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full inline-block mt-1 border border-emerald-100/50">
                        Verified Pro
                      </p>
                    </div>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-black/5 flex items-center justify-center border border-black/5">
                    <LayoutDashboard className="h-5 w-5 sm:h-6 sm:w-6 text-zinc-900" />
                  </div>
                </div>
                
                <div className="space-y-2 sm:space-y-3 pt-2 sm:pt-4">
                  <div className="flex items-center justify-between px-1 sm:px-2">
                    <h2 className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-zinc-600">Merchant Terminal</h2>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <ReceiptForm 
                    userId={user.id} 
                    onSuccess={(receipt) => setActiveReceipt(receipt)} 
                  />
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <ReceiptList 
                  userId={user.id} 
                  onSelect={(receipt) => setActiveReceipt(receipt)} 
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      {!activeReceipt && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 sm:px-6 pb-4 sm:pb-8 pt-3 sm:pt-4 bg-white/40 backdrop-blur-2xl border-t border-black/5">
          <div className="max-w-md mx-auto flex justify-around items-center">
            <button 
              onClick={() => setActiveTab('create')}
              className={cn(
                "flex flex-col items-center gap-1 sm:gap-1.5 transition-all duration-300",
                activeTab === 'create' ? "text-zinc-950 scale-110" : "text-zinc-300"
              )}
            >
              <div className={cn(
                "p-2 sm:p-2.5 rounded-xl sm:rounded-[1.25rem] transition-all",
                activeTab === 'create' ? "bg-zinc-950 text-[#FBE580] shadow-xl shadow-black/10" : "bg-black/5"
              )}>
                <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Create</span>
            </button>

            <button 
              onClick={() => setActiveTab('history')}
              className={cn(
                "flex flex-col items-center gap-1 sm:gap-1.5 transition-all duration-300",
                activeTab === 'history' ? "text-zinc-950 scale-110" : "text-zinc-300"
              )}
            >
              <div className={cn(
                "p-2 sm:p-2.5 rounded-xl sm:rounded-[1.25rem] transition-all",
                activeTab === 'history' ? "bg-zinc-950 text-[#FBE580] shadow-xl shadow-black/10" : "bg-black/5"
              )}>
                <History className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">History</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  )
}
