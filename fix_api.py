import json

def patch_api_ts():
    path = "main/frontend/services/api.ts"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Fix recommendRestaurantsStream
    old_poll = "const data = await res.json();"
    new_poll = """const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error(`Invalid JSON from poll: ${text.slice(0, 100)}`);
        }"""
    content = content.replace(old_poll, new_poll, 1)

    # Fix recommendRestaurants startRes
    old_start = "const { job_id } = await startRes.json();"
    new_start = """const startText = await startRes.text();
  let job_id;
  try {
    const parsed = JSON.parse(startText);
    job_id = parsed.job_id;
  } catch (e) {
    throw new Error(`Invalid JSON on start: ${startText.slice(0, 100)}`);
  }"""
    content = content.replace(old_start, new_start)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

patch_api_ts()