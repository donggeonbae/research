# EventFlow 통합 프레임워크 — 전체 구조 상세 (2026-07-01)

DNS-free 이벤트 카메라 난류 재구성. **하나의 config 기반 파이프라인**으로 pipe·jet·wake 세 유동을 동일 코드로 처리하고, DNS는 **검증/figure에서만** 연다. 현재: **pipe 0.943 / jet 0.929 / wake 0.58**.

## 설계 원칙 (우선순위)

1. **단일 config-only 프레임워크** — 유동별 차이는 오직 config(기하·pyramid·deposit·gauge·noise)에만. 알고리즘/closure에 flow-name 분기 없음, 별도 front-end 없음.
2. **무거운 연산 = 속도추정 + 경로추적** (유동 무관, 픽셀 공간). 좌표/기하는 값싼 downstream 매핑.
3. **정직성** — DNS는 Stage-4 검증에서만. 노브는 이벤트-온리 근거로 정당화(DNS R²로 후보 선택 금지). 각 bin에서 turb ≤ total 불변.
4. **목표** — 세 유동 mean R² > 0.9, 일반화 유지, 고변동 wake용 이벤트-온리 방법.

## 파이프라인 전체 (flow-name 분기 0)

```
raw events (.raw, Metavision)
  │
  ├─ Stage 1  per-event 속도 추정 (EBOF)              [유동 무관, 픽셀 공간]
  │     → 프레임당 [x, y, vx, vy, triplet_count, layer_id]
  │
  ├─ Stage 1.5  deposit (config 분기)                  [pipe/jet: fuse | wake: pathcurve]
  │     → 프레임당 [x, y, vx, vy]
  │
  ├─ Stage 2  좌표 split-half 누적                     [per-station normal-bin]
  │     → profiles[station]{U, u_rms, v_rms, uv}
  │
  ├─ Stage 3  이벤트-온리 평균 re-gauge                [jet: 운동량 | wake: tail-Uinf]
  │
  └─ Stage 4  DNS 검증 (variance space) + figure       [DNS는 여기서만]
        → R²(station, channel), profile PNG
```

## Stage 1 — per-event 속도 추정 (EBOF, `canonical/stage1_estimator.py`)

두 캐논 노트북(`ebof_main_gate_cfwt`)의 verbatim 포트. 입력은 raw 이벤트 스트림(EventsIterator, 10ms 배치).

1. **적응 Y-jump 세그멘테이션** — scan-line 기반. `py_prev − y > 200px`면 새 세그먼트 시작, 1초 이상 gap이면 버퍼 리셋. 세그먼트가 시간 프레임 단위(pipe ~60us, jet ~80us, wake ~60us).
2. **2-레이어 speed-gated 피라미드** — 유동별 `(s, g, dx, dy)` 쌍(merge count, temporal gap, 탐색 박스 반경). 레이어 속도 히스토그램에서 자동 speed-gate 산출.
3. **엄격 공선(co-linear) 삼중항** — `TRAJECTORY_TOL_PX=1.0`: 세 번째 이벤트가 curr-prev 등속 궤적 위 ±1px. (완화하면 재현 가능한 난류가 아니라 노이즈가 늘어 무효.)
4. **3점 선형 OLS**(`fit_vel_3pt`) → 속도. Polarity ON-only.

출력: 프레임당 `[x, y, vx, vy, triplet_count, layer_id]`. 유효 프레임 주기 ~60–700us(세그먼트 × slide step 12).

## Stage 1.5 — deposit (config 분기, `stage15_pathcurve.py` / `fuse_per_event`)

유동별로 **한 줄 config**로 갈린다(알고리즘 분기 아님):

- **pipe·jet → `fuse`** = confidence filter(triplet_count<tmin 버림) + PIV overlap bin(window/step, confidence 가중 uniform_filter) + speed gate. 노이즈 평균 + 촘촘한 split-half 짝짓기. (pipe 0.72→0.90, jet 0.73→0.84)
- **wake → `pathcurve`** = K개 프레임 추적(속도 예측 NN, gate) → 공유 Vandermonde 다항식(deg 3) fit → 미분해 **smooth 속도** deposit. Long-K가 von-Kármán swirl/대규모를 포착. `alpha_sat=0`(순수 smooth; 잔차 blending은 split-half를 깨서 무효 — 검증됨).

출력: 프레임당 `[x, y, vx, vy]`.

## Stage 2 — 좌표 split-half 누적 (`stage2_coord.py`)

**모든 유동 단일 경로.** per-station, normal-binned(pipe는 fold된 1 station, jet 4 / wake 3 stations).

- **기하**: `PipeRadialGeometry`(pipe, 축대칭 fold) 또는 `PlanarAxisGeometry`(jet/wake). `xy_to_sn(x,y)→(S,N)`로 각 이벤트를 (station, normal-bin) 배정.
- **Split-half 노이즈 선택기**(이벤트-온리, DNS 없음): 프레임을 even/odd로 나눠 연속 프레임(2k,2k+1)을 cKDTree로 gate 내 매칭 → **Cov(even,odd) = 난류**(백색 측정노이즈 제거), **Var(all) = total**. 물리 불변: turb ≤ total.
- **Multi-lag 디노이저**(`n_lags>1`): Cov를 τ=1..n에서 재고 τ=0으로 지수 외삽(총분산 cap, Cauchy-Schwarz uv cap). 깨끗한 유동에서 프레임간 decorrelation 과소차감을 복원(jet 0.83→0.92의 레버). pipe/wake는 decorrelation이 느려 n_lags=1로도 정확.
- **Windowed 누적**(`smooth_bins`): fine bin 위 box-window = 촘촘한 연속 프로파일 = 누적(보간 아님). 희박 유동의 산포 감소.

출력: `profiles[station]{U, u_rms, v_rms, uv, u_rms_raw, ...}`.

## Stage 3 — 이벤트-온리 평균 re-gauge (`stage3_gauge.py`)

평균 U만 보정(응력 불변):
- **jet**: 운동량-연속 top-hat 목표. `beta=0`(정직: stress gain은 total 초과 = DNS-튜닝이라 제거).
- **wake**: far-tail freestream Uinf(robust median).

## Stage 4 — DNS 검증 + figure (`stage4_validate.py`)

DNS는 **여기서만** 열림. variance space(모델 rms² vs DNS uu/vv), `_metric_on_ref`(모델을 native DNS 좌표로 보간). R²(station×channel) + profile PNG. pipe는 figure=누적 동일.

## Config-only 유동 차이 (`constants.py PER_FLOW`)

| | pipe | jet | wake |
|---|---|---|---|
| accumulator | pipe_radial(fold) | planar | planar |
| deposit | fuse{tmin4,w32,s8} | fuse{tmin2,w16,s8} | pathcurve{K30,deg3,ss3} |
| gauge | — | jet 운동량(β0) | wake tail-Uinf |
| n_lags | 1 | 6 | 1 |
| 기하 | center572.5/wall1125 | jet planar | **center(90,380)/D355** |

**이것 말고는 전부 공유 코드.** (사용자 지침: 유동별로 잘 되는 config면 OK, 단 wake 전용 함수는 금지.)

## 정직성 불변식

- 이벤트-온리: DNS는 Stage-4 검증/figure에서만.
- DNS-튜닝 금지: 노브는 이벤트 측정량(속도 autocorrelation, 삼중항 수, 입자 footprint, 물리 상수)으로 정당화. DNS R²로 후보 선택 안 함.
- turb ≤ total(각 bin), 프로파일 SHAPE가 DNS와 일치해야(진폭 억지 금지).

## 현재 결과 (기하 수정 + 수렴)

| flow | mean R² | 누적 | 상태 |
|---|---|---|---|
| **pipe** | **0.943** | ~100k 수렴 | U/u_rms/v_rms/uv 전 채널 양호 |
| **jet** | **0.929** | ~30k 수렴 | 원거리 v_rms(0.67)가 최약 채널 |
| **wake** | **0.58** | ~9–30k plateau | U 정합, 원거리 응력 진폭이 남은 gap |

## 이번 세션의 핵심 발견 — wake 기하 근본원인

wake 저조는 표본기근/estimator가 아니라 **기하 오등록**이었다(seed_stride·다중누적·bin-coarsening·입자크기 모두 데이터로 배제). `cal.txt`로 실린더 중심 234→**90**, 물리(Reynolds 313 + Strouhal 403 → geomean **355**)로 D 240→355 교정 → wake **0.10→0.58**, pipe/jet 불변. DNS 봉우리 ±0.6 정합은 튜닝이 아니라 검증. 상세는 [2026-07-01 진행 보고](report_2026-07-01.md).

## 재현

- repo `donggeonbae/event-flow-turbulence`, branch `work/wake-operator-recovery-20260624`.
- `MPLBACKEND=Agg PYTHONPATH=.pydeps:. python -m canonical.run pipe jet wake`
- Stage 캐시: Stage-1(raw→per-event velcache, cpp/triplet/seed에만 의존) → Stage-1.5(deposit) → Stage-2(누적) → Stage-4(검증). 실험은 바뀐 스테이지만 재실행.
