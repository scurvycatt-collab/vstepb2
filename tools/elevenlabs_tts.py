#!/usr/bin/env python3
"""Tạo file giọng đọc ElevenLabs cho toàn bộ câu hỏi và bài mẫu.

Chạy bằng GitHub Actions (khuyên dùng, xem README) hoặc trên máy:
    ELEVENLABS_API_KEY=... python3 tools/elevenlabs_tts.py --dry-run
    ELEVENLABS_API_KEY=... python3 tools/elevenlabs_tts.py --limit 5
    ELEVENLABS_API_KEY=... python3 tools/elevenlabs_tts.py

- Câu nào đã có file thì bỏ qua, chạy lại không tốn thêm credit.
- Kết quả: audio/<mã>.mp3 và audio/manifest.json (app tự đọc file này).
- Không bao giờ ghi API key vào file nào.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO_DIR = os.path.join(ROOT, 'audio')
MANIFEST = os.path.join(AUDIO_DIR, 'manifest.json')

# Giọng mặc định (giọng có sẵn của ElevenLabs). Đổi bằng tham số --answer-voice / --question-voice.
DEFAULT_ANSWER_VOICE = 'EXAVITQu4vr4xnSDxMaL'    # Sarah: giọng nữ Mỹ, rõ ràng
DEFAULT_QUESTION_VOICE = 'JBFqnCBsd6RMkjVDRZzb'  # George: giọng nam Anh, như giám khảo
DEFAULT_MODEL = 'eleven_multilingual_v2'


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


def tts(key, voice, model, text, fmt):
    url = 'https://api.elevenlabs.io/v1/text-to-speech/%s?output_format=%s' % (voice, fmt)
    body = json.dumps({
        'text': text,
        'model_id': model,
        'voice_settings': {'stability': 0.4, 'similarity_boost': 0.8, 'style': 0.35, 'use_speaker_boost': True},
    }).encode('utf-8')
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:300]
            if e.code in (429, 500, 502, 503) and attempt < 4:
                time.sleep(5 * (attempt + 1))
                continue
            raise SystemExit('Lỗi ElevenLabs %s: %s' % (e.code, msg))
        except urllib.error.URLError:
            if attempt < 4:
                time.sleep(5 * (attempt + 1))
                continue
            raise


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true', help='Chỉ đếm số câu và ký tự, không gọi API')
    ap.add_argument('--limit', type=int, default=0, help='Chỉ tạo N file mới (để nghe thử trước)')
    ap.add_argument('--answer-voice', default=os.environ.get('ANSWER_VOICE') or DEFAULT_ANSWER_VOICE)
    ap.add_argument('--question-voice', default=os.environ.get('QUESTION_VOICE') or DEFAULT_QUESTION_VOICE)
    ap.add_argument('--model', default=os.environ.get('MODEL_ID') or DEFAULT_MODEL)
    ap.add_argument('--format', default='mp3_44100_64')
    ap.add_argument('--redo', action='store_true', help='Tạo lại cả các câu đã có (tốn credit lại)')
    a = ap.parse_args()

    items = collect(load_data())
    manifest = {}
    if os.path.exists(MANIFEST) and not a.redo:
        manifest = json.load(open(MANIFEST, encoding='utf-8'))
    todo = [(t, k) for t, k in items if fnv(t) not in manifest]
    chars = sum(len(t) for t, _ in todo)
    print('Tổng: %d câu. Còn thiếu: %d câu, %d ký tự.' % (len(items), len(todo), chars))
    if a.dry_run:
        return
    key = os.environ.get('ELEVENLABS_API_KEY', '').strip()
    if not key:
        raise SystemExit('Thiếu ELEVENLABS_API_KEY')
    if a.limit:
        todo = todo[:a.limit]
    os.makedirs(AUDIO_DIR, exist_ok=True)
    for i, (t, k) in enumerate(todo, 1):
        h = fnv(t)
        voice = a.question_voice if k == 'q' else a.answer_voice
        mp3 = tts(key, voice, a.model, t, a.format)
        open(os.path.join(AUDIO_DIR, h + '.mp3'), 'wb').write(mp3)
        manifest[h] = 'audio/%s.mp3' % h
        if i % 10 == 0 or i == len(todo):
            json.dump(manifest, open(MANIFEST, 'w', encoding='utf-8'), indent=0, sort_keys=True)
            print('  %d/%d xong' % (i, len(todo)))
    json.dump(manifest, open(MANIFEST, 'w', encoding='utf-8'), indent=0, sort_keys=True)
    print('Xong. Manifest có %d file.' % len(manifest))


if __name__ == '__main__':
    sys.exit(main())
