# سيادة Siyadah v3.0

منصة أتمتة عربية SaaS — المدير يكلّم شات عربي → سيادة تبني، تختبر، وتنشر أتمتة كاملة.

## الأرقام

| | القيمة |
|---|---|
| أدوات مسجّلة | **602** |
| نوايا عربية | **24** |
| صناعات | **7** |
| بوابات أمان | **5** |
| خطط اشتراك | **4** (مجاني → 999 ريال) |
| جداول DB | **10** |
| اختبارات | **568/568 ✅** |
| مراحل مكتملة | **14/14** |

## التشغيل

```bash
npm test           # 568 اختبار
npm start          # سيرفر على PORT
```

## Pipeline

```
"أبي أحجز موعد للمريض"
  → Intent Detection (24 نية عربية)
  → Tool Selection (602 أداة)
  → Flow Builder (AP-compatible JSON)
  → Validator (5 بوابات أمان)
  → Deploy (ActivePieces)
  → Monitor
```

## البنية

```
siyadah/
├── data/                        ← المراحل 1-5 (البيانات)
│   ├── registry/tools-full.json ← 602 أداة
│   ├── flows/                   ← 6 قوالب
│   ├── templates/messages/      ← 7 صناعات
│   ├── variables/               ← 4 أنواع متغيرات
│   ├── errors/error-map.json    ← 25 خطأ + auto-fix
│   └── prompts/                 ← مكتبة البرومبتات
├── engine/                      ← المراحل 6-9 (المحرك)
│   ├── intent-detector.js       ← فهم النوايا العربية
│   ├── tool-selector.js         ← اختيار الأدوات
│   ├── flow-builder.js          ← بناء التدفقات
│   ├── validator.js             ← 5 بوابات أمان
│   └── pipeline.js              ← الخط الكامل E2E
├── backend/                     ← المراحل 9.5-11.5 (البنية التحتية)
│   ├── services/activepieces.js ← AP API wrapper
│   ├── services/auth.js         ← تسجيل + دخول + JWT
│   ├── services/billing.js      ← خطط + استخدام + دورة حياة
│   ├── services/webhook.js      ← إدارة webhooks
│   ├── services/monitor.js      ← مراقبة + تنبيهات
│   ├── middleware/security.js   ← OWASP + rate limit
│   ├── db/schema.js             ← 10 جداول
│   └── routes/api.js            ← API كامل
├── tests/                       ← 568 اختبار
└── server.js                    ← سيرفر HTTP
```

## المراحل (14/14) ✅

```
Group 1 — Data:     ✅①Registry ✅②Details ✅③Flows ✅④Templates ✅⑤Errors
Group 2 — Engine:   ✅⑥Intent ✅⑦Builder ✅⑧Validator ✅⑨Pipeline
Bridge:             ✅9.5 AP+Security+Infrastructure
Group 3 — SaaS:    ✅⑩Auth+Tenancy ✅⑪Billing+Usage
Production:         ✅11.5 LoadTest+DevOps
Group 4 — Frontend: ✅⑫Full API+Integration
```

## خطط الاشتراك

| Feature | مجاني (0) | أساسي (199) | متقدم (499) | أعمال (999) |
|---------|-----------|-------------|-------------|-------------|
| أتمتة | 1 | 5 | 15 | ∞ |
| رسائل/شهر | 50 | 500 | 2,000 | 10,000 |
| واتساب | ❌ | ✅ | ✅ | ✅ |
