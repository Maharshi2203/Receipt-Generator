"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Plus } from "lucide-react"
import { numberToWords } from "@/lib/utils"
import { saveReceipt } from "@/lib/receipt-service"

interface ReceiptFormProps {
  userId: string
  onSuccess: (receipt: any) => void
}

export function ReceiptForm({ userId, onSuccess }: ReceiptFormProps) {
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState("")
  const [amountInWords, setAmountInWords] = useState("")
  const [payerName, setPayerName] = useState("")
  const [village, setVillage] = useState("")
  const [paymentMode, setPaymentMode] = useState("Cash")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])

  useEffect(() => {
    const val = parseFloat(amount)
    if (!isNaN(val)) {
      setAmountInWords(numberToWords(Math.floor(val)))
    } else {
      setAmountInWords("")
    }
  }, [amount])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await saveReceipt({
        user_id: userId,
        payer_name: payerName,
        amount: parseFloat(amount),
        payment_mode: paymentMode,
        description,
        receipt_date: date,
        village: village || "જનકપુરી",
      })

      if (!response.success) throw new Error(response.error)
      
      onSuccess(response.data)

      // Reset form
      setPayerName("")
      setAmount("")
      setVillage("")
      setDescription("")
    } catch (error: any) {
      console.error("Error creating receipt:", error)
      alert("Error creating receipt: " + (error.message || JSON.stringify(error)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white/90 backdrop-blur-md rounded-3xl sm:rounded-[2.5rem] p-4 sm:p-6 shadow-2xl shadow-black/5 border border-white/50">
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="payer" className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400 ml-1">શ્રીમાન (Name)</Label>
              <Input
                id="payer"
                placeholder="Full Name"
                className="h-14 bg-zinc-50 border-none rounded-2xl focus-visible:ring-1 focus-visible:ring-zinc-200 transition-all font-bold text-base text-zinc-900 placeholder:text-zinc-300"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="village" className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400 ml-1">સોસાયટી (Society)</Label>
              <Input
                id="village"
                placeholder="જનકપુરી"
                className="h-14 bg-zinc-50 border-none rounded-2xl focus-visible:ring-1 focus-visible:ring-zinc-200 transition-all font-bold text-base text-zinc-900 placeholder:text-zinc-300"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400 ml-1">Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  className="h-14 bg-zinc-50 border-none rounded-2xl focus-visible:ring-1 focus-visible:ring-zinc-200 transition-all text-base sm:text-lg font-black text-zinc-900 placeholder:text-zinc-300"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date" className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400 ml-1">Date</Label>
                <Input
                  id="date"
                  type="date"
                  className="h-14 bg-zinc-50 border-none rounded-2xl focus-visible:ring-1 focus-visible:ring-zinc-200 transition-all font-bold text-base text-zinc-900"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mode" className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400 ml-1">Payment Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger className="h-14 bg-zinc-50 border-none rounded-2xl focus:ring-1 focus:ring-zinc-200 transition-all font-bold text-base text-zinc-900">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent className="bg-white border-zinc-100 rounded-2xl shadow-2xl">
                  <SelectItem value="Cash" className="font-bold text-base">Cash</SelectItem>
                  <SelectItem value="GPay" className="font-bold text-base">GPay</SelectItem>
                  <SelectItem value="PhonePe" className="font-bold text-base">PhonePe</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400 ml-1">Amount in Words</Label>
              <div className="p-4 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 text-[11px] italic font-bold text-zinc-500 min-h-[50px] flex items-center">
                {amountInWords ? (
                  <span className="animate-in fade-in slide-in-from-left-2 duration-500">
                    {amountInWords} Rupees Only
                  </span>
                ) : (
                  "Enter amount to generate words..."
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400 ml-1">Description</Label>
              <Textarea
                id="description"
                placeholder="Purpose of payment..."
                className="bg-zinc-50 border-none rounded-2xl focus-visible:ring-1 focus-visible:ring-zinc-200 transition-all font-medium min-h-[100px] text-base text-zinc-900 placeholder:text-zinc-300"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-16 rounded-2xl bg-zinc-950 hover:bg-zinc-900 text-[#FBE580] font-black text-lg shadow-xl shadow-zinc-200 mt-4 transition-all active:scale-[0.98]" disabled={loading}>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              "Generate Receipt"
            )}
          </Button>
        </form>
      </div>
    </div>
  )

}
