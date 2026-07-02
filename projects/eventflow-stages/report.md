# EventFlow 5-스테이지 상세 해설 — 처음 보는 사람을 위한 데이터 흐름 가이드

이 문서는 이벤트 카메라의 원시 이벤트에서 난류 통계까지, 데이터가 다섯 단계를 거치며 **정확히 어떤 모양으로 변환되는지**를 처음 보는 사람 기준으로 설명한다. 코드는 `canonical/` 아래 있고, 세 유동(pipe·jet·wake)이 **같은 코드**를 쓰며 유동별 차이는 config 값뿐이다.

```
raw events (.raw, Metavision)
  ├─ Stage 1  Velocity Estimator   → 프레임당 [x, y, vx, vy, triplet_count, layer_id]
  ├─ Stage 2  Path Tracker         → 프레임당 [x, y, vx, vy]
  ├─ Stage 3  Accumulator          → 좌표별 {U, u_rms, v_rms, uv}
  ├─ Stage 4  Denoiser             → (Stage 3와 한 몸: split-half 자기지도)
  └─ Stage 5  DNS 검증             → R²(station, channel) + profile figure
```

**대원칙 (전 스테이지 공통):** DNS(정답)는 Stage 5에서만 열린다. Stage 1–4는 정답을 한 번도 보지 않으므로, "무엇이 난류이고 무엇이 노이즈인가"를 **데이터 스스로의 재현성**으로 판별해야 한다 — 이것이 이 프레임워크의 자기지도(self-supervision)다.

---

## Stage 1 — Velocity Estimator (이벤트 → 순간 속도 벡터)

**파일**: `canonical/stage1_estimator.py` · **입력**: `.raw` 이벤트 스트림 · **출력**: 프레임당 `[x, y, vx, vy, triplet_count, layer_id]` (float64, N행 6열) + `frame_times.npy`

### 이벤트 카메라 데이터란

일반 카메라와 달리 이벤트 카메라는 "프레임"을 찍지 않는다. 각 픽셀이 밝기 변화가 생긴 **순간**에 독립적으로 `(x, y, t, polarity)` 하나를 방출한다. 유동에 뿌린 입자가 픽셀 위를 지나가면 그 궤적을 따라 이벤트들이 μs 해상도로 찍힌다. 문제는: 이벤트 하나엔 속도 정보가 없다는 것. **같은 입자가 만든 이벤트 3개를 찾아 이으면** 속도가 나온다.

### 처리 순서 (데이터가 겪는 일)

**1-1. 세그멘테이션 — 이벤트를 시간 조각으로.** 센서는 스캔라인처럼 y가 증가하며 이벤트를 뱉다가 갑자기 y가 크게 점프하면(>200px) 한 스캔이 끝난 것이다. 이 Y-jump를 감지해 이벤트 스트림을 "세그먼트"(pipe ~60μs, jet ~80μs, wake ~60μs짜리 시간 조각)로 자른다. 고정 시계가 아니라 데이터가 스스로 시간 단위를 정의한다.

**1-2. 피라미드 — 빠른 입자와 느린 입자를 다른 시간 창으로.** 한 유동 안에도 빠른 영역(제트 코어)과 느린 영역(가장자리)이 공존한다. 세그먼트를 $s$개 합치고 $g$개 건너뛰는 2-레이어 구성 $(s, g, dx, dy)$으로, 레이어-0은 짧은 창(빠른 입자용), 레이어-1은 긴 창(느린 입자용)을 본다. 어떤 레이어를 믿을지는 **속도 히스토그램의 교차점**(gate)으로 자동 결정 — 사람이 고르지 않는다.

**1-3. 삼중항(triplet) 검정 — "같은 입자"의 증명.** 시간 창 3개(pprev, prev, curr)에서 이벤트 하나씩을 골라, 등속 직선 위에 놓이는지 검사한다:

$$x_{pred}=x_c-v_x\,(t_c-t_{pp}),\qquad r^2=(x_{pp}-x_{pred})^2+(y_{pp}-y_{pred})^2\le 1.0^2\ \text{px}$$

세 점이 1px 오차 내 일직선이면 같은 입자로 인정. 이 허용오차(1px)를 느슨하게 풀면 R²가 아니라 **노이즈**가 늘어난다는 것을 실측으로 확인했다(재현성 검사).

**1-4. 3점 최소제곱 → 속도.** 통과한 삼중항의 위치–시간에 OLS 기울기:

$$v=\frac{\sum_i (t_i-\bar t)(z_i-\bar z)}{\sum_i (t_i-\bar t)^2}\times 10^6\ \ [\text{px/s}]$$

한 이벤트가 여러 삼중항에 걸리면 균일 평균하고, 지지한 삼중항 수를 `triplet_count`(신뢰도)로 기록한다.

**출력의 의미**: 프레임(≈0.7ms) 하나당 수천 개의 "이 위치에 있던 입자의 순간 속도" 벡터. 아직 노이즈가 많다 — 삼중항 하나의 속도 분해능은 약 1px/창길이 ≈ 600px/s로, wake의 변동 크기와 비슷한 수준이다.

---

## Stage 2 — Path Tracker (순간 벡터 → 경로 기반 정제 벡터) — 2026-07-02 통일 완료

**파일**: `canonical/stage15_pathcurve.py` (단일 모듈, 전 유동 공통) · **입력**: Stage 1 출력 · **출력**: 프레임당 `[x, y, vx, vy]`(공간합의 시) 또는 `[x, y, vx, vy, path_id]`(경로쌍 모드)

Stage 1의 벡터는 입자 하나를 **한 순간**만 본 것이다. Stage 2는 이를 정제한다. 2026-07-02부로 **전 유동이 하나의 pathcurve 모듈**을 쓰며(과거의 별도 fuse front-end는 삭제), 세 개의 config 노브로 유동에 맞춘다.

### 처리 순서 (한 모듈 안의 세 단계)

**2-1. 경로 추적 (공통).** 프레임 $t_0$의 벡터에서 seed(`seed_stride`마다) → 다음 프레임에서 등속 예측 $\hat p = p + v\,dt$의 반경 `gate` 안 최근접 벡터를 같은 입자로 연결 → 최대 $K$(30) 프레임. **가변 길이(min_len)**: `min_len`(8) 이상 살아남은 모든 경로를 실제 길이로 사용 — K를 키워도 짧은 경로가 탈락하지 않아 손해가 없다(실측으로 확인한 설계).

**2-2. 속도 소스 (config: `source`, `fd_halfwin`).** 경로에서 속도를 어떻게 뽑을지:
- `source='paths'` + `fd_halfwin=w`: 추적된 위치의 **국소 중심차분** $v_k=\frac{x_{k+w}-x_{k-w}}{2w\,dt}$ — correspondence를 직접 미분. 다항식 미분(과평활)과 raw triplet 속도(노이즈 과다)의 중간으로, 세 방식을 동일 조건 실측 비교해 선택. **jet(w=1)·wake(w=4)**.
- `source='events'`: 경로와 무관하게 **모든 tmin-통과 이벤트를 그대로** deposit (가중치=triplet_count). 공간적으로 매끄러운 유동에선 조밀한 이벤트 앙상블이 어떤 입자별 시간 속도보다 정확하다 — **pipe**. (과거 fuse의 철학이 이 config로 흡수됨; 구 fuse와 수치 동일함을 검증: 0.887=0.887@9k.)

**2-3. 공간 합의 (config: `spatial_window`).** fuse가 가진 강점 — PIV식 겹침 창(window/step) 안 confidence-가중 평균 — 을 deposit 뒤에 적용. **pipe window=32**(강한 공간 평균), **jet window=8**(가벼운 합의; jet 0.938→0.960의 주역), **wake는 off**(소용돌이가 평균에 뭉개짐; ±0.01 실측으로 확인).

### 경로 정보의 추가 활용 (Lagrangian pairing)

spatial 합의를 끄면 deposit에 `path_id`가 실려 나가고, Stage 4의 노이즈 선택기가 프레임 간 짝을 **NN 재추측 대신 추적된 경로 id로 정확히** 형성한다(오매칭 제거). wake가 이 모드를 쓴다.

### 왜 유동마다 값이 다른가 (자의적이지 않은 이유)

**deposit 값 선택 = 유동의 결맞음이 공간에 있는가(pipe→events+큰 창), 시간에 있는가(wake→경로차분+창 없음)에 측정을 맞추는 것.** jet은 중간(경로차분+작은 창). 모두 동일 조건 실측 비교로 정했고, 코드는 한 경로다.

---

## Stage 3 — Accumulator (벡터 → 좌표별 통계)

**파일**: `canonical/stage2_coord.py` · **입력**: Stage 2 출력 + 기하 config · **출력**: `profiles[station] = {U, u_rms, v_rms, uv, valid, count}`

### 좌표 매핑

각 벡터의 픽셀 위치 $(x,y)$를 유동 좌표 $(S, N)$으로 바꾼다 — pipe는 반경 $r/R$(축대칭이라 ± 접어서(fold) 한 프로파일), jet/wake는 $(x/D, y/D)$. **이 매핑에 들어가는 기하값(중심, 직경)이 결정적으로 중요하다**: wake는 실린더 중심이 144px, 직경이 48% 틀려 있었고 이 교정만으로 R²이 0.1→0.55로 뛰었다. 기하는 실험 보정 파일(cal.txt)과 물리(Reynolds·Strouhal로 직경 역산)로만 정하며 DNS를 보지 않는다.

### 누적

station(스테이션) × normal-bin(128개)마다 벡터들의 1·2차 모멘트를 쌓는다:

$$U=\langle u\rangle,\qquad \text{total}=\langle u^2\rangle-U^2$$

여기서 total 분산 = **난류 + 측정노이즈**. 이 둘을 가르는 것이 Stage 4의 일이다. 희박한 유동을 위해 이웃 fine-bin의 모멘트를 box-window(`smooth_bins`)로 합산하는데, 반드시 **각 fine-bin에서 자기 평균을 뺀 뒤(SS)** 합쳐야 한다 — 순서를 바꾸면 평균류의 기울기가 분산으로 새어 들어가 근벽/전단층에서 폭발한다(실측으로 확인한 함정).

---

## Stage 4 — Denoiser (자기지도 노이즈 분리) ★프레임워크의 심장

**파일**: `stage2_coord.py` 내부(누적과 한 몸) · **입력**: bin별 모멘트 합 · **출력**: 노이즈가 제거된 `u_rms, v_rms, uv`

### 문제 설정

bin 하나의 속도 분산에는 두 가지가 섞여 있다: **실제 난류**(유동의 진짜 요동)와 **측정 노이즈**(삼중항 추정 오차). 정답(DNS)을 볼 수 없으므로, 구분 기준은 단 하나 — **재현성**이다.

### split-half: 같은 것을 두 번 재기

핵심 아이디어: 연속한 두 프레임($2k$, $2k+1$)은 0.7ms 차이라, **같은 난류 구조**가 두 번 찍힌 것이다. 두 프레임의 벡터를 위치로 짝지으면(같은 입자/구조의 두 독립 측정 $u_e, u_o$):

- **난류**는 두 측정에 똑같이 들어 있다 → 곱의 기댓값에 살아남는다.
- **측정 노이즈**는 매번 독립이다 → 곱하면 평균 0으로 사라진다.

$$\underbrace{\mathrm{Cov}(u_e,\,u_o)}_{\text{난류 분산}}\qquad\text{vs}\qquad \underbrace{\mathrm{Var}(u_{all})}_{\text{난류}+\text{노이즈}}$$

즉 **노이즈 모델 없이, 파라미터 없이**, 데이터가 스스로 자신을 채점한다. 이것이 자기지도의 본체다. uv(전단응력)도 같은 방식의 교차 공분산으로 얻는다.

### multi-lag 외삽: 빨리 변하는 난류의 복원

jet처럼 난류가 빠르면 0.7ms 사이에도 난류 자체가 조금 변해서(decorrelation), split-half가 난류 일부를 노이즈로 오인해 **과소차감**한다. 보정: 프레임 간격 $\tau=1..6$에서 $\mathrm{Cov}(\tau)$를 재고 지수함수로 $\tau=0$에 외삽하면 "간격 0에서의 참 난류"가 복원된다(jet +0.04). 단, pipe에선 45k 프레임에서 -0.03 회귀가 실측되어 **유동별 config**(jet=6, pipe/wake=1)로 남겼다 — "통일 시도 → 즉시 다중 유동 검증 → 회귀 시 원복"의 실례.

### 정직성 가드레일 (전부 자기지도 파생)

- **total-cap**: 복원된 난류 ≤ 측정된 total (난류가 측정치보다 클 수는 없다 — 물리 불변식). 이 캡이 없으면 외삽이 진폭을 부풀린다.
- **Cauchy–Schwarz cap**: $|uv|\le\sqrt{uu\cdot vv}$.
- **MAD guard** (pipe): bin 내 중앙값 기준 표준화 잔차 $z>6$인 극단 이상치만 제거(REMOVE-only, 분산은 감소만 가능).
- **노브 선택도 자기지도로**: 예컨대 bin 해상도가 정직한지는 **시간을 분리한 두 반쪽**(전반부 vs 후반부 데이터)의 프로파일이 재현되는지로 판단한다. DNS와 잘 맞는 쪽을 고르는 것은 금지(그건 정답 끼워맞춤).

---

## Stage 5 — DNS 검증 (여기서만 정답 공개)

**파일**: `canonical/stage4_validate.py` · **입력**: Stage 4 프로파일 · **출력**: R²(station×channel), profile figure

이제 처음으로 DNS를 연다. 모델 프로파일을 DNS의 원래 좌표에 보간해 채널별로:

$$R^2 = 1-\frac{\sum (y_{model}-y_{DNS})^2}{\sum (y_{DNS}-\bar y_{DNS})^2}$$

응력은 분산 공간($u_{rms}^2$ vs DNS $\overline{u'u'}$)에서 비교한다. DNS 소스: pipe=자체 DNS npz, jet=Nguyen-Oberlack Re7000(측정과 동일 Re), wake=Ma-Karniadakis Case2. 평균 U에는 이벤트-온리 재보정(gauge)이 하나 들어간다: jet은 운동량 보존, wake는 원방 자유류=1 — 둘 다 물리 법칙 기반이며 응력은 건드리지 않는다.

**중요**: R²는 성적표일 뿐, 어떤 선택(K, gate, bin 폭…)도 R²를 보고 고르지 않는다. 선택 근거는 항상 Stage 1–4 안의 이벤트-온리 통계다.

---

## 유동별 config (코드는 동일, 값만 다름)

| | pipe | jet | wake |
|---|---|---|---|
| Stage 1 pyramid $(s,g,dx,dy)$ | (6,12,1,10),(6,30,0,2) | (4,4,7,2),(8,8,1,1) | (4,8,4,4),(12,24,2,2) |
| n_bins (px-해상도 정합) | 128 (4.3px/bin) | 128 (4.9px/bin) | **256 (9.7px/bin=입자간격)** |
| Stage 2 (한 모듈) | events, tmin4, spatial32 | paths, gate14, fd1, spatial8 | paths, gate4, fd4, 경로id 짝, dual-stream(s_cut 1.3) |
| 기하 | 중심 572.5, 벽 1125 | 노즐 (1240,360), D=250px | 실린더 (90,380), D=355px |
| Stage 4 n_lags | 1 | 6 | 1 |
| smooth_bins / MAD | 1 / **6(통일)** | 1 / **6(통일)** | 9 / **6(통일)** |
| gauge | — | 운동량(β=0) | 원방 U∞ |
| 공통 | max_frames=45000 · n_bins=128 · flow-name 분기 0 (감사 확인) | ← | ← |

## 현재 결과와 한계 (정직하게)

| 유동 | mean R² | 상태 |
|---|---|---|
| pipe | **0.918** | 목표(≥0.9) 달성 · Stage-2 통일 무손실 |
| jet | **0.968** | 목표 달성 · 역대 최고 (전 채널 ≥0.93; 통일 pathcurve + MAD) |
| wake | 0.635 | 역대 최고 — dual-stream 지역병합(근거리=기본 스팬, 원거리=2×스팬 빌드) + 정확 타임스탬프. 남은 사각=원거리 u_rms(변위-분산 진단으로 신호 존재 확인, 추출기 개발 중) |

wake의 남은 격차는 수십 개의 대조 실험(deposit 변형, 위상-분해, 서브픽셀, 2×스팬 피라미드, 상관면 PIV 등 — 전부 ±0.02)으로 좁혀 들어간 결과, **원거리 변동 신호가 raw 데이터 자체에서 약하다**는 진단에 도달했다 — 서로 독립인 3개 측정 경로(triplet·stage1-PIV·raw-이벤트 PIV)가 같은 지점에서 동일하게 붕괴함을 확인(데이터 한계; 개선은 새 녹화 필요). 프레임워크의 가치는 이 과정 자체에 있다: 어떤 개선이 진짜이고 어떤 것이 정답 끼워맞춤인지 **스스로 판별하는 규율**.

## 재현

```
repo donggeonbae/event-flow-turbulence, branch work/wake-operator-recovery-20260624 @ 612b422 (dual-stream + 정확 타임스탬프)
MPLBACKEND=Agg PYTHONPATH=.pydeps:. python -m canonical.run pipe jet wake
```
