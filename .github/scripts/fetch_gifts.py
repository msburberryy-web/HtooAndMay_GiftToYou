# Temporary: downloads each gift's large product photo, checks stock, and lists in-budget items from category pages.
import re, json, urllib.request, urllib.parse, html, os
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36', 'Accept-Language': 'ja'}
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r: raw = r.read()
    m = re.search(rb'charset=["\']?([\w-]+)', raw[:3000]); return raw.decode(m.group(1).decode() if m else 'utf-8', 'replace')
def text(s): s = re.sub(r'(?is)<(script|style).*?</\1>', ' ', s); s = re.sub(r'<[^>]+>', ' ', s); return re.sub(r'\s+', ' ', html.unescape(s))
cfg = json.load(open('.github/scripts/gifts.json'))
for c in cfg.get('debug', []):
    pg = get(f'https://milpoche.jp/Category/Items/{c}?lc=1'); links = re.findall(r'/Item/Detail/\d+', pg)
    print('DEBUG cat', c, 'links', len(links), 'len', len(pg)); i = pg.find(links[0]) if links else 0
    print('DEBUG raw', re.sub(r'\s+', ' ', pg[max(0, i-300):i+1500])); os.makedirs('product-photos', exist_ok=True)
for g in cfg['items']:
    url = 'https://milpoche.jp/Item/Detail/' + g['item']
    try: page = get(url)
    except Exception as e: print('ITEM', g['id'], 'PAGE ERROR', e); continue
    t = text(page); price = re.search(r'税込￥([\d,]+)', t)
    hidden = [bool(re.search(r'display:\s*none', m.group(0))) for m in re.finditer(r'<td id="UnavailableReason\d"[^>]*>', page)]
    shown = [m.group(1) for m in re.finditer(r'<td id="UnavailableReason\d"[^>]*>\s*([^<]+)', page)]
    stock = 'in stock' if hidden and all(hidden) else 'CHECK: ' + '; '.join(s.strip() for s, h in zip(shown, hidden) if not h)
    big = sorted({urllib.parse.urljoin(url, s) for s in re.findall(r'src=["\']([^"\']*/Images/Products/450/[^"\']*' + g['item'] + r'M01[^"\']*)', page)})
    msg = 'no image'
    if big:
        data = urllib.request.urlopen(urllib.request.Request(big[0], headers={**UA, 'Referer': url}), timeout=40).read()
        for old in os.listdir('product-photos'):
            if old.startswith(g['id'] + '.'): os.remove('product-photos/' + old)
        open(f"product-photos/{g['id']}.jpg", 'wb').write(data); msg = f'saved {big[0]} ({len(data)} bytes)'
    print('ITEM', g['id'], '| price', price.group(1) if price else '-', '|', stock, '|', msg)
seen = set()
for c in cfg.get('categories', []):
    for pg in (1, 2, 3):
        url = f'https://milpoche.jp/Category/Items/{c}?lc=1&pg={pg}'
        try: page = get(url)
        except Exception as e: print('CAT', c, pg, 'ERROR', e); break
        found = 0
        for m in re.finditer(r'(?is)<a[^>]+href="(/Item/Detail/(\d+))"[^>]*>(.*?)</a>', page):
            code = m.group(2); found += 1
            if code in seen: continue
            window = text(page[m.start():m.start() + 1500]); name = text(m.group(3)).strip()
            pm = re.search(r'税込\s*([\d,]+)\s*円', window)
            if not pm: continue
            yen = int(pm.group(1).replace(',', ''))
            if 2750 <= yen <= 3500 and name: seen.add(code); print(f'CAND cat{c} {yen:>5} https://milpoche.jp/Item/Detail/{code} | {name[:90]}')
        if not found: break
