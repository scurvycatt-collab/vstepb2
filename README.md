# VSTEP B2 Speaking – tự học 30 phút/ngày

Ứng dụng web chạy trên iPhone (Safari) để luyện kỹ năng Nói VSTEP B2 theo lộ trình 23/11 → 28/12/2026, thi ngày 29/12/2026.

**Mở app:** https://scurvycatt-collab.github.io/vstepb2/
Trên iPhone: mở link bằng Safari → nút Chia sẻ → **Thêm vào MH chính**.

## Có gì trong app

- **Hôm nay:** bài của ngày theo lịch, đồng hồ 30 phút, chuỗi ngày học, câu đến hạn ôn.
- **Mỗi thẻ học 4 bước:** Nghe & nói nhại bài mẫu → Học từ khóa / dàn ý → Nói có ghi âm, đếm giờ như phòng thi → Tự chấm theo checklist.
- **Ôn tập giãn cách:** câu đã học quay lại sau 1, 3, 7, 14 ngày tùy bạn tự đánh giá.
- **Thi thử:** máy đọc câu hỏi, đếm giờ (Part 2 và Part 3 có 1 phút chuẩn bị), ghi âm từng phần, nghe lại và so với bài mẫu.
- **Đề:** toàn bộ 6 bộ đề (12 chủ đề Part 1 với 37 câu, 6 tình huống Part 2, 6 chủ đề Part 3 với 18 câu hỏi phụ), có bản dịch tiếng Việt.
- **Tiến độ:** thống kê, câu còn yếu, bản ghi âm gần đây, cài đặt giọng đọc, sao lưu/khôi phục.

Dữ liệu tiến độ và bản ghi âm chỉ lưu trên máy đang dùng.

## Nguồn nội dung

Câu hỏi, bài mẫu, từ khóa và bản dịch lấy từ file `VSTEP_SPEAKING_EV2`. Từ khóa cho các câu chưa có trong file, sơ đồ ý Part 3 và dàn ý Part 2 được bổ sung dựa trên bài mẫu.

## Cấu trúc

```
index.html            trang chính
assets/data.js        dữ liệu 6 bộ đề
assets/plan.js        lịch học từng ngày
assets/app.js         logic app (ghi âm, đếm giờ, ôn tập, thi thử)
assets/style.css      giao diện
sw.js, manifest.webmanifest   chạy như app khi thêm vào màn hình chính
```

Không cần build. Chạy thử trên máy: `python3 -m http.server` rồi mở `http://localhost:8000`.
