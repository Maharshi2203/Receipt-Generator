"use client"

import { useEffect, useState } from "react"
import { getAllReceipts } from "@/lib/receipt-service"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, History, ArrowRight } from "lucide-react"

interface ReceiptListProps {
  userId: string
  onSelect: (receipt: any) => void
}

export function ReceiptList({ userId, onSelect }: ReceiptListProps) {
  const [receipts, setReceipts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchReceipts() {
      const result = await getAllReceipts(userId)
      if (result.success && result.data) {
        setReceipts(result.data)
      }
      setLoading(false)
    }

    fetchReceipts()
  }, [userId])

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (receipts.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed rounded-lg border-zinc-200 dark:border-zinc-800">
        <History className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
        <p className="text-sm text-zinc-500">No receipts found yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Transaction History</h3>
        <span className="bg-white/60 text-zinc-500 text-[9px] font-bold px-2 py-0.5 rounded-full border border-black/5">
          {receipts.length} Entries
        </span>
      </div>
      <div className="space-y-4">
          {receipts.map((r) => (
            <Card 
              key={r.id} 
              className="cursor-pointer card-3d border-white/50 bg-white/90 backdrop-blur-md hover:border-zinc-950/20 group transition-all duration-500 animate-in fade-in slide-in-from-right-4 shadow-xl shadow-black/5 rounded-[2rem]" 
              onClick={() => onSelect(r)}
            >
            <CardContent className="p-5 flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-primary/10 transition-colors" />
                <div className="space-y-1.5 relative flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-black text-primary text-xs flex-shrink-0">#{r.receipt_number.toString().padStart(3, "0")}</span>
                    <p className="font-black text-base tracking-tight text-foreground group-hover:text-primary transition-colors truncate">{r.payer_name}</p>
                  </div>
                <div className="flex items-center gap-3">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{r.receipt_date}</p>
                  <span className="h-1 w-1 rounded-full bg-zinc-200" />
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{r.payment_mode}</p>
                </div>
              </div>
              <div className="text-right flex items-center gap-3 sm:gap-5 relative flex-shrink-0">
                <div className="space-y-0.5">
                  <p className="text-[8px] font-black text-zinc-500 uppercase tracking-tighter">Amount</p>
                  <p className="font-black text-xl text-foreground tracking-tighter">₹{r.amount.toLocaleString()}</p>
                </div>
                <div className="bg-black/5 p-2 rounded-xl group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
