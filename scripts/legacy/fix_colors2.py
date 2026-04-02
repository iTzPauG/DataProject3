import os
import re

frontend_dir = "main/frontend"

files_to_check = [
    "app/(tabs)/explore.tsx",
    "app/(tabs)/report.tsx",
    "app/(tabs)/profile.tsx",
    "app/(tabs)/index.tsx",
    "app/(modals)/settings.tsx",
    "app/(modals)/saved-items.tsx",
    "app/(modals)/my-reports.tsx",
    "app/(modals)/place-details.tsx",
    "app/(modals)/report-details.tsx",
    "app/(modals)/_layout.tsx",
    "app/(flow)/_layout.tsx",
    "components/UniversalHeader.tsx",
    "components/NearbySheet.tsx",
    "components/EventCard.tsx",
    "components/Atmosphere.tsx",
]

def add_import(content, filepath):
    if "import { colors" in content or "import { colors," in content or "import { radii, colors" in content:
        return content
    # find last import
    imports = list(re.finditer(r"^import .*?;?\n", content, re.MULTILINE))
    if imports:
        last_import = imports[-1]
        
        # calculate relative path to utils/theme
        depth = filepath.count("/") - 1
        rel_path = "../" * depth + "utils/theme"
        if filepath.startswith("app/(flow)") or filepath.startswith("app/(modals)") or filepath.startswith("app/(tabs)"):
            rel_path = "../../utils/theme"
        elif filepath.startswith("app/"):
            rel_path = "../utils/theme"
        elif filepath.startswith("components/map/"):
            rel_path = "../../utils/theme"
        elif filepath.startswith("components/"):
            rel_path = "../utils/theme"

        insert_pos = last_import.end()
        content = content[:insert_pos] + f"import {{ colors }} from '{rel_path}';\n" + content[insert_pos:]
    return content

for file in files_to_check:
    filepath = os.path.join(frontend_dir, file)
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, "r") as f:
        content = f.read()
    
    original_content = content
    content = add_import(content, file)
    
    # Backgrounds
    content = re.sub(r"backgroundColor:\s*['\"]#F7F8FA['\"]", "backgroundColor: colors.bg", content)
    content = re.sub(r"backgroundColor:\s*['\"]#FAFBFC['\"]", "backgroundColor: colors.surface", content)
    content = re.sub(r"backgroundColor:\s*['\"]#F2F2F7['\"]", "backgroundColor: colors.chip", content)
    content = re.sub(r"backgroundColor:\s*['\"]#F2F4F7['\"]", "backgroundColor: colors.chip", content)
    content = re.sub(r"backgroundColor:\s*['\"]#F0F0F0['\"]", "backgroundColor: colors.chip", content)
    content = re.sub(r"backgroundColor:\s*['\"]#F3F4F6['\"]", "backgroundColor: colors.chip", content)
    content = re.sub(r"backgroundColor:\s*['\"]#E5E7EB['\"]", "backgroundColor: colors.stroke", content)
    
    # Text colors
    content = re.sub(r"color:\s*['\"]#6B7280['\"]", "color: colors.inkMuted", content)
    content = re.sub(r"color:\s*['\"]#4B5563['\"]", "color: colors.inkMuted", content)
    content = re.sub(r"color:\s*['\"]#9CA3AF['\"]", "color: colors.inkMuted", content)
    content = re.sub(r"color:\s*['\"]#1F2937['\"]", "color: colors.ink", content)
    content = re.sub(r"color:\s*['\"]#111827['\"]", "color: colors.ink", content)
    content = re.sub(r"color:\s*['\"]#374151['\"]", "color: colors.ink", content)
    content = re.sub(r"color:\s*['\"]#8E8E93['\"]", "color: colors.inkMuted", content)
    
    if content != original_content:
        with open(filepath, "w") as f:
            f.write(content)
        print(f"Updated {file}")
