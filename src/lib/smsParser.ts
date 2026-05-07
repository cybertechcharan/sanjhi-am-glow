/**
 * Robust SMS parser for Indian banking/financial messages.
 * Handles credit, debit, OTP, bank notifications with promo filtering.
 */

// ── Promo / Spam Detection ──────────────────────────────────────────────
const PROMO_PATTERNS = [
  /\b(?:offer|cashback|reward|congrat|win|won|lucky|coupon|discount|deal|sale|shop|buy|order|deliver|install|download|subscribe|click here|visit|app|play store|limited time|hurry|exclusive|free|bonus|earn|refer|invite|claim your|activate now)\b/i,
  /\b(?:ad|promo|marketing|campaign|newsletter|unsubscribe|opt.?out|stop\s+\d|reply\s+stop)\b/i,
  /(?:http[s]?:\/\/(?:bit\.ly|t\.co|goo\.gl|tinyurl|short|link|clk|click))/i,
];

const TRANSACTIONAL_SIGNALS = [
  /\b(?:credited|debited|transferred|withdrawn|deposited|received|sent|paid|deducted|spent)\b/i,
  /\b(?:a\/c|acct?|account)\s*(?:no\.?|number|#|x+|\*+)?\s*\d/i,
  /\b(?:bal(?:ance)?|avl\.?\s*bal|available\s*bal)\b/i,
  /\b(?:upi|neft|rtgs|imps|ifsc)\b/i,
  /\b(?:txn|transaction|ref\s*(?:no|id|#))\b/i,
];

export function isPromoMessage(body: string, sender: string): boolean {
  // If it has strong transactional signals, it's NOT promo
  const hasTransaction = TRANSACTIONAL_SIGNALS.some(p => p.test(body));
  if (hasTransaction) return false;
  
  // Check promo patterns
  const promoScore = PROMO_PATTERNS.filter(p => p.test(body)).length;
  
  // Sender-based promo detection (non-bank senders)
  const senderUpper = sender.toUpperCase();
  const isLikelyPromo = /^(?:AD-|TD-|TA-|BZ-|VM-|HP-|CP-|MK-)/i.test(senderUpper);
  
  // If multiple promo signals and no amount pattern, it's promo
  if (promoScore >= 2) return true;
  if (isLikelyPromo && promoScore >= 1) return true;
  
  return false;
}

// ── Amount Extraction (robust) ──────────────────────────────────────────
const AMOUNT_PATTERN = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi;

function parseAmount(str: string): number {
  return parseFloat(str.replace(/,/g, ""));
}

// ── Credit / Debit Classification ───────────────────────────────────────
const CREDIT_KEYWORDS = /\b(?:credited|credit(?:ed)?|received|deposited|refund(?:ed)?|cashback\s+of|reversed)\b/i;
const DEBIT_KEYWORDS = /\b(?:debited|debit(?:ed)?|spent|paid|withdrawn|deducted|transferred|purchase|payment|charged)\b/i;

// Strict patterns: keyword near amount (within ~40 chars)
function findAmountNearKeyword(body: string, keyword: RegExp): number | null {
  const keyMatch = keyword.exec(body);
  if (!keyMatch) return null;
  
  const keyPos = keyMatch.index;
  // Search for amount within 60 chars of the keyword
  const searchRegion = body.substring(Math.max(0, keyPos - 60), keyPos + keyMatch[0].length + 60);
  const amountMatch = searchRegion.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (amountMatch) {
    const val = parseAmount(amountMatch[1]);
    if (val > 0 && val < 100_000_000) return val; // sanity check < 10 crore
  }
  return null;
}

export interface SmsClassification {
  type: "credit" | "debit" | "otp" | "bank" | "promo" | "other";
  amount?: string;
}

export function classifySMS(body: string, sender: string = ""): SmsClassification {
  // 1. OTP detection (high priority)
  if (/\b(?:otp|verification\s+code|one[\s-]?time\s+(?:password|code|pin))\b/i.test(body)) {
    const m = body.match(/\b(\d{4,8})\b/);
    return { type: "otp", amount: m?.[1] };
  }
  
  // 2. Promo filtering
  if (isPromoMessage(body, sender)) {
    return { type: "promo" };
  }
  
  // 3. Credit detection — must have EXPLICIT credit keyword + amount
  const creditAmt = findAmountNearKeyword(body, CREDIT_KEYWORDS);
  if (creditAmt !== null) {
    return { type: "credit", amount: creditAmt.toLocaleString("en-IN", { maximumFractionDigits: 2 }) };
  }
  
  // 4. Debit detection — must have EXPLICIT debit keyword + amount
  const debitAmt = findAmountNearKeyword(body, DEBIT_KEYWORDS);
  if (debitAmt !== null) {
    return { type: "debit", amount: debitAmt.toLocaleString("en-IN", { maximumFractionDigits: 2 }) };
  }
  
  // 5. Bank notification (no amount but bank-related)
  if (/\b(?:bank|a\/c|acct?|account|ifsc|neft|imps|upi|transaction|rtgs)\b/i.test(body)) {
    return { type: "bank" };
  }
  
  return { type: "other" };
}

// ── Credit Amount Extraction (for Magic Scan) ───────────────────────────
export function extractCreditAmount(body: string, sender: string = ""): number | null {
  if (isPromoMessage(body, sender)) return null;
  if (/\b(?:otp|verification\s+code|one[\s-]?time)\b/i.test(body)) return null;
  
  const amt = findAmountNearKeyword(body, CREDIT_KEYWORDS);
  if (amt !== null && amt > 0 && amt < 100_000_000) return amt;
  return null;
}

// ── Balance Extraction (robust) ──────────────────────────────────────────

function parseLocalizedNumber(value: string): number {
  let str = value.trim().replace(/[₹$\u20AC£¥\s]/g, "");
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  const isCommaDecimal = lastComma > lastDot;
  if (isCommaDecimal) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else {
    str = str.replace(/,/g, "");
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

export function extractBalance(body: string): number | null {
  if (isPromoMessage(body, "")) return null;

  // Pattern 1: keyword then currency then number
  // "Avl Bal Rs.1234.56" / "Available Balance: INR 5,678.00" / "Bal: ₹1234" / "Avl Bal INR 12,345.67"
  const balPatterns = [
    /(?:avl\.?\s*bal(?:ance)?|available\s*(?:bal(?:ance)?)?|a\/c\s*bal(?:ance)?|curr?(?:ent)?\s*bal(?:ance)?|total\s*bal(?:ance)?|closing\s*bal(?:ance)?|net\s*bal(?:ance)?)\s*[:\-.\sis]*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)/i,
    // Pattern 2: currency then number then keyword
    /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)\s*[.\-\s]*(?:avl\.?\s*bal|available|bal(?:ance)?|remaining)/i,
    // Pattern 3: "Bal" at word boundary followed closely by currency+number (common short format)
    /\bbal[:\-.\s]+(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)/i,
    // Pattern 4: "Bal" then just a number (no currency symbol) — common in Indian bank SMS
    /(?:avl\.?\s*bal(?:ance)?|available\s*bal(?:ance)?|a\/c\s*bal(?:ance)?)\s*[:\-.\sis]*([\d,]+\.\d{2})\b/i,
  ];

  for (const pat of balPatterns) {
    const m = body.match(pat);
    if (m) {
      const val = parseLocalizedNumber(m[1]);
      if (val >= 0 && val < 100_000_000) return val;
    }
  }
  return null;
}

// ── Bank / Source Detection (from sender ID + body) ─────────────────────
// Indian SMS sender IDs follow pattern: XX-BANKID (e.g., VM-SBIBNK, TD-HDFCBK)
const SENDER_ID_MAP: Record<string, string> = {
  // SBI
  "SBIBNK": "SBI", "SBIPSG": "SBI", "SBIINB": "SBI", "SBISMS": "SBI", "SBIYNO": "SBI", "SBIUNO": "SBI",
  // HDFC
  "HDFCBK": "HDFC", "HDFCBN": "HDFC", "HDFCSM": "HDFC",
  // ICICI
  "ICICIB": "ICICI", "ICICIS": "ICICI",
  // Axis
  "AXISBK": "Axis", "AXISSM": "Axis",
  // Kotak
  "KOTAKB": "Kotak", "KOTKBK": "Kotak",
  // PNB
  "PNBSMS": "PNB", "PUNJNB": "PNB",
  // BOB
  "BOBALR": "BOB", "BOBSMS": "BOB", "BARODQ": "BOB",
  // BOI
  "BOIIND": "BOI",
  // Canara
  "CANBNK": "Canara", "CANARA": "Canara",
  // Union Bank
  "UBOISB": "Union Bank", "UNIBNK": "Union Bank",
  // IDBI
  "IDBIBK": "IDBI",
  // IndusInd
  "INDBNK": "IndusInd", "INDUSB": "IndusInd",
  // Yes Bank
  "YESBKL": "Yes Bank", "YESBNK": "Yes Bank",
  // Federal
  "FEDBNK": "Federal",
  // IDFC
  "IDFCFB": "IDFC",
  // Bandhan
  "BNDHAN": "Bandhan",
  // Indian Bank
  "INDIANB": "Indian Bank",
  // Paytm
  "PAYTMB": "Paytm", "PYTM": "Paytm",
  // PhonePe
  "PHONPE": "PhonePe",
  // GPay
  "GPPAY": "Google Pay",
  // Amazon Pay
  "AMZNIN": "Amazon Pay",
  // Bajaj
  "BAJFIN": "Bajaj Finance", "BAJAJF": "Bajaj Finance",
  // UCO
  "UCOBKL": "UCO Bank",
  // Central Bank
  "CNTBNK": "Central Bank",
  // Indian Overseas
  "IOBCHN": "Indian Overseas",
  // RBL
  "RBLBNK": "RBL",
  // South Indian
  "SIBSMS": "South Indian Bank",
  // AU Bank
  "AUBANK": "AU Bank",
  // FamPay
  "FAMPAY": "FamPay", "FAMX": "FamPay",
  // Ujjivan
  "UJJIVN": "Ujjivan",
};

const BANK_BODY_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "SBI", pattern: /\bstate\s*bank|sbi\b/i },
  { name: "HDFC", pattern: /\bhdfc\b/i },
  { name: "ICICI", pattern: /\bicici\b/i },
  { name: "Axis", pattern: /\baxis\s*bank\b/i },
  { name: "Kotak", pattern: /\bkotak\b/i },
  { name: "PNB", pattern: /\bpunjab\s*national|pnb\b/i },
  { name: "BOB", pattern: /\bbank\s*of\s*baroda|bob\b/i },
  { name: "BOI", pattern: /\bbank\s*of\s*india\b/i },
  { name: "Canara", pattern: /\bcanara\b/i },
  { name: "Union Bank", pattern: /\bunion\s*bank\b/i },
  { name: "IDBI", pattern: /\bidbi\b/i },
  { name: "IndusInd", pattern: /\bindusind\b/i },
  { name: "Yes Bank", pattern: /\byes\s*bank\b/i },
  { name: "Federal", pattern: /\bfederal\s*bank\b/i },
  { name: "IDFC", pattern: /\bidfc\b/i },
  { name: "Bandhan", pattern: /\bbandhan\b/i },
  { name: "Indian Bank", pattern: /\bindian\s*bank\b/i },
  { name: "RBL", pattern: /\brbl\s*bank\b/i },
  { name: "AU Bank", pattern: /\bau\s*(?:small\s*)?(?:finance\s*)?bank\b/i },
  { name: "Ujjivan", pattern: /\bujjivan\b/i },
  { name: "Equitas", pattern: /\bequitas\b/i },
  { name: "Paytm", pattern: /\bpaytm\b/i },
  { name: "PhonePe", pattern: /\bphonepe\b/i },
  { name: "Google Pay", pattern: /\bgoogle\s*pay|gpay\b/i },
  { name: "Amazon Pay", pattern: /\bamazon\s*pay\b/i },
  { name: "Bajaj Finance", pattern: /\bbajaj\s*fin/i },
  { name: "CRED", pattern: /\bcred\b/i },
  { name: "Slice", pattern: /\bslice\b/i },
  { name: "LazyPay", pattern: /\blazypay\b/i },
  { name: "MobiKwik", pattern: /\bmobikwik\b/i },
  { name: "Freecharge", pattern: /\bfreecharge\b/i },
  { name: "BharatPe", pattern: /\bbharatpe\b/i },
  { name: "Jupiter", pattern: /\bjupiter\b/i },
  { name: "Fi Money", pattern: /\bfi\s*money\b/i },
  { name: "Groww", pattern: /\bgroww\b/i },
  { name: "FamPay", pattern: /\bfampay\b|\bfamx\b/i },
];

export function detectSource(body: string, sender: string): string | null {
  // 1. Try sender ID first (most reliable)
  const senderClean = sender.toUpperCase().replace(/[^A-Z]/g, "");
  // Try matching last 5-7 chars of sender (the bank code part after prefix)
  for (const [code, bank] of Object.entries(SENDER_ID_MAP)) {
    if (senderClean.includes(code)) return `🏦 ${bank}`;
  }
  
  // 2. Try body patterns
  for (const bp of BANK_BODY_PATTERNS) {
    if (bp.pattern.test(body)) {
      const icon = /pay|wallet|kwik|charge|cred|slice|lazy|groww|jupiter|fi\s/i.test(bp.name) ? "💰" : "🏦";
      return `${icon} ${bp.name}`;
    }
  }
  
  return null;
}
