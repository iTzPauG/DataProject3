import os
import re

frontend_dir = "main/frontend"

files_to_check = [
    "app/index.tsx",
    "app/(tabs)/profile.tsx",
    "app/(tabs)/report.tsx",
    "app/(modals)/settings.tsx",
    "app/(modals)/saved-items.tsx",
    "app/(modals)/my-reports.tsx",
    "app/(modals)/place-details.tsx",
    "app/(flow)/explore-list.tsx",
    "components/UniversalHeader.tsx",
    "components/NearbySheet.tsx",
    "components/map/Map.native.tsx",
    "components/EventCard.tsx",
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
    
    # Needs update?
    if not re.search(r"#(FFFFFF|FFF)\b|'white'|\"white\"", content):
        continue
        
    content = add_import(content, file)
    
    # Replace background colors
    content = re.sub(r"backgroundColor:\s*['\"]#(FFFFFF|FFF)['\"]", "backgroundColor: colors.surface", content)
    content = re.sub(r"backgroundColor:\s*['\"]white['\"]", "backgroundColor: colors.surface", content)
    
    # Replace some typical text colors if they are black
    content = re.sub(r"color:\s*['\"]#000000['\"]", "color: colors.ink", content)
    content = re.sub(r"color:\s*['\"]#000['\"]", "color: colors.ink", content)
    content = re.sub(r"color:\s*['\"]#111827['\"]", "color: colors.ink", content)
    content = re.sub(r"color:\s*['\"]#374151['\"]", "color: colors.inkMuted", content)
    content = re.sub(r"color:\s*['\"]#4B5563['\"]", "color: colors.inkMuted", content)
    content = re.sub(r"color:\s*['\"]#6B7280['\"]", "color: colors.inkMuted", content)
    content = re.sub(r"color:\s*['\"]#1C1C1E['\"]", "color: colors.ink", content)
    content = re.sub(r"color:\s*['\"]#3A3A3C['\"]", "color: colors.inkMuted", content)
    content = re.sub(r"color:\s*['\"]#8E8E93['\"]", "color: colors.inkMuted", content)
    content = re.sub(r"color:\s*['\"]#666666['\"]", "color: colors.inkMuted", content)
    content = re.sub(r"color:\s*['\"]#333333['\"]", "color: colors.ink", content)
    content = re.sub(r"color:\s*['\"]#333['\"]", "color: colors.ink", content)
    content = re.sub(r"color:\s*['\"]#666['\"]", "color: colors.inkMuted", content)

    # borders
    content = re.sub(r"borderColor:\s*['\"]#E5E5EA['\"]", "borderColor: colors.stroke", content)
    content = re.sub(r"borderColor:\s*['\"]#E5E7EB['\"]", "borderColor: colors.stroke", content)
    content = re.sub(r"borderColor:\s*['\"]#F3F4F6['\"]", "borderColor: colors.stroke", content)
    content = re.sub(r"borderColor:\s*['\"]#D1D5DB['\"]", "borderColor: colors.stroke", content)

    with open(filepath, "w") as f:
        f.write(content)
    print(f"Updated {file}")
