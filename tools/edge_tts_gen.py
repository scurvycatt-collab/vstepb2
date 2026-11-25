#!/usr/bin/env python3
"""Tạo giọng đọc MP3 cho app bằng giọng neural của Microsoft Edge (miễn phí, không cần key).

Chạy qua GitHub Actions: workflow "Tạo giọng đọc Edge" (.github/workflows/edge-tts.yml).
Container của agent bị chặn dịch vụ Edge nên không chạy được trên đó. Trên máy cá nhân:
    pip install edge-tts==7.3.1
    python3 tools/edge_tts_gen.py --dry-run     # chỉ đếm số câu còn thiếu
    python3 tools/edge_tts_gen.py               # tạo câu còn thiếu vào audio/

- Câu đã có file sẽ bỏ qua. --redo tạo lại tất cả (khi đổi giọng).
- Kết quả: audio/<fnv>.mp3 và audio/manifest.json (app tự đọc file này).
"""
import argparse
import asyncio
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO_DIR = os.path.join(ROOT, 'audio')
MANIFEST = os.path.join(AUDIO_DIR, 'manifest.json')

# Giọng đã chọn: câu hỏi giọng nam Anh (như giám khảo), bài mẫu/từ/cụm câu giọng nam Mỹ.
DEFAULT_ANSWER_VOICE = 'en-US-AndrewMultilingualNeural'
DEFAULT_QUESTION_VOICE = 'en-GB-RyanNeural'


def norm(t):
    return re.sub(r'\s+', ' ', str(t)).strip()


def fnv(t):
    """Phải giống hệt hàm fnv() trong assets/app.js."""
    h = 0x811c9dc5
    for b in norm(t).encode('utf-8'):
        h ^= b
        h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h


SENT_RE = re.compile(r'[^.!?]+[.!?]+["”’]?\s*|[^.!?]+$')


def sentences(text):
    """Phải giống hàm sentences() trong assets/app.js."""
    parts = SENT_RE.findall(text) or [text]
    return [p.strip() for p in parts if p.strip()]


def _load_js(name):
    path = os.path.join(ROOT, 'assets', name)
    if not os.path.exists(path):
        return None
    raw = open(path, encoding='utf-8').read()
    return json.loads(raw[raw.index('{'):raw.rindex('}') + 1])


def load_data():
    data = _load_js('data.js')
    extra = _load_js('extra.js')
    if extra:
        data['sets'] = data['sets'] + extra['sets']
    data['vocab_js'] = _load_js('vocab.js') or {}
    return data


def collect(data):
    """Trả về danh sách (text, loại) theo thứ tự, không trùng."""
    items, seen = [], set()

    def add(t, kind):
        t = norm(t)
        if t and t not in seen:
            seen.add(t)
            items.append((t, kind))

    for s in data['sets']:
        for tp in s['p1']:
            add('Let’s talk about %s.' % tp['title'].lower(), 'q')
            for q in tp['qs']:
                add(q['q'], 'q')
                for x in sentences(q['a']):
                    add(x, 'a')
        add(s['p2']['situation'], 'q')
        for p in s['p2']['paras']:
            for x in sentences(p['t']):
                add(x, 'a')
        add(s['p3']['topic'], 'q')
        for p in s['p3']['speech'] + s['p3']['concl']:
            for x in sentences(p['t']):
                add(x, 'a')
        for f in s['p3']['fu']:
            add(f['q'], 'q')
            for x in sentences(f['a']):
                add(x, 'a')
    for tpl in data['templates'].values():
        for en, _vi in tpl['lines']:
            add(en.replace('…', ''), 'a')
    voc = data.get('vocab_js') or {}
    for group in voc.get('groups', {}).values():
        for x in group:
            add(x['w'], 'a')
            add(x['x'], 'a')
    for _e, _t, lines in voc.get('phrases', []):
        for en, _vi in lines:
            add(en.replace('…', ''), 'a')
    return items


async def speak(text, voice, path, rate, strict=True):
    """Trả về True nếu tạo được file. Dịch vụ Edge đôi khi chặn tạm thời, nên chờ lâu dần rồi thử lại."""
    import edge_tts
    for attempt in range(6):
        try:
            await edge_tts.Communicate(text, voice, rate=rate).save(path)
            if os.path.exists(path) and os.path.getsize(path) > 0:
                return True
        except Exception as e:  # mạng chập chờn hoặc bị giới hạn: thử lại
            print('  thử lại (%s): %s' % (attempt + 1, e))
        await asyncio.sleep(min(60, 5 * 2 ** attempt))
    if os.path.exists(path) and os.path.getsize(path) == 0:
        os.remove(path)
    if strict:
        raise SystemExit('Không tạo được: %s' % text[:60])
    print('  BỎ QUA (chạy lại workflow để tạo tiếp): %s' % text[:60])
    return False


async def generate(a):
    items = collect(load_data())
    manifest = {}
    if os.path.exists(MANIFEST) and not a.redo:
        manifest = json.load(open(MANIFEST, encoding='utf-8'))
    todo = [(t, k) for t, k in items if fnv(t) not in manifest]
    print('Tổng %d câu, cần tạo %d câu.' % (len(items), len(todo)))
    if a.dry_run:
        return
    if a.limit:
        todo = todo[:a.limit]
    os.makedirs(AUDIO_DIR, exist_ok=True)
    failed = 0
    for i, (t, k) in enumerate(todo, 1):
        h = fnv(t)
        voice = a.question_voice if k == 'q' else a.answer_voice
        ok = await speak(t, voice, os.path.join(AUDIO_DIR, h + '.mp3'), a.rate, strict=False)
        await asyncio.sleep(0.4)  # đi chậm để không bị chặn
        if not ok:
            failed += 1
            if failed >= 15:
                print('Dịch vụ đang chặn, dừng lại và lưu phần đã tạo.')
                break
            continue
        failed = 0
        manifest[h] = 'audio/%s.mp3' % h
        if i % 20 == 0 or i == len(todo):
            json.dump(manifest, open(MANIFEST, 'w', encoding='utf-8'), indent=0, sort_keys=True)
            print('  %d/%d' % (i, len(todo)))
    json.dump(manifest, open(MANIFEST, 'w', encoding='utf-8'), indent=0, sort_keys=True)
    left = sum(1 for t, _ in items if fnv(t) not in manifest)
    print('Xong. Manifest có %d file, còn thiếu %d câu.' % (len(manifest), left))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true', help='Chỉ đếm số câu còn thiếu')
    ap.add_argument('--answer-voice', default=os.environ.get('ANSWER_VOICE') or DEFAULT_ANSWER_VOICE)
    ap.add_argument('--question-voice', default=os.environ.get('QUESTION_VOICE') or DEFAULT_QUESTION_VOICE)
    ap.add_argument('--rate', default=os.environ.get('RATE') or '+0%', help='Tốc độ gốc, ví dụ -5%%')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--redo', action='store_true')
    a = ap.parse_args()
    asyncio.run(generate(a))


if __name__ == '__main__':
    main()
