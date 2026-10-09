# Temporary: downloads each gift's product photo and prints the page facts (price, stock, links) to check.
import re, json, urllib.request, urllib.parse, html, os
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36', 'Accept-Language': 'ja,en;q=0.8'}
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r: raw = r.read()
    m = re.search(rb'charset=["\']?([\w-]+)', raw[:3000]); return raw.decode(m.group(1).decode() if m else 'utf-8', 'replace')
def text(s): s = re.sub(r'(?is)<(script|style).*?</\1>', ' ', s); s = re.sub(r'<[^>]+>', ' ', s); return re.sub(r'\s+', ' ', html.unescape(s))
cfg = json.load(open('.github/scripts/gifts.json')); os.makedirs('product-photos', exist_ok=True)
for g in cfg['items']:
    url = 'https://milpoche.jp/Item/Detail/' + g['item']; print('\n=====', g['id'], url)
    try: page = get(url)
    except Exception as e: print('PAGE ERROR', e); continue
    t = text(page); title = re.search(r'(?is)<title>(.*?)</title>', page); print('TITLE:', html.unescape(title.group(1)).strip()[:120] if title else '-')
    m = re.search(r'￥\s*[\d,]+\s*（税込￥[\d,]+）', t); print('PRICE:', m.group(0) if m else '-')
    for kw in ['内容', '現品サイズ', '素材', '原産国']:
        m = re.search(kw + r'[：:][^ ]{1,80}', t); print(f'  {kw}:', m.group(0) if m else '-')
    # stock: show the raw HTML around the sold-out notices and the cart button, so hidden template text can be told apart
    for kw in ['欠品のため', 'カートに入れる', 'カートへ']:
        for m in list(re.finditer(kw, page))[:2]: print(f'  RAW[{kw}]:', re.sub(r'\s+', ' ', page[max(0, m.start()-220):m.end()+40]))
    code = g['item']; imgs = []
    for src in re.findall(r'<img[^>]+(?:data-src|src)=["\']([^"\']+)["\']', page):
        if code in src.replace('-', '') or code[:4] + '-' + code[4:] in src: imgs.append(urllib.parse.urljoin(url, html.unescape(src)))
    print('  IMGS:', imgs[:6])
    if imgs:
        best = sorted(set(imgs), key=lambda s: ('_l' not in s.lower() and 'large' not in s.lower(), len(s)))[0]
        try:
            data = urllib.request.urlopen(urllib.request.Request(best, headers={**UA, 'Referer': url}), timeout=40).read()
            ext = '.png' if data[:4] == b'\x89PNG' else '.webp' if data[8:12] == b'WEBP' else '.jpg'
            open(f"product-photos/{g['id']}{ext}", 'wb').write(data); print('  SAVED', best, len(data), 'bytes')
        except Exception as e: print('  IMAGE ERROR', e)
for d in cfg.get('discover', []):
    print('\n##### DISCOVER', d['url'])
    try: page = get(d['url'])
    except Exception as e: print('PAGE ERROR', e); continue
    seen = set()
    for href, label in re.findall(r'(?is)<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', page):
        lab = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', label))).strip()
        if re.search(d['match'], href + ' ' + lab) and href not in seen: seen.add(href); print('  LINK:', href, '|', lab[:140])
