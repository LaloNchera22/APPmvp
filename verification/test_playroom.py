from playwright.sync_api import sync_playwright

def test_playroom():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        # We go to the test route. We are bypassing the dashboard middleware.
        # But wait, we need to mock out the Next Router and Params for PlayMatchRoom.
        # Actually, let's just go to the dashboard and login, then navigate.
        # But we don't have a test user. Let's just mock it out via playwright routing or evaluating.
        # It's easier to just mock the component's internal state if we could, but we can't easily.

        # Let's try navigating to the page directly. The `useParams` might return null or error out.
        try:
            page.goto("http://localhost:3000/test-play-room", wait_until="networkidle")
            page.wait_for_timeout(3000)
            page.screenshot(path="/home/jules/verification/playroom_test.png")
            print("Screenshot saved to /home/jules/verification/playroom_test.png")
        except Exception as e:
            print("Error:", e)
        finally:
            browser.close()

if __name__ == "__main__":
    test_playroom()
