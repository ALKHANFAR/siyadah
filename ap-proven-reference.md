# سيادة ↔ ActivePieces: المرجع المثبت بالتجربة
> آخر تحديث: 2026-03-03 | AP Version: 0.78.2 | أول تشغيل ناجح: ✅ SUCCEEDED

## الطريقة المثبتة (Proven Pipeline)

```
CREATE → UPDATE_TRIGGER(catch_webhook) → ADD_ACTION(s) → LOCK_AND_PUBLISH → POST /webhooks/{flowId}
```

## 1. إنشاء Flow
```
POST /api/v1/flows
Body: { projectId: "...", displayName: "..." }
→ Returns: { id: "flowId", ... }
```

## 2. إضافة Trigger (Webhook)
```
POST /api/v1/flows/{flowId}
Body: {
  type: "UPDATE_TRIGGER",
  request: {
    name: "trigger",
    valid: true,
    displayName: "Catch Webhook",
    type: "PIECE_TRIGGER",
    settings: {
      pieceName: "@activepieces/piece-webhook",
      pieceVersion: "~0.1.29",
      triggerName: "catch_webhook",          ← مو catch_hook!
      input: { authType: "none" },
      sampleData: { body: { ... } },
      propertySettings: { authType: { type: "MANUAL" } },
      inputUiInfo: { currentSelectedData: "none" }
    }
  }
}
```
**حرج:** triggerName = `catch_webhook` (مو `catch_hook`)
**حرج:** AP يحدد valid بنفسه — catch_webhook = true, catch_hook = false

## 3. إضافة Actions
```
POST /api/v1/flows/{flowId}
Body: {
  type: "ADD_ACTION",
  request: {
    parentStep: "trigger",                    ← أو اسم الخطوة السابقة
    stepLocationRelativeToParent: "AFTER",
    action: {
      name: "step_1",
      skip: false,
      type: "PIECE",
      valid: true,
      displayName: "...",
      settings: {
        pieceName: "...",
        pieceVersion: "~...",
        actionName: "...",
        input: { ... },
        sampleData: {},
        propertySettings: {},
        errorHandlingOptions: {
          retryOnFailure: { value: false },
          continueOnFailure: { value: false }
        }
      }
    }
  }
}
```

## 4. النشر والتفعيل
```
POST /api/v1/flows/{flowId}
Body: { type: "LOCK_AND_PUBLISH", request: {} }
```
**حرج:** LOCK_AND_PUBLISH (مو CHANGE_STATUS!)
**حرج:** Flag ENABLE_FLOW_ON_PUBLISH=true → AP يفعّل تلقائي عند النشر
**بعدها:** انتظر + تحقق GET /api/v1/flows/{flowId} → status: "ENABLED"

## 5. إرسال بيانات (Webhook)
```
POST /api/v1/webhooks/{flowId}               ← flowId مو externalId!
Body: { name: "...", phone: "...", ... }
→ Returns: 200 {}
```
**حرج:** URL يستخدم flowId مو externalId (externalId يرجع 410!)

## 6. التحقق من التشغيل
```
GET /api/v1/flow-runs?flowId={flowId}&projectId={projectId}&limit=10
Authorization: Bearer {token}
```

## 7. الإيقاف
```
POST /api/v1/flows/{flowId}
Body: { type: "CHANGE_STATUS", request: { status: "DISABLED" } }
```
**ملاحظة:** CHANGE_STATUS يشتغل للإيقاف بس، مو للتفعيل

## 8. الحذف
```
DELETE /api/v1/flows/{flowId}
```
**ملاحظة:** لازم يكون DISABLED أول

---

## Piece Versions (من AP Registry الحقيقي)
| Piece | Package Name | Version | 
|-------|-------------|---------|
| Webhook | @activepieces/piece-webhook | 0.1.29 |
| Schedule | @activepieces/piece-schedule | 0.1.17 |
| Google Sheets | @activepieces/piece-google-sheets | 0.14.6 |
| Gmail | @activepieces/piece-gmail | 0.11.4 |
| Google Calendar | @activepieces/piece-google-calendar | 0.8.4 |
| OpenAI | @activepieces/piece-openai | 0.7.5 |
| WhatsApp | @activepieces/piece-whatsapp | 0.2.3 |
| Slack | @activepieces/piece-slack | 0.12.3 |
| Telegram | @activepieces/piece-telegram-bot | 0.5.5 |

## Trigger Names (الصحيحة من AP Metadata)
| Piece | Trigger Name |
|-------|-------------|
| Webhook | catch_webhook |
| Schedule | every_x_minutes, every_hour, every_day, every_week, every_month, cron_expression |
| Gmail | gmail_new_email_received, new_labeled_email, new_attachment, new_label |
| Google Sheets | google-sheets-new-or-updated-row, googlesheets_new_row_added, new-spreadsheet, new-worksheet |

## Action Names (الصحيحة من Source Code)
### Gmail
| Action | Name |
|--------|------|
| Send Email | send_email |
| Reply | reply_to_email |
| Search | gmail_search_mail |
| Get Mail | gmail_get_mail |
| Create Draft Reply | create_draft_reply |

**Gmail send_email Required Props:**
- receiver (Array, required) ← مو "to"!
- subject (required)
- body_type (required, default: "plain_text", options: "plain_text"/"html")
- body (required) ← مو "body_text"!
- draft (required, default: false)

### Google Sheets
| Action | Name |
|--------|------|
| Insert Row | insert_row |
| Update Row | update_row |
| Delete Row | delete_row |
| Find Rows | find_rows |
| Create Spreadsheet | create-spreadsheet |
| Create Worksheet | create-worksheet |

**Sheets insert_row Required Props:**
- includeTeamDrives (optional, default: false)
- spreadsheetId (required, Dropdown)
- sheetId (required, Dropdown)
- first_row_headers (required, default: false)
- values (required, DynamicProperties)

### OpenAI
| Action | Name |
|--------|------|
| Ask ChatGPT | ask_chatgpt |
| Vision | vision_prompt |
| Generate Image | generate_image |
| TTS | text_to_speech |
| Transcribe | transcribe |
| Extract Data | extract-structured-data |

### WhatsApp
| Action | Name |
|--------|------|
| Send Message | sendMessage |
| Send Media | sendMedia |
| Send Template | send-template-message |

**WhatsApp sendMessage Required Props:**
- phone_number_id (required)
- to (required)
- text (required) ← مو "message"!

### Slack
| Action | Name |
|--------|------|
| Send Channel Message | send_channel_message |
| Send Direct Message | send_direct_message |
| Create Channel | slack-create-channel |

---

## Connections الموجودة
| Display Name | Piece | Status | ID |
|-------------|-------|--------|-----|
| Google Sheets | @activepieces/piece-google-sheets | ACTIVE | XIX1yQhvvUwG7Z8jG71Cl |
| Gmail | @activepieces/piece-gmail | ACTIVE | PBUITDjV6euWFjwfvU0Hm |
| Google Sheets1 | @activepieces/piece-google-sheets | ACTIVE | v8OAFR75py99XbEVguTtr |

---

## AP Instance Info
- URL: https://hearty-cat-production.up.railway.app
- Version: 0.78.2
- Edition: CE (Community)
- Project ID: ZOBGWnVgYQI2sQtFYLsrZ
- Platform ID: lUnkfKQPPVkfVNEBtjffQ
- WEBHOOK_URL_PREFIX: https://hearty-cat-production.up.railway.app/api/v1/webhooks
- ENABLE_FLOW_ON_PUBLISH: true
- FLOW_RUN_TIME_SECONDS: 600
- WEBHOOK_TIMEOUT_SECONDS: 30
- Total pieces: 629

---

## الأخطاء اللي اكتشفناها وصححناها
| الخطأ | القيمة الخاطئة | القيمة الصحيحة |
|-------|---------------|---------------|
| Trigger name | catch_hook | catch_webhook |
| تفعيل | CHANGE_STATUS | LOCK_AND_PUBLISH |
| Webhook URL | /webhooks/{externalId} | /webhooks/{flowId} |
| Gmail receiver | to | receiver (Array) |
| Gmail body | body_text | body |
| Gmail missing | — | body_type + draft |
| Sheets missing | — | spreadsheetId + sheetId |
| WhatsApp message | message | text |

---

## إثبات التشغيل
```
Flow: سيادة_410fix_1772535915297
Run ID: TGHamCTbZbECkvkBCrtq3
Status: SUCCEEDED
Start: 2026-03-03T11:05:29.576Z
Finish: 2026-03-03T11:05:29.641Z (65ms)
Environment: PRODUCTION
```
