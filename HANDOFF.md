# HANDOFF: Hệ thống tự học VSTEP B2 Speaking

Ghi chú cho agent tiếp theo. Cập nhật lần cuối: 25/11/2026.

## 1. Bối cảnh

- Người học: trình độ A2, khoảng 40 tuổi, thi **VSTEP B2** ngày **29/12/2026**. Dùng **iPhone (Safari)**, học 15 phút đến 1 tiếng mỗi ngày (chọn trong app).
- Mục tiêu: luyện **Speaking** mỗi ngày, bao hết các dạng câu hỏi trong file đề gốc `VSTEP_SPEAKING_EV2.doc` (6 bộ đề, kèm bài mẫu và hướng dẫn trả lời).
- Ngôn ngữ trao đổi với người dùng: **tiếng Việt**. Giao diện app bằng tiếng Việt, nội dung học bằng tiếng Anh.
- Người dùng đã đồng ý public đầy đủ bài mẫu trên site.

## 2. Đường dẫn

| Thứ | Ở đâu |
| --- | --- |
| App (GitHub Pages) | https://scurvycatt-collab.github.io/vstepb2/ |
| Repo | https://github.com/scurvycatt-collab/vstepb2 (nhánh `main`, Pages build từ root) |
| File đề gốc | Do người dùng upload (không nằm trong repo). Nội dung đã chuyển hết vào `assets/data.js` |
| 10 chủ đề luyện thêm | Do người dùng tự tổng hợp và gửi (file `VSTEP_Speaking_B2_10_Topics_Full.json/.md`). Đã chuyển vào `assets/extra.js` |
| Giọng nghe thử | Thư mục `samples/` trong repo, và thư mục chia sẻ của project `voice-samples/` |

## 3. Kiến trúc

Static PWA, vanilla HTML/CSS/JS, **không có build step**. Hash router (`#/today`, `#/session/2026-11-23`, ...). Sửa file xong là push lên `main`, Pages tự deploy.

```
index.html              nạp data.js → extra.js → vocab.js → plan.js → app.js
manifest.webmanifest    PWA, Add to Home Screen trên iOS
sw.js                   Service worker network-first. TĂNG VERSION mỗi lần đổi nội dung (hiện: vstep-b2-v7)
assets/
  data.js               window.VSTEP_DATA: 6 bộ đề gốc + templates (khung câu P1/P2/P3)
  extra.js              window.VSTEP_EXTRA: 10 bộ luyện thêm (id 7–16) + refs (nguồn)
  vocab.js              window.VSTEP_VOCAB: groups (230 thẻ từ), phrases (kho ~40 cụm câu), flow (thứ tự nói + thời gian)
  plan.js               window.VSTEP_PLAN: lịch 23/11 → 28/12, thi 29/12
  app.js                toàn bộ logic (một IIFE)
  style.css             CSS, cỡ chữ theo biến --fs, có dark mode
  icon-*.png            icon app
audio/                  ~1.180 file MP3 + manifest.json (giọng đọc tạo sẵn)
samples/                file nghe thử giọng Edge
tools/
  elevenlabs_tts.py     danh sách câu cần đọc (collect), hàm hash fnv, sentences; tạo giọng ElevenLabs (đã bỏ, xem mục 6)
  edge_tts_gen.py       tạo giọng Microsoft Edge neural (miễn phí), dùng chung collect/fnv
.github/workflows/
  edge-tts.yml          workflow_dispatch: tạo giọng Edge, tự commit audio/ và kích hoạt Pages build
  elevenlabs.yml        workflow_dispatch: bản ElevenLabs (cần secret ELEVENLABS_API_KEY), không dùng nữa
```

### Schema dữ liệu (rút gọn)

```js
set = {
  id, extra?, name?, name_vi?,          // id 1–6 là đề gốc, 7–16 là luyện thêm
  p1: [{ title, title_vi, qs: [{ id:'s1-p1-1-1', q, q_vi, a, a_vi, kw:[], kw_vi:[] }] }],
  p2: { id:'s1-p2', situation, situation_vi, paras:[{h,h_vi,t,t_vi}],
        outline:{ best, opts:[{o,pro,con,best?}] } },
  p3: { id:'s1-p3', topic, topic_vi, mind:{ center, branches:[{t,n}x3], own:{t,n} },
        speech:[{t,t_vi}], concl:[{t,t_vi}], fu:[{ id:'s1-p3-fu1', q, q_vi, a, a_vi, kw }] },
  vocab: [[en, vi]]                      // danh sách cũ, ít dùng
}
VSTEP_VOCAB.groups = {
  's1-p1-1': [ { e, w, p, m, x, xv } ],  // e emoji (không còn hiển thị), w từ, p loại từ, m nghĩa, x ví dụ (trích bài mẫu), xv dịch
  's1-p2': [...], 's1-p3': [...],        // đề gốc: nhóm theo chủ đề P1 / P2 / P3 (P3 dùng chung cho câu hỏi phụ)
  's7': [...]                            // bộ luyện thêm: 1 nhóm cho cả bộ
}
```

Ví dụ trong thẻ từ **phải trích nguyên văn từ bài mẫu** của nhóm đó (dấu nháy cong ’). Hiện không còn script build trong repo: `data.js`, `extra.js`, `vocab.js` là nguồn gốc, sửa trực tiếp.

## 4. Luồng học

- **Trang Hôm nay**: đếm ngược ngày thi, streak, buổi hôm nay (theo `plan.js`), các buổi bị lỡ, ô "Ôn từ vựng" khi có từ đến hạn.
- **Lịch** (`plan.js`): tuần 1 học Part 1 của đề i, ngày 29/11 thi thử P1. Tuần 2 học Part 2, ngày 6/12 thi thử P2. Tuần 3 học Part 3 kèm câu hỏi phụ, ngày 13/12 thi thử P3. Tuần 4 (14–19/12) mỗi ngày thi thử nguyên một đề, 20/12 đề ngẫu nhiên. Tuần 5 (21–26/12) đề trộn, ẩn gợi ý. 27–28/12 ôn khung câu và ôn tập.
- **Mỗi thẻ học có tối đa 5 bước**: Từ mới → Nghe → Dàn ý → Nói → Chấm.
  - *Từ mới*: thẻ từ có nghe, sau đó kiểm tra nhanh (nhìn nghĩa, chọn từ). Từ làm sai được ôn lại theo lịch giãn cách. Trong một buổi, mỗi nhóm từ chỉ hiện 1 lần mỗi ngày (`S.vseen`).
  - *Nghe*: có *bản ngắn* (P1/câu hỏi phụ: 2 câu đầu; P2/P3: câu đầu mỗi đoạn) và *bản đầy đủ*. Có nút câu trước, câu sau, nghe lại câu, nghe chậm 0.7×, nói nhại (shadowing). Câu dài hiển thị dấu `/` chỗ ngắt hơi.
  - *Dàn ý*: từ khóa, outline P2, mind map P3, thứ tự nói.
  - *Nói*: đếm giờ như phòng thi (P1 35s, P2 1' chuẩn bị + 3', P3 1' + 3', câu hỏi phụ 40s) và ghi âm. P2/P3 nói 3 lần (chế độ 15–20 phút: 2 lần), thời gian 3:00 → 2:30 → 2:00 (kiểu 4/3/2).
  - *Chấm*: máy chấm ước lượng (mục 5). Nếu không có thì tự tick ý và tiêu chí. Bấm Tốt/Tạm/Chưa được để đưa vào lịch ôn.
- **Chế độ thời lượng** (`MODES` trong app.js): 15/20/30/40/60 phút, thay đổi số bước, số lần nói và số câu ôn. Bài mới mỗi ngày không đổi.
- **Ôn tập giãn cách**: `GAPS = [1,3,7,14]` ngày, áp dụng cho cả thẻ câu hỏi lẫn từ vựng.
- **Thi thử**: random lấy từ cả 16 bộ. Nguyên đề có cho 1–6 và luyện thêm 7–16. Trong lịch, mock random chỉ lấy cả 16 bộ từ ngày 14/12; trước đó chỉ lấy 6 đề gốc.
- **Tab Đề**: "Đề trong file (6)" / "Luyện thêm (10)". Mỗi bộ có trang Từ vựng `#/vocab/<id>`. Trang **Câu mẫu** (`#/templates`): khung câu, thứ tự nói theo thời gian, kho cụm câu (tổng hợp từ luyenthivstep.vn, có ghi nguồn).
- **Cài đặt** (nút Aa): cỡ chữ (Vừa / Lớn / Rất lớn / Cực lớn), thời lượng, tốc độ đọc (0.7–1.3×). Lần đầu mở app có hướng dẫn 4 màn.

### Lưu trữ phía client (chỉ trên máy người dùng)

- `localStorage['vstep-b2-progress-v1']`: `{ done, items, log, settings, words, vseen }`. Có xuất/nhập file sao lưu ở tab Tiến độ. **Không đổi tên key** để giữ tiến độ của người dùng.
- IndexedDB `vstep-b2-rec`, store `rec`: bản ghi âm (giữ tối đa 150).

## 5. Máy chấm ước lượng (đang chờ kiểm chứng trên iPhone thật)

- Dùng Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) chạy song song với `MediaRecorder` khi ghi âm. Không dùng API trả phí, không có key.
- `analyse()` so khớp từ nội dung (bỏ stopword, stem thô) với từng ý của bài mẫu, đếm số từ, từ/phút, từ nối, từ mới đã dùng. Điểm tổng = 0.35·đủ ý + 0.25·tốc độ (mốc 100 từ/phút) + 0.25·độ dài + 0.15·từ nối. Phân loại: ≥0.75 "Đạt mức B2", ≥0.5 "Khoảng B1", còn lại "Dưới B1". UI ghi rõ đây là ước lượng, chưa chấm phát âm và ngữ pháp.
- Bật/tắt ở tab Tiến độ: "Máy nghe và chấm ước lượng" (`settings.autoScore`, mặc định bật).
- **Sự cố 22/11**: trên iPhone thật, bấm ghi âm làm treo màn hình. Nghi do vòng lặp khởi động lại recognition. Commit `d7927a7` đã giới hạn: tối đa 25 lần khởi động lại, dừng hẳn sau 2 lần tắt nhanh (dưới 2s, không có kết quả) hoặc khi gặp lỗi khác `no-speech`. Khi không nghe được, app quay về tự chấm và hiện hướng dẫn bật Đọc chính tả.
- **Chưa có phản hồi** sau bản sửa. Đã hỏi người dùng kết quả: (a) có điểm, (b) báo "Máy không nghe được", (c) vẫn treo.
  - Nếu (b): làm chế độ "chỉ máy nghe" trên iOS, tức không chạy MediaRecorder trong lần nói đó.
  - Nếu (c): tắt mặc định `autoScore` trên iOS và điều tra tiếp.
- Test tự động: Playwright với lớp `FakeSR` gán vào cả `window.SpeechRecognition` và `window.webkitSpeechRecognition` (Chromium có bản không tiền tố). Chromium headless không có recognition thật.

## 6. Giọng đọc (TTS)

- App phát MP3 tạo sẵn nếu có trong `audio/manifest.json`, nếu không thì dùng giọng iPhone (`speechSynthesis`). Khóa của manifest = **FNV-1a 32-bit** của câu đã chuẩn hóa khoảng trắng. Hàm `fnv`/`norm`/`sentences` trong `app.js` và `tools/elevenlabs_tts.py` **phải giống hệt nhau**. Bài mẫu được đọc theo từng câu.
- Giọng đang dùng (người dùng đã chọn): **câu hỏi = `en-GB-RyanNeural`**, **bài mẫu/từ/cụm câu = `en-US-AndrewMultilingualNeural`**. Phát lại bằng `playbackRate` theo tốc độ người dùng chọn.
- **Thêm nội dung mới thì phải tạo giọng**:
  1. Đảm bảo `collect()` trong `tools/elevenlabs_tts.py` gom được câu mới (hiện gom: câu hỏi, bài mẫu, khung câu, từ và ví dụ trong vocab.js, kho cụm câu).
  2. Chạy workflow **"Tạo giọng đọc Edge (miễn phí)"** (`edge-tts.yml`) với inputs `mode=all`, `answer_voice=en-US-AndrewMultilingualNeural`, `question_voice=en-GB-RyanNeural`, `redo=false`. Câu đã có file sẽ bỏ qua. Workflow tự commit `audio/` và kích hoạt Pages build.
  3. Kiểm tra số câu còn thiếu: `python3 -c "import sys,json;sys.path.insert(0,'tools');import elevenlabs_tts as e;i=e.collect(e.load_data());m=json.load(open('audio/manifest.json'));print([t for t,_ in i if e.fnv(t) not in m])"`
- **Lưu ý**:
  - Container của agent bị proxy chặn `speech.platform.bing.com`, nên chỉ tạo giọng được trong GitHub Actions.
  - Dịch vụ Edge hay chặn tạm thời ("No audio was received"). Script đã có backoff, bỏ qua câu lỗi và lưu phần đã làm. Lần chạy 794 câu mất vài tiếng.
  - Gọi workflow bằng GitHub MCP `actions_run_trigger`. Pages API bị chặn từ container.
- **Trạng thái 25/11**: 1.183/1.184 câu có giọng. Còn thiếu 1 câu: `"In my opinion,"` (cụm câu). Chạy lại workflow như trên là đủ.
- ElevenLabs: tài khoản người dùng chỉ có 500 credit nên đã bỏ. Nếu dùng lại thì key **chỉ được để trong repo secret `ELEVENLABS_API_KEY`**, không bao giờ đưa vào code hay client.

## 7. Quy ước làm việc

- Commit trực tiếp lên `main` (repo cá nhân, không dùng PR). Tác giả: `scurvycatt-collab <269130467+scurvycatt-collab@users.noreply.github.com>`. Cuối commit message ghi trailer attribution theo hướng dẫn của phiên làm việc.
- Mỗi lần đổi asset: **tăng `VERSION` trong `sw.js`**, nếu không iPhone sẽ giữ bản cũ. Nhắc người dùng đóng app và mở lại 1–2 lần.
- Test trước khi push: chạy `python3 -m http.server`, dùng Playwright giả lập `devices['iPhone 13']` kèm các cờ fake mic (`--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`). Đi qua: hướng dẫn → cài đặt → session `#/session/2026-11-23` → từng bước → `#/sets/extra` → `#/vocab/7` → `#/templates` → `#/mock` → `#/words`. Kiểm tra không có `pageerror`.
- Kiểm tra cú pháp nhanh: `node -e "new Function(require('fs').readFileSync('assets/app.js','utf8'))"`.
- Người dùng không thích icon trang trí ở phần từ vựng (đã bỏ). Giữ giao diện đơn giản, chữ to, mỗi màn một việc, nút chính to ở cuối màn hình.

## 8. Nội dung và bản quyền

- 6 đề gốc: từ file của người dùng, người dùng đồng ý public.
- 10 bộ luyện thêm: người dùng tự tổng hợp. File gốc ghi rõ *không phải đề thi chính thức*, và app cũng hiển thị như vậy. Bản dịch tiếng Việt, từ vựng, outline P2 và mind map P3 do agent soạn.
- Thứ tự nói và cụm câu: tổng hợp, diễn đạt lại từ luyenthivstep.vn (có link nguồn trong trang Câu mẫu). **Không copy nguyên văn đề hay bài mẫu từ website khác** vào repo public.

## 9. Việc còn dở / bước tiếp theo

1. **Lấy kết quả thử máy chấm trên iPhone thật** (mục 5), rồi xử lý theo nhánh (a), (b) hoặc (c).
2. Chạy lại workflow Edge để tạo nốt 1 câu thiếu (`"In my opinion,"`).
3. Theo dõi tiến độ: lịch bắt đầu 23/11. Có thể đề xuất cách người dùng gửi file sao lưu tiến độ để xem họ đang yếu phần nào.
4. Ý tưởng nếu người dùng muốn thêm:
   - Chấm phát âm (cần dịch vụ có trả phí hoặc model trên máy, chưa có cách miễn phí, không cần key mà dùng được trên iOS).
   - Thêm từ vựng chi tiết cho từng câu P1 của bộ luyện thêm (hiện là 1 nhóm cho cả bộ).
   - Bỏ icon ở tiêu đề kho cụm câu nếu người dùng muốn (đã hỏi, chưa có trả lời).
