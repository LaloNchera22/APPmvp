from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        print("Navigating directly to matchmaking page (bypassed auth)...")
        page.goto("http://localhost:3000/dashboard/matchmaking")

        try:
            print("Waiting for h1...")
            page.wait_for_selector("h1", timeout=10000)
            h1_text = page.locator("h1").inner_text()
            print(f"Found H1: {h1_text}")

            if "Sala de Emparejamiento" in h1_text:
                print("SUCCESS: Title is correct.")
            else:
                print(f"FAILURE: Title is '{h1_text}', expected 'Sala de Emparejamiento'.")

            # Check if old title is present anywhere
            content = page.content()
            if "Ajedrez (Chess.com)" in content:
                 print("WARNING: Old text 'Ajedrez (Chess.com)' found in page content.")
            else:
                 print("SUCCESS: Old text 'Ajedrez (Chess.com)' NOT found.")

        except Exception as e:
            print(f"Error checking page content: {e}")
            page.screenshot(path="verification/error_bypass.png")

        page.screenshot(path="verification/matchmaking_page_bypass.png")
        print("Screenshot saved to verification/matchmaking_page_bypass.png")

        browser.close()

if __name__ == "__main__":
    run()
