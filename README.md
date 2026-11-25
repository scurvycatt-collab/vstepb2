> **Agent / người tiếp quản: đọc [HANDOFF.md](HANDOFF.md) trước tiên.** File này ghi kiến trúc, cách tạo giọng đọc, trạng thái và việc còn dở.

# VSTEP B2 Speaking: tự học mỗi ngày

Ứng dụng web chạy trên iPhone (Safari) để luyện kỹ năng Nói VSTEP B2 theo lộ trình 23/11 đến 28/12/2026, thi ngày 29/12/2026.

**Mở app:** https://scurvycatt-collab.github.io/vstepb2/
Trên iPhone: mở link bằng Safari, bấm nút Chia sẻ, chọn **Thêm vào MH chính**.

## Có gì trong app

- **Hôm nay:** bài của ngày theo lịch, chuỗi ngày học, câu và từ đến hạn ôn.
- **Mỗi thẻ học 5 bước:** Từ mới, Nghe (bản ngắn hoặc đầy đủ, nghe chậm, nói nhại), Dàn ý, Nói có ghi âm và đếm giờ như phòng thi, Chấm điểm (máy chấm ước lượng hoặc tự chấm).
- **Ôn tập giãn cách:** câu và từ đã học quay lại sau 1, 3, 7, 14 ngày.
- **Thi thử:** máy đọc câu hỏi, đếm giờ, ghi âm từng phần, nghe lại và so với bài mẫu. Chọn ngẫu nhiên từ 16 bộ.
- **Đề:** 6 bộ đề gốc và 10 bộ luyện thêm, có bản dịch, từ vựng từng bộ, trang Câu mẫu.
- **Cài đặt** (nút Aa): cỡ chữ, thời lượng học mỗi ngày (15, 20, 30, 40 phút hoặc 1 tiếng), tốc độ đọc.

Dữ liệu tiến độ và bản ghi âm chỉ lưu trên máy đang dùng.

## Giọng đọc

App phát file MP3 tạo sẵn trong `audio/` bằng giọng neural Microsoft Edge (miễn phí, không cần key): câu hỏi giọng `en-GB-RyanNeural`, bài mẫu và từ vựng giọng `en-US-AndrewMultilingualNeural`. Câu nào chưa có file thì dùng giọng của iPhone.

Thêm hoặc sửa câu: vào Repo › Actions › **Tạo giọng đọc Edge (miễn phí)** › Run workflow, giữ giọng mặc định, `redo` tắt. Câu đã có file sẽ được bỏ qua.

## Cấu trúc

```
index.html                 trang chính
assets/data.js             6 bộ đề gốc + khung câu
assets/extra.js            10 bộ luyện thêm
assets/vocab.js            từ vựng theo bài + kho cụm câu
assets/plan.js             lịch học từng ngày
assets/app.js              logic app
assets/style.css           giao diện
audio/                     giọng đọc tạo sẵn + manifest.json
tools/edge_tts_gen.py      script tạo giọng đọc (chạy qua GitHub Actions)
sw.js, manifest.webmanifest   chạy như app khi thêm vào màn hình chính
```

Không cần build. Chạy thử trên máy: `python3 -m http.server` rồi mở `http://localhost:8000`.
