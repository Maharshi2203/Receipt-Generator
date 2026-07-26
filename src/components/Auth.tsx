"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Phone, ArrowRight, Loader2, AlertCircle, Receipt as ReceiptIcon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function Auth({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone) return
    setLoading(true)
    setError(null)
    
    const formattedPhone = phone.startsWith('+') ? phone : (phone.length === 10 ? `+91${phone}` : `+${phone.replace(/\D/g, '')}`)
    
    // Check if phone matches allowed phone number
    const allowedPhone = process.env.NEXT_PUBLIC_ALLOWED_PHONE
    if (!allowedPhone) {
      setError("System not configured. Please set NEXT_PUBLIC_ALLOWED_PHONE in .env")
      setLoading(false)
      return
    }

    if (formattedPhone !== allowedPhone) {
      setError("Access denied. Unauthorized number.")
      setLoading(false)
      return
    }
    
    // Success - bypassing OTP as requested
    localStorage.setItem("receipt_gen_auth", "true")
    localStorage.setItem("receipt_gen_phone", formattedPhone)
    onLoginSuccess()
  }

      return (
        <div className="flex min-h-[100dvh] items-center justify-center p-6" style={{ backgroundColor: '#FBE580' }}>
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-accent/10 pointer-events-none" />
          <Card className="w-full max-w-md border-black/5 overflow-hidden animate-in fade-in zoom-in-95 duration-1000 shadow-2xl rounded-[2.5rem]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <CardHeader className="space-y-4 pt-8 pb-4 text-center">
              <div className="mx-auto bg-white border border-black/5 p-6 rounded-[2rem] w-fit shadow-xl">
                <div className="bg-zinc-950 p-3 rounded-xl shadow-lg">
                  <ReceiptIcon className="h-10 w-10 text-[#FBE580]" />
                </div>
              </div>
              <div className="space-y-1">
                <CardTitle className="text-3xl font-black tracking-tighter text-gradient">ReceiptGen</CardTitle>
                <CardDescription className="text-zinc-600 font-medium">
                  Merchant Access Portal
                </CardDescription>
              </div>
            </CardHeader>
          <CardContent className="space-y-6 pt-2 pb-8 px-8">
          {error && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive animate-in slide-in-from-top-2 duration-300">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="font-bold text-xs uppercase tracking-wider">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-3">
              <Label htmlFor="phone" className="text-[10px] uppercase font-black tracking-[0.3em] text-zinc-500 ml-1">
                Authorized Mobile
              </Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10 transition-colors group-focus-within:text-primary text-zinc-500">
                  <span className="text-sm font-bold">+91</span>
                </div>
                <Input
                  id="phone"
                  placeholder="9898XXXXXX"
                  type="tel"
                  className="pl-14 h-14 bg-black/5 border-black/10 rounded-2xl focus:ring-primary/20 focus:border-primary/50 transition-all duration-300 text-lg font-bold tracking-widest placeholder:text-zinc-400 placeholder:font-normal"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
                <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
              </div>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest text-center mt-2 opacity-60">
                🔒 Enterprise Grade Encryption
              </p>
            </div>
            <Button type="submit" className="w-full h-14 rounded-2xl btn-3d bg-primary hover:bg-primary/90 text-white font-black text-lg shadow-2xl shadow-primary/30" disabled={loading}>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  Verify Access
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
