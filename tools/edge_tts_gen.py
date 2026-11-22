#!/usr/bin/env python3
"""Tạo giọng đọc bằng giọng neural của Microsoft Edge (miễn phí, không cần key).

    pip install edge-tts
    python3 tools/edge_tts_gen.py --samples          # tạo file nghe thử vào samples/
    python3 tools/edge_tts_gen.py                    # tạo toàn bộ vào audio/

Câu đã có file sẽ được bỏ qua. Dùng chung danh sách câu và mã file với
tools/elevenlabs_tts.py, nên app không cần biết file do công cụ nào tạo.
"""
import argparse
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from elevenlabs_tts import AUDIO_DIR, MANIFEST, ROOT, collect, fnv, load_data, sentences  # noqa: E402

import edge_tts  # noqa: E402

DEFAULT_ANSWER_VOICE = 'en-US-AvaMultilingualNeural'
DEFAULT_QUESTION_VOICE = 'en-GB-RyanNeural'
SAMPLE_ANSWER_VOICES = ['en-US-AvaMultilingualNeural', 'en-US-EmmaMultilingualNeural', 'en-US-AndrewMultilingualNeural', 'en-GB-SoniaNeural']
SAMPLE_QUESTION_VOICES = ['en-GB-RyanNeural', 'en-US-BrianMultilingualNeural']


async def speak(text, voice, path, rate, strict=True):
    """Trả về True nếu tạo được file. Dịch vụ Edge đôi khi chặn tạm thời, nên chờ lâu dần rồi thử lại."""
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


async def samples(rate):
    d = load_data()
    out = os.path.join(ROOT, 'samples')
    os.makedirs(out, exist_ok=True)
    ans = ' '.join(sentences(d['sets'][0]['p1'][0]['qs'][0]['a']))
    p2 = ' '.join(sentences(d['sets'][1]['p2']['paras'][0]['t']))
    q = d['sets'][0]['p1'][0]['qs'][0]['q']
    for v in SAMPLE_ANSWER_VOICES:
        name = v.replace('Neural', '').replace('Multilingual', '')
        await speak(ans, v, os.path.join(out, 'mau-tra-loi-%s.mp3' % name), rate)
        await speak(p2, v, os.path.join(out, 'mau-part2-%s.mp3' % name), rate)
    for v in SAMPLE_QUESTION_VOICES:
        name = v.replace('Neural', '').replace('Multilingual', '')
        await speak(q, v, os.path.join(out, 'giam-khao-%s.mp3' % name), rate)
    print('Đã tạo file nghe thử trong samples/')


async def generate(a):
    items = collect(load_data())
    manifest = {}
    if os.path.exists(MANIFEST) and not a.redo:
        manifest = json.load(open(MANIFEST, encoding='utf-8'))
    todo = [(t, k) for t, k in items if fnv(t) not in manifest]
    print('Tổng %d câu, cần tạo %d câu.' % (len(items), len(todo)))
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
    ap.add_argument('--samples', action='store_true')
    ap.add_argument('--answer-voice', default=os.environ.get('ANSWER_VOICE') or DEFAULT_ANSWER_VOICE)
    ap.add_argument('--question-voice', default=os.environ.get('QUESTION_VOICE') or DEFAULT_QUESTION_VOICE)
    ap.add_argument('--rate', default=os.environ.get('RATE') or '+0%', help='Tốc độ gốc, ví dụ -5%%')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--redo', action='store_true')
    a = ap.parse_args()
    asyncio.run(samples(a.rate) if a.samples else generate(a))


if __name__ == '__main__':
    main()
