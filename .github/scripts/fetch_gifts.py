import urllib.parse
# Temporary: downloads each gift's main product photo (og:image) and prints the page facts to check.
import re, sys, json, urllib.request, html, os
UA = {'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1', 'Accept-Language': 'ja,en;q=0.8'}
def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        raw = r.read(); ctype = r.headers.get('content-type', '')
    m = re.search(rb'charset=["\']?([\w-]+)', raw[:3000]) or re.search(r'charset=([\w-]+)', ctype)
    enc = (m.group(1).decode() if isinstance(m.group(1), bytes) else m.group(1)) if m else 'utf-8'
    return raw.decode(enc, 'replace')
def text(page):
    t = re.sub(r'(?is)<(script|style).*?</\1>', ' ', page); t = re.sub(r'<[^>]+>', ' ', t)
    return re.sub(r'\s+', ' ', html.unescape(t))
GIFTS = json.load(open('.github/scripts/gifts.json'))
os.makedirs('product-photos', exist_ok=True)
for g in GIFTS:
    print('\n=====', g['id'], g['url'])
    try:
        page = get(g['url'])
    except Exception as e:
        print('PAGE ERROR', e); continue
    t = text(page)
    title = re.search(r'(?is)<title>(.*?)</title>', page)
    print('TITLE:', html.unescape(title.group(1)).strip()[:150] if title else '-')
    for kw in ['税込', '送料無料', '送料', 'ラッピング', '包装', '在庫', '品切', '販売終了', 'サイズ', '容量', '内容']:
        for m in list(re.finditer(kw, t))[:3]:
            print(f'  [{kw}]', t[max(0, m.start()-60):m.end()+80])
    if g.get('discover'):
        for href, label in re.findall(r'(?is)<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', page):
            lab = re.sub(r'<[^>]+>', ' ', label)
            if re.search(g['discover'], lab): print('  LINK:', href, re.sub(r'\s+', ' ', html.unescape(lab)).strip()[:120])
        continue
    img = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', page) or re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image', page)
    if not img: print('NO og:image'); continue
    src = urllib.parse.urljoin(g['url'], html.unescape(img.group(1)))
    print('IMAGE:', src)
    try:
        req = urllib.request.Request(src, headers={**UA, 'Referer': g['url']})
        data = urllib.request.urlopen(req, timeout=40).read()
        ext = '.png' if data[:4] == b'\x89PNG' else '.webp' if data[8:12] == b'WEBP' else '.jpg'
        open(f"product-photos/{g['id']}{ext}", 'wb').write(data); print('SAVED', len(data), 'bytes')
    except Exception as e:
        print('IMAGE ERROR', e)
