// Lịch học 30 phút/ngày từ 23/11 đến 28/12/2026, thi ngày 29/12/2026.
// Mỗi ngày gồm: các thẻ học mới (cards), thi thử (mock) và ôn tập (review).
(function () {
  const D = window.VSTEP_DATA;
  const p1Topic = (s, t) => D.sets[s - 1].p1[t - 1].qs.map(q => q.id);
  const p3All = s => [`s${s}-p3`].concat(D.sets[s - 1].p3.fu.map(f => f.id));
  const t = (s, n) => D.sets[s - 1].p1[n - 1].title;

  const days = [];
  const add = (date, week, title, opts) => days.push(Object.assign({ date, week, title, cards: [], review: true }, opts));

  // Tuần 1: Part 1, mỗi ngày 2 chủ đề (1 bộ đề)
  ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28'].forEach((d, i) => {
    const s = i + 1;
    add(d, 1, `Part 1: ${t(s, 1)} + ${t(s, 2)}`, {
      template: i === 0 ? 'p1' : null,
      cards: p1Topic(s, 1).concat(p1Topic(s, 2)),
      review: i > 0,
    });
  });
  add('2026-11-29', 1, 'Ôn Part 1 + thi thử Part 1', { mock: { parts: ['p1'], random: true } });

  // Tuần 2: Part 2, mỗi ngày 1 tình huống
  ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05'].forEach((d, i) => {
    const s = i + 1;
    const sit = D.sets[s - 1].p2.situation.split('.')[0];
    add(d, 2, `Part 2: ${sit}`, { template: i === 0 ? 'p2' : null, cards: [`s${s}-p2`] });
  });
  add('2026-12-06', 2, 'Ôn Part 2 + thi thử Part 2', { mock: { parts: ['p2'], random: true } });

  // Tuần 3: Part 3, mỗi ngày 1 chủ đề + câu hỏi phụ
  ['2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11', '2026-12-12'].forEach((d, i) => {
    const s = i + 1;
    add(d, 3, `Part 3: ${D.sets[s - 1].p3.topic}`, { template: i === 0 ? 'p3' : null, cards: p3All(s) });
  });
  add('2026-12-13', 3, 'Ôn Part 3 + thi thử Part 3', { mock: { parts: ['p3'], random: true } });

  // Tuần 4: ghép đủ 3 phần, mỗi ngày 1 bộ đề
  ['2026-12-14', '2026-12-15', '2026-12-16', '2026-12-17', '2026-12-18', '2026-12-19'].forEach((d, i) => {
    const s = i + 1;
    add(d, 4, `Đề ${s} đầy đủ (12 phút) + ôn câu yếu`, { mock: { parts: ['p1', 'p2', 'p3'], sets: { p1: s, p2: s, p3: s } } });
  });
  add('2026-12-20', 4, 'Đề trộn ngẫu nhiên + ôn câu yếu', { mock: { parts: ['p1', 'p2', 'p3'], random: true } });

  // Tuần 5: thi thử như thật, trộn các bộ để gặp lại mọi câu
  const mix = [[1, 3, 5], [2, 4, 6], [3, 5, 1], [4, 6, 2], [5, 1, 3], [6, 2, 4]];
  ['2026-12-21', '2026-12-22', '2026-12-23', '2026-12-24', '2026-12-25', '2026-12-26'].forEach((d, i) => {
    const [a, b, c] = mix[i];
    add(d, 5, `Thi thử như thật: P1 đề ${a}, P2 đề ${b}, P3 đề ${c}`, {
      mock: { parts: ['p1', 'p2', 'p3'], sets: { p1: a, p2: b, p3: c }, hideKeywords: true },
    });
  });
  add('2026-12-27', 5, 'Ôn nhẹ: 3 khung câu + câu hay vấp', { template: 'all', review: true, reviewMax: 10 });
  add('2026-12-28', 5, 'Ôn nhẹ lần cuối, ngủ sớm', { template: 'all', review: true, reviewMax: 6 });

  window.VSTEP_PLAN = {
    start: '2026-11-23',
    exam: '2026-12-29',
    weeks: {
      1: 'Tuần 1 · Part 1 (Social Interaction)',
      2: 'Tuần 2 · Part 2 (Solution Discussion)',
      3: 'Tuần 3 · Part 3 (Topic Development)',
      4: 'Tuần 4 · Ghép đủ 3 phần',
      5: 'Tuần 5 · Thi thử như thật',
    },
    days,
  };
})();
