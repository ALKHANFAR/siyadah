#!/usr/bin/env python3
"""
🏗️ build-registry.py — نظام بناء سجل الأدوات

المبدأ: كل أداة ملف مستقل → البناء يجمعهم ويتحقق

الاستخدام:
  python3 build-registry.py              # بناء + تحقق
  python3 build-registry.py --check-only # تحقق بدون كتابة
  python3 build-registry.py --stats      # إحصائيات فقط

الهيكل:
  data/registry/pieces/{id}.json   ← ملف لكل أداة (المصدر)
  data/registry/tools.json         ← السجل المُجمّع (المُخرج)
"""

import json
import sys
import os
import glob
from datetime import datetime

# ============================================================
# الثوابت
# ============================================================

PIECES_DIR = "data/registry/pieces"
OUTPUT_FILE = "data/registry/tools.json"
FLOWS_DIR = "data/flows"

VALID_AUTH_TYPES = ["none", "oauth2", "secret_text", "basic_auth", "custom"]
VALID_CATEGORIES = [
    "A_essential", "B_google", "C_communication", "D_ai",
    "E_crm", "F_ecommerce", "G_productivity", "H_marketing",
    "I_content", "J_database", "K_dev", "L_microsoft", "M_finance"
]
VALID_TRIGGER_TYPES = ["instant", "scheduled"]

# ============================================================
# 1. تحقق من صحة أداة واحدة
# ============================================================

def validate_piece(piece, filename):
    """يرجع (errors[], warnings[])"""
    errors = []
    warnings = []
    pid = piece.get("id", "?")

    # الحقول المطلوبة
    required = ["id", "package", "display_name", "display_name_ar",
                 "description", "category", "auth_type", "actions", "triggers"]
    for f in required:
        if f not in piece:
            errors.append(f"[{pid}] حقل مطلوب مفقود: {f}")

    if errors:
        return errors, warnings

    # اسم الملف = ID
    expected_filename = f"{pid}.json"
    if os.path.basename(filename) != expected_filename:
        errors.append(f"[{pid}] اسم الملف '{os.path.basename(filename)}' لا يطابق ID '{pid}' — يجب أن يكون '{expected_filename}'")

    # ID format
    if " " in pid or pid != pid.lower():
        errors.append(f"[{pid}] ID يجب أن يكون lowercase بدون مسافات")

    # Package format
    pkg = piece.get("package", "")
    if not pkg.startswith("@activepieces/piece-"):
        errors.append(f"[{pid}] package يجب أن يبدأ بـ @activepieces/piece-")

    # Auth type
    if piece["auth_type"] not in VALID_AUTH_TYPES:
        errors.append(f"[{pid}] auth_type غير صالح: '{piece['auth_type']}'")

    # Category
    if piece["category"] not in VALID_CATEGORIES:
        errors.append(f"[{pid}] category غير صالحة: '{piece['category']}'")

    # Actions validation
    action_names = set()
    for i, a in enumerate(piece.get("actions", [])):
        if not isinstance(a, dict):
            errors.append(f"[{pid}] action[{i}] يجب أن يكون object")
            continue
        name = a.get("name", "")
        if not name:
            errors.append(f"[{pid}] action[{i}] بدون name")
        elif name in action_names:
            errors.append(f"[{pid}] action مكرر: '{name}'")
        else:
            action_names.add(name)
        if not a.get("display_name"):
            warnings.append(f"[{pid}] action '{name}' بدون display_name")
        if not a.get("description"):
            warnings.append(f"[{pid}] action '{name}' بدون description")

    # Triggers validation
    trigger_names = set()
    for i, t in enumerate(piece.get("triggers", [])):
        if not isinstance(t, dict):
            errors.append(f"[{pid}] trigger[{i}] يجب أن يكون object")
            continue
        name = t.get("name", "")
        if not name:
            errors.append(f"[{pid}] trigger[{i}] بدون name")
        elif name in trigger_names:
            errors.append(f"[{pid}] trigger مكرر: '{name}'")
        else:
            trigger_names.add(name)
        ttype = t.get("type", "")
        if ttype and ttype not in VALID_TRIGGER_TYPES:
            errors.append(f"[{pid}] trigger '{name}' نوع غير صالح: '{ttype}'")

    # Warnings
    if not piece.get("_source"):
        warnings.append(f"[{pid}] بدون _source — من أين جات البيانات؟")
    if len(piece.get("actions", [])) == 0 and len(piece.get("triggers", [])) == 0:
        warnings.append(f"[{pid}] بدون أي actions أو triggers!")

    return errors, warnings

# ============================================================
# 2. تحميل كل ملفات الأدوات
# ============================================================

def load_all_pieces():
    """يحمّل كل ملفات الأدوات من PIECES_DIR"""
    files = sorted(glob.glob(os.path.join(PIECES_DIR, "*.json")))
    pieces = []
    all_errors = []
    all_warnings = []

    if not files:
        all_errors.append(f"لا توجد ملفات في {PIECES_DIR}/")
        return pieces, all_errors, all_warnings

    # تحقق من عدم وجود IDs مكررة
    seen_ids = {}
    
    for filepath in files:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                piece = json.load(f)
        except json.JSONDecodeError as e:
            all_errors.append(f"[{os.path.basename(filepath)}] JSON غير صالح: {e}")
            continue

        errors, warnings = validate_piece(piece, filepath)
        
        # تحقق التكرار
        pid = piece.get("id", "?")
        if pid in seen_ids:
            errors.append(f"[{pid}] ID مكرر! موجود أيضاً في: {seen_ids[pid]}")
        seen_ids[pid] = os.path.basename(filepath)

        all_errors.extend(errors)
        all_warnings.extend(warnings)

        if not errors:
            pieces.append(piece)

    return pieces, all_errors, all_warnings

# ============================================================
# 3. تحقق من التوافق مع الـ Flows
# ============================================================

def check_flow_compatibility(piece_ids):
    """يتحقق أن كل tool_id في الـ flows موجود في السجل"""
    errors = []
    warnings = []

    if not os.path.isdir(FLOWS_DIR):
        return errors, warnings

    flow_files = glob.glob(os.path.join(FLOWS_DIR, "*.json"))
    all_referenced_ids = set()

    for filepath in flow_files:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                flow = json.load(f)
        except:
            continue

        flow_id = flow.get("_meta", {}).get("id", os.path.basename(filepath))
        referenced = set()

        # Trigger
        if flow.get("trigger", {}).get("tool_id"):
            referenced.add(flow["trigger"]["tool_id"])

        # Steps
        for s in flow.get("steps", []):
            if s.get("tool_id"):
                referenced.add(s["tool_id"])

        # Branches
        for b in flow.get("branches", []):
            for route in b.get("routes", {}).values():
                for a in route.get("additional_steps", []):
                    if a.get("tool_id"):
                        referenced.add(a["tool_id"])

        # Connections
        for field in ["required_connections", "recommended_connections", "minimum_connections"]:
            for c in flow.get(field, []):
                referenced.add(c)

        # Check
        for ref_id in referenced:
            if ref_id not in piece_ids:
                errors.append(f"[flow:{flow_id}] يستخدم '{ref_id}' — غير موجود في السجل!")
            all_referenced_ids.add(ref_id)

    # أدوات في السجل لكن ما يستخدمها أي flow
    unused = piece_ids - all_referenced_ids
    if unused and len(flow_files) > 0:
        warnings.append(f"أدوات غير مستخدمة في أي flow: {', '.join(sorted(unused))}")

    return errors, warnings

# ============================================================
# 4. بناء السجل المُجمّع
# ============================================================

def build_registry(pieces):
    """يبني ملف tools.json النهائي"""
    # رتّب حسب الفئة ثم الاسم
    pieces.sort(key=lambda p: (p.get("category", "Z"), p.get("id", "")))

    total_a = sum(len(p.get("actions", [])) for p in pieces)
    total_t = sum(len(p.get("triggers", [])) for p in pieces)
    verified = sum(1 for p in pieces if p.get("_verified"))

    registry = {
        "_metadata": {
            "version": "2.0.0",
            "built_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "source_dir": PIECES_DIR,
            "activepieces_docs": "https://www.activepieces.com/pieces",
            "activepieces_github": "https://github.com/activepieces/activepieces",
            "total_pieces": len(pieces),
            "total_actions": total_a,
            "total_triggers": total_t,
            "verified_count": verified,
            "unverified_count": len(pieces) - verified
        },
        "pieces": pieces
    }

    return registry

# ============================================================
# 5. Main
# ============================================================

def main():
    check_only = "--check-only" in sys.argv
    stats_only = "--stats" in sys.argv

    print("=" * 60)
    print("🏗️  بناء سجل الأدوات")
    print("=" * 60)

    # 1. تحميل وتحقق
    pieces, errors, warnings = load_all_pieces()
    piece_ids = {p["id"] for p in pieces}

    # 2. تحقق التوافق مع Flows
    flow_errors, flow_warnings = check_flow_compatibility(piece_ids)
    errors.extend(flow_errors)
    warnings.extend(flow_warnings)

    # 3. طباعة النتائج
    if warnings:
        print(f"\n⚠️  تحذيرات ({len(warnings)}):")
        for w in warnings:
            print(f"   ⚠️  {w}")

    if errors:
        print(f"\n❌ أخطاء ({len(errors)}):")
        for e in errors:
            print(f"   ❌ {e}")
        print(f"\n❌ البناء فشل — {len(errors)} خطأ!")
        sys.exit(1)

    # 4. إحصائيات
    total_a = sum(len(p.get("actions", [])) for p in pieces)
    total_t = sum(len(p.get("triggers", [])) for p in pieces)
    verified = sum(1 for p in pieces if p.get("_verified"))

    print(f"\n✅ التحقق نجح!")
    print(f"   📦 أدوات: {len(pieces)}")
    print(f"   ⚡ Actions: {total_a}")
    print(f"   🔔 Triggers: {total_t}")
    print(f"   ✅ متحقق: {verified} | ⚠️ غير متحقق: {len(pieces) - verified}")

    # حسب الفئة
    cats = {}
    for p in pieces:
        c = p.get("category", "?")
        cats[c] = cats.get(c, 0) + 1
    print(f"\n   📂 الفئات:")
    for c in sorted(cats):
        print(f"      {c}: {cats[c]}")

    if stats_only or check_only:
        return

    # 5. بناء وكتابة
    registry = build_registry(pieces)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)

    size_kb = os.path.getsize(OUTPUT_FILE) / 1024
    print(f"\n📁 تم الكتابة: {OUTPUT_FILE} ({size_kb:.1f} KB)")

if __name__ == "__main__":
    main()
