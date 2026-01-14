import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

BASE = "https://marketdeed.com"
START = BASE + "/products/"
MAX_PAGES = 1   # ✅ hard safety limit

headers = {"User-Agent": "Mozilla/5.0 (AI-Scraper)"}

page = 1
product_links = set()

# -----------------------------
# PHASE 1: Discover product URLs
# -----------------------------
MAX_PAGES = 1
page = 1
listing_links = set()

while page <= MAX_PAGES:
    url = START if page == 1 else f"{START}page/{page}/"
    print("Discovering:", url)

    res = requests.get(url, headers=headers, timeout=10)
    if res.status_code != 200:
        break

    soup = BeautifulSoup(res.text, "lxml")

    for a in soup.select(".rtin-title a[href]"):
        href = a["href"]
        full = urljoin(BASE, href)
        listing_links.add(full)

    page += 1

print("Total listings found:", len(listing_links))




# --------------------------------
# PHASE 2: Scrape each product page
# --------------------------------
listing_docs = []

for url in listing_links:
    print("Scraping listing:", url)

    res = requests.get(url, headers=headers, timeout=10)
    soup = BeautifulSoup(res.text, "lxml")

    main = soup.find("main") or soup.find("article") or soup.find("body")
    if not main:
        continue

    text = main.get_text(separator="\n", strip=True)
    title = soup.title.string if soup.title else "Untitled"

    listing_docs.append({
        "title": title,
        "url": url,
        "content": text
    })

print("Total listings scraped:", len(listing_docs))


import json

with open("marketdeed_listings.json", "w", encoding="utf-8") as f:
    json.dump(listing_docs, f, ensure_ascii=False, indent=2)

print("Saved marketdeed_listings.json")
