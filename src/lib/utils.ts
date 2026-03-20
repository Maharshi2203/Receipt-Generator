import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function numberToWords(num: number): string {
  if (num === 0) return "Zero"

  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
  const scales = ["", "Thousand", "Million", "Billion"]

  function convertChunk(chunk: number): string {
    let result = ""
    if (chunk >= 100) {
      result += units[Math.floor(chunk / 100)] + " Hundred "
      chunk %= 100
    }
    if (chunk >= 10 && chunk < 20) {
      result += teens[chunk - 10] + " "
    } else {
      if (chunk >= 20) {
        result += tens[Math.floor(chunk / 10)] + " "
        chunk %= 10
      }
      if (chunk > 0) {
        result += units[chunk] + " "
      }
    }
    return result.trim()
  }

  let words = ""
  let scaleIndex = 0

  while (num > 0) {
    const chunk = num % 1000
    if (chunk > 0) {
      const chunkWords = convertChunk(chunk)
      words = chunkWords + (scales[scaleIndex] ? " " + scales[scaleIndex] : "") + " " + words
    }
    num = Math.floor(num / 1000)
    scaleIndex++
  }

  return words.trim() + " Only"
}

export function numberToGujaratiWords(num: number): string {
  if (num === 0) return "શૂન્ય"

  const units = ["", "એક", "બે", "ત્રણ", "ચાર", "પાંચ", "છ", "સાત", "આઠ", "નવ"]
  const teens = ["દસ", "અગિયાર", "બાર", "તેર", "ચૌદ", "પંદર", "સોળ", "સત્તર", "અઢાર", "ઓગણીસ"]
  const tens = ["", "", "વીસ", "ત્રીસ", "ચાલીસ", "પચાસ", "સાઠ", "સિત્તેર", "એંસી", "નેવું"]
  
  function convertBelow100(n: number): string {
    if (n === 0) return ""
    if (n < 10) return units[n]
    if (n < 20) return teens[n - 10]
    const ten = Math.floor(n / 10)
    const unit = n % 10
    if (unit === 0) return tens[ten]
    return tens[ten] + " " + units[unit]
  }

  let result = ""
  
  if (num >= 10000000) {
    const crore = Math.floor(num / 10000000)
    result += convertBelow100(crore) + " કરોડ "
    num %= 10000000
  }
  
  if (num >= 100000) {
    const lakh = Math.floor(num / 100000)
    result += convertBelow100(lakh) + " લાખ "
    num %= 100000
  }
  
  if (num >= 1000) {
    const thousand = Math.floor(num / 1000)
    result += convertBelow100(thousand) + " હજાર "
    num %= 1000
  }
  
  if (num >= 100) {
    const hundred = Math.floor(num / 100)
    result += units[hundred] + " સો "
    num %= 100
  }
  
  if (num > 0) {
    result += convertBelow100(num)
  }

  return result.trim()
}
