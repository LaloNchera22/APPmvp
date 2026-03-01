from playwright.sync_api import Page, expect, sync_playwright

def test_games_page(page: Page):
  page.goto("http://localhost:3000/test-layout")
  page.screenshot(path="/home/jules/verification/games_page_base2.png", full_page=True)

if __name__ == "__main__":
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
      test_games_page(page)
    finally:
      browser.close()
