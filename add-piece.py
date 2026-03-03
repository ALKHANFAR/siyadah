#!/usr/bin/env python3
"""
➕ add-piece.py — أسهل طريقة لإضافة أداة جديدة

الخطوات:
  1. python3 add-piece.py template notion       ← ينشئ ملف قالب
  2. عبّي البيانات من https://www.activepieces.com/pieces/notion
  3. python3 add-piece.py save notion            ← يتحقق ويحفظ
  4. python3 build-registry.py                   ← يبني السجل الكامل

لإضافة سريعة من السطر:
  python3 add-piece.py quick <id> <display_name> <display_name_ar> <category> <auth_type>
"""

import json, sys, os

PIECES_DIR = "data/registry/pieces"
TEMPLATE_DIR = "data/registry/_drafts"

VALID_CATEGORIES = {
    "A_essential": "أدوات أساسية",
    "B_google": "منتجات جوجل",
    "C_communication": "تواصل",
    "D_ai": "ذكاء اصطناعي",
    "E_crm": "إدارة عملاء",
    "F_ecommerce": "تجارة إلكترونية",
    "G_productivity": "إنتاجية",
    "H_marketing": "تسويق",
    "I_content": "محتوى",
    "J_database": "قواعد بيانات",
    "K_dev": "أدوات مطورين",
    "L_microsoft": "مايكروسوفت",
    "M_finance": "مالية"
}

def cmd_template(piece_id):
    """ينشئ ملف قالب للتعبئة"""
    os.makedirs(TEMPLATE_DIR, exist_ok=True)
    
    template = {
        "_instructions": [
            f"1. روح https://www.activepieces.com/pieces/{piece_id}",
            "2. انسخ كل action name بالحرف (مثل send_email مش sendEmail)",
            "3. انسخ كل trigger name بالحرف",
            "4. trigger type: instant (فوري/webhook) أو scheduled (جدولة/polling)",
            "5. احذف هذا الحقل _instructions قبل الحفظ"
        ],
        "id": piece_id,
        "package": f"@activepieces/piece-{piece_id}",
        "display_name": "TODO",
        "display_name_ar": "TODO",
        "description": "TODO — from official page",
        "logo_url": f"https://cdn.activepieces.com/pieces/{piece_id}.png",
        "category": "G_productivity",
        "auth_type": "oauth2",
        "_source": f"https://www.activepieces.com/pieces/{piece_id}",
        "_verified": False,
        "_verified_date": None,
        "actions": [
            {
                "name": "TODO_action_name",
                "display_name": "TODO Action Name",
                "description": "TODO description"
            }
        ],
        "triggers": [
            {
                "name": "TODO_trigger_name",
                "display_name": "TODO Trigger Name",
                "description": "TODO description",
                "type": "instant"
            }
        ]
    }
    
    filepath = os.path.join(TEMPLATE_DIR, f"{piece_id}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(template, f, ensure_ascii=False, indent=2)
    
    print(f"📝 قالب جاهز: {filepath}")
    print(f"   1. عبّي البيانات من: https://www.activepieces.com/pieces/{piece_id}")
    print(f"   2. بعدين: python3 add-piece.py save {piece_id}")

def cmd_save(piece_id):
    """يتحقق من المسودة وينقلها للسجل"""
    draft_path = os.path.join(TEMPLATE_DIR, f"{piece_id}.json")
    final_path = os.path.join(PIECES_DIR, f"{piece_id}.json")
    
    if not os.path.exists(draft_path):
        print(f"❌ مسودة '{piece_id}' غير موجودة في {TEMPLATE_DIR}/")
        print(f"   شغّل أولاً: python3 add-piece.py template {piece_id}")
        return False
    
    with open(draft_path, "r", encoding="utf-8") as f:
        piece = json.load(f)
    
    # احذف التعليمات
    piece.pop("_instructions", None)
    
    # تحقق سريع
    errors = []
    if piece.get("display_name", "").startswith("TODO"):
        errors.append("display_name لسّا TODO")
    if piece.get("display_name_ar", "").startswith("TODO"):
        errors.append("display_name_ar لسّا TODO")
    
    for a in piece.get("actions", []):
        if "TODO" in a.get("name", ""):
            errors.append(f"action name لسّا TODO: {a['name']}")
    for t in piece.get("triggers", []):
        if "TODO" in t.get("name", ""):
            errors.append(f"trigger name لسّا TODO: {t['name']}")
    
    if piece["id"] != piece_id:
        errors.append(f"ID في الملف '{piece['id']}' لا يطابق '{piece_id}'")
    
    # تحقق ما تكون موجودة
    if os.path.exists(final_path):
        errors.append(f"أداة '{piece_id}' موجودة مسبقاً! استخدم update بدل add")
    
    if errors:
        print(f"❌ مشاكل:")
        for e in errors:
            print(f"   ❌ {e}")
        return False
    
    # حفظ
    with open(final_path, "w", encoding="utf-8") as f:
        json.dump(piece, f, ensure_ascii=False, indent=2)
    
    # احذف المسودة
    os.remove(draft_path)
    
    a_count = len(piece.get("actions", []))
    t_count = len(piece.get("triggers", []))
    print(f"✅ تم حفظ '{piece_id}' ({a_count}A, {t_count}T)")
    print(f"   📁 {final_path}")
    print(f"   🏗️  شغّل: python3 build-registry.py")
    return True

def cmd_quick(piece_id, display_name, display_name_ar, category, auth_type):
    """إضافة سريعة لأداة فارغة (بدون actions/triggers)"""
    final_path = os.path.join(PIECES_DIR, f"{piece_id}.json")
    
    if os.path.exists(final_path):
        print(f"❌ أداة '{piece_id}' موجودة مسبقاً!")
        return False
    
    piece = {
        "id": piece_id,
        "package": f"@activepieces/piece-{piece_id}",
        "display_name": display_name,
        "display_name_ar": display_name_ar,
        "description": display_name,
        "logo_url": f"https://cdn.activepieces.com/pieces/{piece_id}.png",
        "category": category,
        "auth_type": auth_type,
        "_source": f"https://www.activepieces.com/pieces/{piece_id}",
        "_verified": False,
        "_verified_date": None,
        "actions": [],
        "triggers": []
    }
    
    with open(final_path, "w", encoding="utf-8") as f:
        json.dump(piece, f, ensure_ascii=False, indent=2)
    
    print(f"✅ تم إنشاء '{piece_id}' (فارغ — أضف actions/triggers لاحقاً)")
    print(f"   📁 {final_path}")
    return True

def cmd_list():
    """عرض كل الأدوات"""
    files = sorted(os.listdir(PIECES_DIR))
    print(f"\n📦 {len(files)} أداة في السجل:\n")
    for f in files:
        if f.endswith(".json"):
            path = os.path.join(PIECES_DIR, f)
            try:
                p = json.load(open(path, encoding="utf-8"))
                v = "✅" if p.get("_verified") else "⚠️ "
                a = len(p.get("actions", []))
                t = len(p.get("triggers", []))
                print(f"  {v} {p['id']:30s} {a:2d}A {t:2d}T  {p.get('category','?'):15s}")
            except:
                print(f"  ❌ {f} — JSON error")
    
    # Show drafts
    if os.path.isdir(TEMPLATE_DIR):
        drafts = [f for f in os.listdir(TEMPLATE_DIR) if f.endswith(".json")]
        if drafts:
            print(f"\n📝 مسودات ({len(drafts)}):")
            for d in drafts:
                print(f"  📝 {d}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        print("\nالفئات المتاحة:")
        for k, v in VALID_CATEGORIES.items():
            print(f"  {k:15s} — {v}")
        sys.exit(0)
    
    cmd = sys.argv[1]
    
    if cmd == "template" and len(sys.argv) > 2:
        cmd_template(sys.argv[2])
    elif cmd == "save" and len(sys.argv) > 2:
        cmd_save(sys.argv[2])
    elif cmd == "quick" and len(sys.argv) > 6:
        cmd_quick(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6])
    elif cmd == "list":
        cmd_list()
    else:
        print(__doc__)
