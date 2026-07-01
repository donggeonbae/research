# EventFlow — 2026-07-01 동일-N 45k 캠페인 보고

## 요약

세 유동을 **같은 이벤트 예산(N=45000 프레임), 같은 코드**로 통일해 실행. **pipe 0.918 ✅ / jet 0.938 ✅** (목표 ≥0.9 달성), **wake 0.590 ❌**. wake의 남은 격차는 다운스트림이 아니라 **estimator 속도-양자화 바닥**이 원인임을 이벤트-온리 진단으로 확정.

## 한 일

1. **구식 데이터 수정** — pipe/jet 생산 캐시가 3000프레임(under-converged)이었음. 세 유동 모두 45k 프레임을 새로 빌드(기존 프레임·gate와 bit-동일 확인), `max_frames=45000` 통일.
2. **n_lags=6 통일 시도 → 회귀 발견 → 원복.** 3k에선 pipe −0.005였지만 **45k에서 −0.03 회귀**(lag-성장 gate가 decorrelated 매칭 유입). jet만 config로 6 유지(+0.04), 기본값 1. "성능 잃지 않는지 즉시 확인" 원칙의 실사례.
3. **MAD guard 검증** — pipe에서 제거 시 u_rms 0.80→0.62 (**+0.04 이득 확인**, 유지).
4. **죽은 코드 삭제** — `lag_probe.py`, `lag_probe_ext.py`, `bin_gate_per_event_frame` (참조 0).
5. **findiff deposit 정식 채택** — stage15에 `fd_halfwin` 모드(추적 위치의 중심차분 속도). wake config `fd_halfwin=4` (9k +0.02, 45k 동률, poly 미분보다 물리적으로 깨끗).

## wake 천장 진단 (이벤트-온리, 오늘의 핵심)

| 실험 | 결과 |
|---|---|
| cross vs **total** (노이즈차감 완전 off) | 0.598 vs 0.595 — **동일** → 잃어버린 난류는 누적에 안 들어옴 = 상류 문제 |
| 분해능 분석 | wake u'≈600px/s ≈ **양자화 바닥 1px/1.6ms=625px/s** — 변동이 측정한계와 같은 크기 |
| 2×-span pyramid (분해능 2배) | 1.54 v_rms .86→**.94**, u_rms .34→.58 (가설 입증) — 그러나 1.06 붕괴(긴 창이 근거리 곡률의 등속가정 위반) |
| wide 2-layer (fine+long) | 0.532 실패 — speed-gate는 공간이 아니라 속도로 분배 |
| 두 빌드 union | 0.603 (+0.008, 희석) |
| 위상-분해(phase-fold, 편향보정+SS-first) | 45k에서 0.583 (중간/원거리↑, 근거리↓, 순효과 중립) |

**결론: wake ≥0.9는 다운스트림 튜닝으로 불가** (모든 레버 ±0.02). 필요한 것은 **양자화-이하 estimator**(예: 서브픽셀 centroid 위치, 국소 적응 triplet 스팬) — Stage-1 수술급 작업.

## 현재 유동별 config 차이 (전부)

| | pipe | jet | wake |
|---|---|---|---|
| pyramid (s,g,dx,dy) | (6,12,1,10),(6,30,0,2) | (4,4,7,2),(8,8,1,1) | (4,8,4,4),(12,24,2,2) |
| deposit | fuse t4/w32/s8 | fuse t2/w16/s8 | pathcurve K30/ml8/fd4/deg3/ss3/g4/t2 |
| accumulator | pipe_radial(fold,uv−1) | planar | planar |
| geometry | c572.5/w1125/cali27.625/Ub.2925 | (1240,360)/D250 | (90,380)/D355 |
| n_lags | 1 | 6 | 1 |
| smooth_bins / mad_k | 1 / 6 | 1 / — | 5 / — |
| gauge | — | jet_momentum(β0) | wake_tail_uinf(q.5) |
| **공통** | max_frames=45000 · n_bins=128 · 동일 코드(Stage1–4) · flow-branch 0 | ← | ← |

## 재현

- repo `donggeonbae/event-flow-turbulence` @ `163f3d3`, branch `work/wake-operator-recovery-20260624`
- `MPLBACKEND=Agg PYTHONPATH=.pydeps:. python -m canonical.run pipe jet wake`
- Stage 무효화: Stage-1 재빌드(45k, bit-동일 검증) → 전 다운스트림 재실행. figure: `canonical/{pipe,jet,wake}_profile.png`
