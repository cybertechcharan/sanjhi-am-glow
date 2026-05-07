import json
import os
import re
import subprocess
import zipfile
import requests
import uuid
import shutil
import time
from datetime import datetime

from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, filters, ContextTypes, CommandHandler

BOT_TOKEN = "8623020486:AAFMm4mpfWy4UAZeWSjTesthdME78xVl1tQ"
LICENSE_KEY = "TVnZDAh4DhK8Ap5J"
NETLIFY_TOKEN = "nfp_wSgc6jS5MS4Qozmw4NgcC2gkHD17ERFpa128"

user_state = {}
verified_users = set() 

# ---------------- PARSER ---------------- #

def parse_config(text):
    match = re.search(r'firebaseConfig\s*=\s*({[\s\S]*?})\s*;', text)
    if not match:
        raise Exception("firebaseConfig not found in the provided text.")

    raw = match.group(1)
    # Convert JS object-like string to valid JSON
    fixed = re.sub(r'^(\s*)(\w+)\s*:', r'\1"\2":', raw, flags=re.MULTILINE)
    fixed = re.sub(r',\s*}', '}', fixed)
    return json.loads(fixed)

# ---------------- FILE UTILS ---------------- #

def find_file(name):
    for root, _, files in os.walk("."):
        if name in files:
            return os.path.join(root, name)
    return None

def update_files(config, service):
    firebase_path = find_file("firebase.ts")
    fcm_path = find_file("fcm.ts")

    if not firebase_path or not fcm_path:
        raise Exception("Source files (firebase.ts or fcm.ts) not found in directory.")

    # Update firebase.ts
    content = open(firebase_path, "r", encoding="utf-8").read()
    new_config_str = "export const firebaseConfig = " + json.dumps(config, indent=2)
    content = re.sub(r'(?:export\s+)?const firebaseConfig = \{[\s\S]*?\}', new_config_str, content)
    open(firebase_path, "w", encoding="utf-8").write(content)

    # Update fcm.ts
    service["private_key"] = service["private_key"].replace("\n", "\\n")
    content = open(fcm_path, "r", encoding="utf-8").read()
    content = re.sub(r'const SERVICE_ACCOUNT = \{[\s\S]*?\};', 
                     f'const SERVICE_ACCOUNT = {json.dumps(service, indent=2)};', content)
    open(fcm_path, "w", encoding="utf-8").write(content)

def build():
    # Attempt to install dependencies if node_modules is missing
    if not os.path.exists("node_modules"):
        subprocess.run("npm install", shell=True, check=True)
        
    result = subprocess.run("npm run build", shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"Build failed: {result.stderr}")

def fix_html():
    index_path = find_file("index.html")
    if not index_path: return

    html = open(index_path, "r", encoding="utf-8").read()
    script_match = re.search(r'<script.*?src="(.*?)".*?></script>', html)
    css_match = re.search(r'<link.*?href="(.*?)".*?>', html)

    script_tag = f'<script type="module" crossorigin src="{script_match.group(1)}"></script>' if script_match else ""
    css_tag = f'<link rel="stylesheet" crossorigin href="{css_match.group(1)}">' if css_match else ""

    clean_html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Dark X Panel 3.0</title>
  {css_tag}
  {script_tag}
</head>
<body><div id="root"></div></body>
</html>"""
    open(index_path, "w", encoding="utf-8").write(clean_html)

# ---------------- NEW DEPLOYMENT LOGIC ---------------- #

def zip_dist():
    """Zips the contents of the dist folder for root-level deployment."""
    zip_name = f"deploy_{int(time.time())}.zip"
    if not os.path.exists("dist"):
        raise Exception("The 'dist' folder was not generated. Build likely failed.")

    with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk("dist"):
            for file in files:
                full_path = os.path.join(root, file)
                # relpath ensures index.html is at the zip root
                arcname = os.path.relpath(full_path, "dist")
                z.write(full_path, arcname)
    return zip_name

def deploy_to_netlify(zip_path):
    """Creates a site and uploads the ZIP file directly."""
    headers = {"Authorization": f"Bearer {NETLIFY_TOKEN}"}
    
    # 1. Create a unique site
    site_name = f"darkx-{uuid.uuid4().hex[:8]}"
    create_res = requests.post(
        "https://api.netlify.com/api/v1/sites",
        headers=headers,
        json={"name": site_name}
    )
    
    if create_res.status_code not in [200, 201]:
        raise Exception(f"Site creation failed: {create_res.text}")
    
    site_data = create_res.json()
    site_id = site_data["id"]
    site_url = site_data["ssl_url"] or site_data["url"]

    # 2. Upload the ZIP
    with open(zip_path, 'rb') as f:
        upload_headers = {
            "Authorization": f"Bearer {NETLIFY_TOKEN}",
            "Content-Type": "application/zip"
        }
        deploy_res = requests.post(
            f"https://api.netlify.com/api/v1/sites/{site_id}/deploys",
            headers=upload_headers,
            data=f,
            timeout=120
        )

    if deploy_res.status_code not in [200, 201]:
        raise Exception(f"Deployment failed: {deploy_res.text}")
        
    return site_url

# ---------------- BOT HANDLERS ---------------- #

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    if uid in verified_users:
        user_state[uid] = {"step": "config"}
        await update.message.reply_text("✅ Verified. Send Firebase config (text or file).")
    else:
        user_state[uid] = {"step": "license"}
        await update.message.reply_text("🔐 Enter license key to proceed:")

async def handle(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    if uid not in user_state: return

    state = user_state[uid]
    text = update.message.text

    try:
        # Step 1: License
        if state["step"] == "license":
            if text and text.strip() == LICENSE_KEY:
                verified_users.add(uid)
                state["step"] = "config"
                await update.message.reply_text("✅ License verified! Now send Firebase config.")
            else:
                await update.message.reply_text("❌ Invalid license.")
            return

        # Step 2: Firebase Config
        if state["step"] == "config":
            if update.message.document:
                file = await update.message.document.get_file()
                text = (await file.download_as_bytearray()).decode('utf-8')
            
            state["config"] = parse_config(text)
            state["step"] = "service"
            await update.message.reply_text("📂 Config saved. Send serviceAccountKey.json (text or file).")
            return

        # Step 3: Service Account & Execution
        if state["step"] == "service":
            if update.message.document:
                file = await update.message.document.get_file()
                text = (await file.download_as_bytearray()).decode('utf-8')
            
            state["service"] = json.loads(text)

            await update.message.reply_text("⚙️ Updating files...")
            update_files(state["config"], state["service"])

            await update.message.reply_text("🏗️ Building project...")
            build()

            await update.message.reply_text("🎨 Finalizing HTML...")
            fix_html()

            await update.message.reply_text("🚀 Deploying to Netlify...")
            zip_file = zip_dist()
            live_url = deploy_to_netlify(zip_file)

            # Cleanup
            if os.path.exists(zip_file): os.remove(zip_file)

            await update.message.reply_text(f"🎉 Deployment Successful!\n\n🔗 Link: {live_url}\n\nNote: Give it 60 seconds to fully propagate.")
            user_state.pop(uid)

    except Exception as e:
        await update.message.reply_text(f"❌ Error: {str(e)}")

# ---------------- RUN ---------------- #

if __name__ == "__main__":
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler((filters.TEXT | filters.Document.ALL) & ~filters.COMMAND, handle))
    
    print("Bot is running...")
    app.run_polling()