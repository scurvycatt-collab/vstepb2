# Đọc trước khi làm gì

Toàn bộ bối cảnh, kiến trúc, trạng thái và việc còn dở của dự án nằm trong **[HANDOFF.md](HANDOFF.md)**. Đọc hết file đó trước khi sửa code.

Quy tắc bắt buộc (tóm tắt từ HANDOFF.md):
- Trả lời người dùng bằng tiếng Việt.
- Giọng đọc dùng Microsoft Edge TTS (miễn phí, không cần key). Không bao giờ đưa API key nào vào repo hay code chạy trên trình duyệt; nếu sau này cần key thì để trong GitHub repo secret.
- Mỗi lần đổi file trong `assets/` hoặc `audio/`: tăng `VERSION` trong `sw.js`.
- Không đổi key `localStorage` `vstep-b2-progress-v1` (mất tiến độ người dùng).
- Thêm câu mới thì chạy workflow `edge-tts.yml` (redo=false) để tạo giọng đọc.
- Cuối phiên: cập nhật HANDOFF.md (mục 9 và ngày cập nhật).
