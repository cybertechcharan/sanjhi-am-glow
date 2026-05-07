import os
import zipfile
import requests
import uuid
import time

NETLIFY_TOKEN = "nfp_wSgc6jS5MS4Qozmw4NgcC2gkHD17ERFpa128"



# ---------------- DEPLOYMENT LOGIC ---------------- #

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

# ---------------- MAIN EXECUTION ---------------- #

if __name__ == "__main__":
    try:
        print("🚀 Deploying to Netlify...")
        zip_file = zip_dist()
        live_url = deploy_to_netlify(zip_file)

        # Cleanup
        if os.path.exists(zip_file):
            os.remove(zip_file)

        print(f"🎉 Deployment Successful!")
        print(f"🔗 Link: {live_url}")
        print(f"Note: Give it 60 seconds to fully propagate.")

    except Exception as e:
        print(f"❌ Error: {str(e)}")