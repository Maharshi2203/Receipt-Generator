/**
 * Receipt Service — Local Storage Mode
 * Works fully offline without any Supabase/database connection.
 * All receipts are stored in browser localStorage.
 */

export interface ReceiptData {
  payer_name: string
  amount: number
  receipt_date: string
  payment_mode?: string
  description?: string
  village?: string
  user_id: string
}

export interface Receipt extends ReceiptData {
  id: string
  receipt_number: number
  created_at: string
}

const STORAGE_KEY = "receipt_gen_receipts"

/** Load all receipts from localStorage */
function loadReceipts(): Receipt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Persist receipts to localStorage */
function saveReceipts(receipts: Receipt[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts))
}

/**
 * Saves a new receipt to localStorage
 */
export async function saveReceipt(data: ReceiptData) {
  try {
    const receipts = loadReceipts()

    // Auto-increment receipt number
    const maxNumber = receipts.reduce((max, r) => Math.max(max, r.receipt_number || 0), 0)

    const newReceipt: Receipt = {
      ...data,
      id: crypto.randomUUID(),
      receipt_number: maxNumber + 1,
      created_at: new Date().toISOString(),
    }

    receipts.unshift(newReceipt) // Newest first
    saveReceipts(receipts)

    console.log("✅ Receipt saved locally:", newReceipt.receipt_number)
    return { success: true, data: newReceipt }
  } catch (error: any) {
    console.error("❌ saveReceipt failed:", error)
    return { success: false, error: error.message || "Failed to save receipt" }
  }
}

/**
 * Fetches the latest receipt for a specific user
 */
export async function getLatestReceipt(userId: string) {
  try {
    const receipts = loadReceipts()
    const userReceipts = receipts.filter((r) => r.user_id === userId)
    const latest = userReceipts[0] ?? null
    return { success: true, data: latest }
  } catch (error: any) {
    console.error("❌ getLatestReceipt failed:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Fetches all receipts for a specific user
 */
export async function getAllReceipts(userId: string) {
  try {
    const receipts = loadReceipts()
    const userReceipts = receipts.filter((r) => r.user_id === userId)
    return { success: true, data: userReceipts }
  } catch (error: any) {
    console.error("❌ getAllReceipts failed:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Stub: PDF upload — returns a fake local URL (Supabase storage not available)
 */
export async function uploadReceiptPDF(blob: Blob, receiptNumber: number) {
  try {
    // Create a local object URL so PDF preview still works
    const url = URL.createObjectURL(blob)
    return { success: true, url }
  } catch (error: any) {
    console.error("❌ uploadReceiptPDF failed:", error)
    return { success: false, error: error.message }
  }
}
