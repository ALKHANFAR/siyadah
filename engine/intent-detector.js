/**
 * سيادة — محرك فهم النوايا
 * Phase 6: Intent Detection
 * 
 * يحلل طلب المستخدم العربي ويحدد:
 * 1. النية الرئيسية (intent)
 * 2. الكيانات المذكورة (entities)
 * 3. درجة الثقة (confidence)
 */

// ═══════════════════════════════════════════════════════════
// النوايا المدعومة
// ═══════════════════════════════════════════════════════════

const INTENTS = {
  // --- إدارة العملاء ---
  LEAD_CAPTURE: {
    id: "lead_capture",
    name_ar: "التقاط عميل جديد",
    name_en: "Lead Capture",
    category: "crm",
    keywords: [
      "عميل جديد", "لييد", "ليد", "lead", "يتواصل", "يسجل", "تسجيل",
      "استقبال", "فورم", "نموذج", "تعبئة", "يعبي", "طلب جديد",
      "عميل محتمل", "يتسجل", "اشتراك", "يشترك", "حجز مبدئي",
      "جذب", "جذب عملاء", "زباين", "يجون", "عملاء جدد",
      "من الموقع", "يصنفهم", "تصنيف عملاء", "lead capture",
    ],
  },
  LEAD_QUALIFY: {
    id: "lead_qualify",
    name_ar: "تصنيف العميل",
    name_en: "Lead Qualification",
    category: "crm",
    keywords: [
      "تصنيف", "تقييم", "نقاط", "score", "مؤهل", "جاهز",
      "حار", "بارد", "دافي", "أولوية", "ترتيب", "تأهيل",
      "فرز", "تصفية", "فلترة",
    ],
  },
  CONTACT_UPDATE: {
    id: "contact_update",
    name_ar: "تحديث بيانات العميل",
    name_en: "Update Contact",
    category: "crm",
    keywords: [
      "تحديث بيانات", "تعديل", "تغيير", "حدّث", "عدّل",
      "بيانات العميل", "معلومات", "رقم جديد", "إيميل جديد",
    ],
  },
  SALES_FOLLOWUP: {
    id: "sales_followup",
    name_ar: "متابعة المبيعات",
    name_en: "Sales Follow-up",
    category: "crm",
    keywords: [
      "متابعة", "متابعه", "فولو اب", "follow up", "ما ردوا", "ما رد",
      "بدون رد", "مارد", "ماردوا", "تابع", "نتابع", "متابعة عملاء",
      "متابعة مبيعات", "ردوا", "يردون", "العملاء اللي", "فولوب",
      "ما تواصلوا", "ما جاوبوا", "مهملين", "عملاء قدام",
    ],
  },

  // --- المواعيد ---
  APPOINTMENT_BOOK: {
    id: "appointment_book",
    name_ar: "حجز موعد",
    name_en: "Book Appointment",
    category: "scheduling",
    keywords: [
      "موعد", "حجز", "مواعيد", "جدول", "يحجز", "احجز",
      "زيارة", "جلسة", "كشف", "فحص", "استشارة", "ميعاد",
      "بوكينق", "booking", "appointment", "متى فاضي",
      "وقت فاضي", "slot", "حجوزات",
    ],
  },
  APPOINTMENT_REMIND: {
    id: "appointment_remind",
    name_ar: "تذكير بموعد",
    name_en: "Appointment Reminder",
    category: "scheduling",
    keywords: [
      "تذكير", "ذكّر", "فكّر", "reminder", "قبل الموعد",
      "تنبيه", "إشعار موعد", "لا ينسى", "ما ينسى",
      "ذكّر المرضى", "تذكير موعد", "ذكرهم قبل",
    ],
  },
  APPOINTMENT_CANCEL: {
    id: "appointment_cancel",
    name_ar: "إلغاء أو إعادة جدولة",
    name_en: "Cancel/Reschedule",
    category: "scheduling",
    keywords: [
      "إلغاء", "الغي", "ألغي", "يلغي", "إعادة جدولة",
      "تأجيل", "تغيير موعد", "نقل موعد", "ما يقدر يجي",
      "ما قدر", "cancel", "reschedule",
      "يلغي موعده", "يلغي الموعد", "ألغي الموعد",
    ],
  },

  // --- الفواتير والمالية ---
  INVOICE_SEND: {
    id: "invoice_send",
    name_ar: "إرسال فاتورة",
    name_en: "Send Invoice",
    category: "finance",
    keywords: [
      "فاتورة", "فواتير", "invoice", "حساب", "دفع",
      "سداد", "تحصيل", "مبلغ", "مالية", "محاسبة",
      "ارسل فاتورة", "أرسل الحساب",
    ],
  },
  PAYMENT_FOLLOW: {
    id: "payment_follow",
    name_ar: "متابعة الدفع",
    name_en: "Payment Follow-up",
    category: "finance",
    keywords: [
      "متأخر", "ما دفع", "تذكير دفع", "متابعة فاتورة",
      "تحصيل", "مديونية", "رصيد", "مستحق", "overdue",
      "لم يسدد", "ما سدد",
      "فواتير", "فاتورة", "فاتوره", "تذكير فواتير", "تصعيد",
      "دفع", "سداد", "المتأخرة", "غير مدفوعة", "invoice",
    ],
  },

  // --- الإشعارات ---
  NOTIFY_WHATSAPP: {
    id: "notify_whatsapp",
    name_ar: "إرسال واتساب",
    name_en: "Send WhatsApp",
    category: "notification",
    keywords: [
      "واتساب", "واتس", "whatsapp", "رسالة واتس",
      "يرسل واتس", "أرسل واتساب", "واتسب",
    ],
  },
  NOTIFY_EMAIL: {
    id: "notify_email",
    name_ar: "إرسال إيميل",
    name_en: "Send Email",
    category: "notification",
    keywords: [
      "إيميل", "ايميل", "بريد", "email", "رسالة بريدية",
      "يرسل إيميل", "أرسل بريد",
    ],
  },
  NOTIFY_SMS: {
    id: "notify_sms",
    name_ar: "إرسال SMS",
    name_en: "Send SMS",
    category: "notification",
    keywords: [
      "رسالة نصية", "sms", "مسج", "رسالة قصيرة",
    ],
  },
  NOTIFY_MULTI: {
    id: "notify_multi",
    name_ar: "إشعار متعدد القنوات",
    name_en: "Multi-channel Notification",
    category: "notification",
    keywords: [
      "يبلّغ", "يخبر", "يرسل", "إشعار", "تنبيه", "notify",
      "أبلغ", "خبّر", "نبّه", "أعلم",
    ],
  },

  // --- التقارير ---
  REPORT_DAILY: {
    id: "report_daily",
    name_ar: "تقرير يومي",
    name_en: "Daily Report",
    category: "reporting",
    keywords: [
      "تقرير يومي", "ملخص يومي", "daily report",
      "كل يوم", "نهاية اليوم", "بداية اليوم",
      "تقرير يومي بعدد", "عدد المواعيد",
    ],
  },
  REPORT_WEEKLY: {
    id: "report_weekly",
    name_ar: "تقرير أسبوعي",
    name_en: "Weekly Report",
    category: "reporting",
    keywords: [
      "تقرير أسبوعي", "ملخص أسبوعي", "weekly",
      "كل أسبوع", "نهاية الأسبوع",
    ],
  },
  REPORT_CUSTOM: {
    id: "report_custom",
    name_ar: "تقرير مخصص",
    name_en: "Custom Report",
    category: "reporting",
    keywords: [
      "تقرير", "ملخص", "إحصائيات", "أرقام", "report",
      "بيانات", "dashboard", "لوحة", "كم عدد",
    ],
  },

  // --- خدمة العملاء ---
  SUPPORT_TICKET: {
    id: "support_ticket",
    name_ar: "تذكرة دعم",
    name_en: "Support Ticket",
    category: "support",
    keywords: [
      "شكوى", "مشكلة", "تذكرة", "ticket", "دعم",
      "support", "يشتكي", "خلل", "عطل", "ما يشتغل",
      "مو شغال", "خربان",
    ],
  },
  SUPPORT_AUTO_REPLY: {
    id: "support_auto_reply",
    name_ar: "رد تلقائي",
    name_en: "Auto Reply",
    category: "support",
    keywords: [
      "رد تلقائي", "auto reply", "يرد تلقائي",
      "رد آلي", "بوت", "chatbot", "يرد على",
      "رد تلقائي على الرسائل", "رد أوتوماتيك",
    ],
  },

  // --- التجارة الإلكترونية ---
  ORDER_NEW: {
    id: "order_new",
    name_ar: "طلب جديد",
    name_en: "New Order",
    category: "ecommerce",
    keywords: [
      "طلب جديد", "أوردر", "order", "شراء", "يشتري",
      "سلة", "cart", "checkout", "إتمام الطلب",
      "طلب من المتجر", "أوردر جديد",
    ],
  },
  ORDER_STATUS: {
    id: "order_status",
    name_ar: "حالة الطلب",
    name_en: "Order Status",
    category: "ecommerce",
    keywords: [
      "حالة الطلب", "وين طلبي", "تتبع", "tracking",
      "شحن", "توصيل", "وصل", "ما وصل",
    ],
  },
  INVENTORY_ALERT: {
    id: "inventory_alert",
    name_ar: "تنبيه مخزون",
    name_en: "Inventory Alert",
    category: "ecommerce",
    keywords: [
      "مخزون", "كمية", "نفذ", "خلص", "inventory",
      "stock", "كمية قليلة", "إعادة طلب",
    ],
  },

  // --- البيانات ---
  DATA_SYNC: {
    id: "data_sync",
    name_ar: "مزامنة بيانات",
    name_en: "Data Sync",
    category: "data",
    keywords: [
      "مزامنة", "sync", "ربط", "نقل بيانات",
      "تحديث شيت", "من شيت", "إلى شيت",
      "قاعدة بيانات", "database",
    ],
  },
  SHEET_LOG: {
    id: "sheet_log",
    name_ar: "تسجيل في شيت",
    name_en: "Log to Sheet",
    category: "data",
    keywords: [
      "سجّل", "شيت", "sheet", "جدول", "spreadsheet",
      "google sheets", "اكسل", "excel", "يحفظ في",
    ],
  },

  // --- التسويق ---
  CAMPAIGN_EMAIL: {
    id: "campaign_email",
    name_ar: "حملة إيميل",
    name_en: "Email Campaign",
    category: "marketing",
    keywords: [
      "حملة", "campaign", "نشرة", "newsletter",
      "إرسال جماعي", "mass email", "mailchimp",
      "بريدية", "إيميلات", "حملة بريدية", "حملة إيميل",
      "تسويق", "ترحيب عملاء", "ترحيبية", "رسائل تلقائية",
    ],
  },
  SOCIAL_POST: {
    id: "social_post",
    name_ar: "نشر محتوى",
    name_en: "Social Media Post",
    category: "marketing",
    keywords: [
      "نشر", "بوست", "post", "تغريدة", "tweet",
      "لينكدإن", "linkedin", "انستقرام", "فيسبوك",
      "سوشال ميديا", "محتوى",
    ],
  },
};

// ═══════════════════════════════════════════════════════════
// الكيانات المدعومة
// ═══════════════════════════════════════════════════════════

const ENTITY_PATTERNS = {
  phone: {
    patterns: [
      /(?:\+966|00966|0)5\d{8}/g,
      /05\d{8}/g,
    ],
    type: "phone",
  },
  email: {
    patterns: [
      /[\w.+-]+@[\w-]+\.[\w.]+/g,
    ],
    type: "email",
  },
  time: {
    patterns: [
      /الساعة?\s*(\d{1,2}(?::\d{2})?)\s*(صباح|مساء|ص|م)?/g,
      /(\d{1,2}(?::\d{2})?)\s*(AM|PM|am|pm)/g,
    ],
    type: "time",
  },
  date: {
    patterns: [
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g,
      /(اليوم|بكرة|غدا|غداً|بعد بكرة|الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت)/g,
    ],
    type: "date",
  },
  amount: {
    patterns: [
      /(\d[\d,]*\.?\d*)\s*(ريال|SAR|ر\.س|دولار|USD)/g,
      /(ريال|SAR)\s*(\d[\d,]*\.?\d*)/g,
    ],
    type: "amount",
  },
  name: {
    patterns: [
      /(?:اسمه?|العميل|المريض|الزبون)\s+([^\s,،.]+(?:\s+[^\s,،.]+)?)/g,
    ],
    type: "name",
  },
  tool: {
    patterns: [
      /(واتساب|واتس|إيميل|ايميل|سلاك|slack|شيت|sheet|جيميل|gmail|تلغرام|telegram|هبسبوت|hubspot|شوبيفاي|shopify|سترايب|stripe|كالندلي|calendly|جيرا|jira|نوشن|notion)/gi,
    ],
    type: "tool",
  },
  industry: {
    patterns: [
      /(عيادة|مستشفى|طبي|مستوصف|مجمع طبي|clinic)/g,
      /(متجر|محل|دكان|shop|store|ecommerce)/g,
      /(مطعم|كافيه|مقهى|restaurant|cafe)/g,
      /(شركة استشارات|استشاري|consulting)/g,
      /(مقاولات|بناء|construction)/g,
      /(تدريب|دورات|أكاديمية|training)/g,
    ],
    type: "industry",
  },
};

// ═══════════════════════════════════════════════════════════
// نقاط الثقة المعززة
// ═══════════════════════════════════════════════════════════

const CONFIDENCE_BOOSTERS = {
  // أنماط جملة كاملة تعزز الثقة
  patterns: [
    { regex: /أبي|أبغى|أريد|أحتاج|ابي|ابغى/, boost: 0.05, label: "request_verb" },
    { regex: /لما|إذا|متى ما|كل ما/, boost: 0.05, label: "trigger_word" },
    { regex: /تلقائي|أوتوماتيك|بدون تدخل|auto/, boost: 0.1, label: "automation_intent" },
    { regex: /يرسل|يحفظ|يسجل|ينقل|يحدث|يبلغ/, boost: 0.05, label: "action_verb" },
    { regex: /وبعدين|ثم|بعد كذا|و\s*بعدها/, boost: 0.05, label: "sequence" },
  ],
};

// ═══════════════════════════════════════════════════════════
// تطبيع النص العربي
// ═══════════════════════════════════════════════════════════

function normalizeArabic(text) {
  return text
    .replace(/[إأآا]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .replace(/[\u0610-\u061A\u064B-\u065F]/g, "") // تشكيل
    .replace(/ـ/g, "") // تطويل
    .toLowerCase()
    .trim();
}

// ═══════════════════════════════════════════════════════════
// كشف النوايا
// ═══════════════════════════════════════════════════════════

function detectIntents(text) {
  const normalized = normalizeArabic(text);
  const results = [];

  // Negative keyword map — if these words appear, reduce score for specific intents
  const NEGATIVES = {
    appointment_book: ["يلغي", "الغاء", "الغي", "تذكير", "ذكر", "فكر", "cancel", "تقرير", "ملخص", "احصائيات"],
    appointment_remind: ["فواتير", "فاتورة", "فاتوره", "دفع", "سداد", "مديونية", "invoice"],
    lead_capture: ["متجر", "اوردر", "order", "شراء", "سله", "طلب من المتجر"],
    notify_whatsapp: ["رد تلقائي", "auto reply", "بوت", "chatbot", "رد الي"],
    report_daily: [],
    report_weekly: [],
    report_custom: [],
  };

  for (const [key, intent] of Object.entries(INTENTS)) {
    let score = 0;
    let matchedKeywords = [];

    for (const kw of intent.keywords) {
      const nkw = normalizeArabic(kw);
      if (normalized.includes(nkw)) {
        score += nkw.length > 4 ? 0.3 : 0.15; // كلمات أطول = وزن أعلى
        matchedKeywords.push(kw);
      }
    }

    // تعزيز من أنماط الجملة
    for (const booster of CONFIDENCE_BOOSTERS.patterns) {
      if (booster.regex.test(text)) {
        score += booster.boost;
      }
    }

    // تخفيض من الكلمات السلبية
    const negatives = NEGATIVES[intent.id] || [];
    for (const neg of negatives) {
      const nneg = normalizeArabic(neg);
      if (normalized.includes(nneg)) {
        score -= 0.35; // penalize heavily
      }
    }

    // Cap at 1.0, floor at 0
    score = Math.max(0, Math.min(score, 1.0));

    if (score >= 0.15) {
      results.push({
        intent: intent.id,
        name_ar: intent.name_ar,
        category: intent.category,
        confidence: Math.round(score * 100) / 100,
        matched_keywords: matchedKeywords,
      });
    }
  }

  // ترتيب بالثقة
  results.sort((a, b) => b.confidence - a.confidence);

  return results;
}

// ═══════════════════════════════════════════════════════════
// استخراج الكيانات
// ═══════════════════════════════════════════════════════════

function extractEntities(text) {
  const entities = [];

  for (const [name, config] of Object.entries(ENTITY_PATTERNS)) {
    for (const pattern of config.patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        entities.push({
          type: config.type,
          value: match[0].trim(),
          position: match.index,
        });
      }
    }
  }

  // Deduplicate
  const seen = new Set();
  return entities.filter(e => {
    const key = `${e.type}:${e.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ═══════════════════════════════════════════════════════════
// التحليل الكامل
// ═══════════════════════════════════════════════════════════

function analyzeRequest(text) {
  const intents = detectIntents(text);
  const entities = extractEntities(text);

  return {
    input: text,
    primary_intent: intents[0] || null,
    secondary_intents: intents.slice(1, 3),
    all_intents: intents,
    entities,
    has_automation_intent: /تلقائي|أوتوماتيك|auto|بدون تدخل|أبي|ابي|ابغى|أبغى|نظام|سوي لي|سولي|اتمت/.test(text),
    has_sequence: /وبعدين|ثم|بعد كذا|و\s*بعدها/.test(text),
  };
}

module.exports = {
  INTENTS,
  ENTITY_PATTERNS,
  detectIntents,
  extractEntities,
  analyzeRequest,
  normalizeArabic,
};
