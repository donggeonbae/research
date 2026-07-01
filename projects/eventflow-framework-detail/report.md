# Event-Flow 프레임워크 상세 리포트 (canonical/)

이벤트 스트림에서 DNS 검증까지의 전 파이프라인을 단계 순서대로 정리한다. 모든 수식은 `canonical/` 실제 코드 라인에 대응하며, 유동별(jet/pipe/wake) 차이는 **config 값**과 **Stage-1.5 deposit 축** 외에는 존재하지 않음을 감사 절에서 확정한다.

파이프라인 개요:

```
raw events → Stage-1 (EBOF estimator) → Stage-1.5 (deposit/path-track)
           → Stage-2 (accumulate_coord) → Stage-3 (gauge) → Stage-4 (validate)
```

실행: `PYTHONPATH=.pydeps:.` 로 `/home/dgbae/data/event-flow-turbulence` 에서 구동.

---

## Stage-1 — EBOF 속도 추정기 (`canonical/stage1_estimator.py`)

원 이벤트 → 적응형 Y-jump 분할 → 속도 게이팅 2-레이어 피라미드 → 엄격한 공선 삼중항 → 3점 OLS 속도.

### 입력 (Input)
- Metavision `.raw` 이벤트 스트림. `EventsIterator(raw_path, delta_t=10000)` 로 10 ms 배치 디코딩 (`READ_BATCH_DELTA_T_US`, 분할과 분리됨).
- 각 이벤트 `eb`: `x,y`(uint px, 센서 1280×720), `t`(int64 µs), `p`(int32 극성 ∈{0,1}).
- 외곽 ROI 크롭 후 ROI-로컬 재기준화 `bx=x-x0, by=y-y0` (:1326–1335). 기본 ROI 전체 센서.
- 유동별 config: `S1Config.pyramid` 리스트 `[(s,g,dx,dy),…]` **만** 유동별로 다름 (jet `[(4,4,7,2),(8,8,1,1)]`, pipe `[(6,12,1,10),(6,30,0,2)]`, wake `[(4,8,4,4),(12,24,2,2)]`). ROI·극성·허용오차·서브픽셀은 전부 공유.

### 출력 (Output)
- 프레임당 `{frame:06d}.npy` (`_s1_process_frame`, :1263–1269). 스키마 **6열** `[x, y, vx, vy, triplet_count, layer_id]` (float64): ROI-로컬 위치(px), 피팅 속도(px/s), 삼중항 지지 수, 레이어 id ∈{0,1}.
- 두 피라미드 레이어의 이벤트 벡터를 `layer_id`와 함께 vstack. **여기서는 16px 셀 붕괴·속도 게이트 미적용** — 다운스트림 융합(`fuse_per_event`)으로 지연시켜 비싼 삼중항 계산을 1회만 수행.
- `frame_times.npy` (N,2) `[t_start_us, t_end_us]`.

### 수식 (Math)

**1. 적응형 Y-jump 분할 (:1344–1398).** 불연속 리셋 — 배치 간 시간 간격이 한계 초과 시 버퍼 flush:
$$b t_0 - \text{let} > \text{TIME\_GAP\_LIMIT\_US}=10^{6}\,\mu s \;\Rightarrow\; \text{reset} \quad (:1345)$$
스캔라인 점프 탐지 — y가 임계 이상 위로 튀면 새 세그먼트 (:1359):
$$py\_ - y > \text{Y\_JUMP\_THRESHOLD}=200\,\text{px}$$
첫 점프는 부분 세그먼트를 seed (`fsr=True, sjc=1`); **두 번째** 확인 점프($sjc\ge2$, :1367)에서만 버퍼 `sb`에 커밋.

프레임 방출 / 슬라이딩 윈도우 (:1311,1373–1380):
$$\text{mr}=\max_{(s,g)}(3s+2g),\qquad \text{while } |sb|\ge\text{mr}:\ \text{snap},\ \text{pop SLIDE\_STEP\_SEGMENTS}=12$$

**2. 삼중항 구성 (`build_triplet`, :401–407).** 윈도우 스팬 $ws=3s+2g$, $s=|buf|-ws$:
$$\text{pprev}=[s{:}s{+}sc],\quad \text{prev}=[s{+}sc{+}gp:s{+}2sc{+}gp],\quad \text{curr}=[s{+}2sc{+}2gp:s{+}3sc{+}2gp]$$

**3. 등속 궤적 (`process_triplet_v8`, :1012–1018).** 현재 이벤트 $(cx,cy,ct)$ 와 prev 후보 $k$ (탐색상자 $[cx\pm dx, cy\pm dy]$, $d_1=ct-p_t>0$):
$$c_{vx}=\frac{cx-\text{prev}_x[k]}{d_1}\cdot10^{6},\qquad c_{vy}=\frac{cy-\text{prev}_y[k]}{d_1}\cdot10^{6}\ [\text{px/s}]$$
크기 게이트 $\text{min\_mag}\le\sqrt{c_{vx}^2+c_{vy}^2}\le\text{max\_mag}$ (0 … 7e11).

**4. 엄격한 공선 삼중항 검정 (:1069–1074).** 궤적을 pprev 타임스탬프 $ppt$ 로 역외삽하고 반경 잔차 검사:
$$x_{pred}=cx-c_{vx}(ct-ppt)10^{-6},\quad y_{pred}=cy-c_{vy}(ct-ppt)10^{-6}$$
$$r_x=ppx-x_{pred},\ r_y=ppy-y_{pred},\qquad \boxed{\,r_x^2+r_y^2\le\text{TRAJECTORY\_TOL\_PX}^2=1.0^2\,}$$
정수 바운딩박스 프리필터 `pad=⌈tol⌉` (:1035–1042), $d_2=pt-ppt>0$, $ct-ppt>0$ 요구.

**5. 3점 OLS 속도 피팅 (`fit_vel_3pt`, :890–902).** 위치-시간 최소제곱 기울기:
$$\bar t=\tfrac{t_0+t_1+t_2}{3},\ \bar z=\tfrac{z_0+z_1+z_2}{3},\quad S_{tt}=\sum_i(t_i-\bar t)^2,\ S_{tz}=\sum_i(t_i-\bar t)(z_i-\bar z)$$
$$\text{slope}=\frac{S_{tz}}{S_{tt}+10^{-12}},\qquad v=\text{slope}\cdot10^{6}\ [\text{px/s}]$$
축별 적용 (:1088–1089): 반경-x는 서브픽셀 좌표, 축-y는 정수 좌표.

**6. 서브픽셀 반경 중심 (`subpix_radial_x`, :905–933, rx=ry=1).**
$$cx\_r=\frac{\sum_{ax}\sum_{ay} ax\cdot c(ax,ay)}{\sum_{ax,ay} c(ax,ay)},\quad c=\text{픽셀 이벤트 수}$$

**7. 균일 이벤트 누적 (:1097–1119).** 가중치 없이 균일 평균:
$$vx=\frac{1}{N}\sum v_{xt},\quad vy=\frac{1}{N}\sum v_{yt},\quad N=\text{cnt}$$
출력 행: `[cx, cy, vx, vy, cnt, cnt]`.

**8. 속도 게이팅 2-레이어 피라미드 융합 (다운스트림, `fuse_layers_speed_gated_bin`, :596–624).** 16px 셀마다 레이어-0 속도 $S_0=\sqrt{u_0^2+v_0^2}$ 에 대한 하드 스위치:
$$\text{cell}\leftarrow\begin{cases}\text{layer 1 (거침/느림)} & S_0<S_{gate}\\ \text{layer 0 (미세/빠름)} & S_0\ge S_{gate}\end{cases}$$
$S_{gate}$ 는 레이어1→0 속도 히스토그램 교차점으로 자동 보정 (`_find_hist_intersection`, :650). 레이어 내부 대표값은 삼중항 신뢰도 가중 평균 $\hat q=\sum_i w_i q_i/\sum_i w_i$, $w_i=\max(tc_i,1)$.

### 주요 상수
`Y_JUMP_THRESHOLD=200px`, `TIME_GAP_LIMIT_US=1e6`, `SLIDE_STEP_SEGMENTS=12`, `TRAJECTORY_TOL_PX=1.0`, `POLARITY_MODE=0`(ON-only), `SUBPIX_RADIAL=1`(rx=ry=1), `FIT_VEL_EPS=1e-12`, `BIN_CELL_SIZE=16`, `MIN_FLOW_MAG=0/MAX=7e11`, `sjc>=2`.

### 유동별 로직
**없음(config 외).** Stage-1에는 `if flow==...` 분기가 전무. 유일한 유동차는 `S1Config.pyramid` (constants.py:295/319/347). 나머지는 모두 공유 모듈 상수. **판정: 완전 통일, config-only.**

---

## Stage-1.5 — deposit / path-tracking (`canonical/stage15_pathcurve.py`)

**허용된 단 하나의 유동별 축** (fuse vs pathcurve). config-key 존재로 선택되며, 통일성 검증에서 구조적으로 제외됨.

### 입력 (Input)
- `frames: list[np.ndarray]`, 길이 `nf`, 각 `(n_events_f, 6)`, 열 `[x,y,vx,vy,triplet_count,layer_id]` (px, px/s).
- 스칼라 `dt` = 프레임당 초.
- config (`PER_FLOW[flow]["accum"]`): pathcurve `{K,deg,seed_stride,gate,tmin,alpha_sat,min_len}` (wake: K=30,deg=3,seed_stride=3,gate=4,tmin=2,alpha_sat=0.0,min_len=8); fuse `{tmin,window,step}`.
- 이 파일은 **pathcurve만** 구현 (fuse는 외부 모듈). jet/pipe → fuse, wake → pathcurve.

### 출력 (Output)
- `list[np.ndarray]` 길이 `nf`, 각 `(n_dep_f, 4)`, 열 `[x,y,vx,vy]` = 평활 피팅 위치(px) + 탈잡음 평활 속도(px/s). 빈 프레임은 `np.zeros((0,4))`. Stage-2로 직결.

### 수식 (Math)

**Pre-step: 신뢰도 필터 (line 44/102).** 삼중항 지지 $\ge t_{\min}$ 만 유지 후 프레임당 KD-tree:
$$F_t=\{\,e\in\text{frames}[t]: e_4\ge t_{\min}\,\}$$

**(A) 라그랑주 추적 (lines 69–79/127–135).** 스트라이드 seed (`for t0 in range(0, nf-K-1, seed_stride)`), 최대 `max_seeds=1500`. 등속 예측 후 최근접 스냅:
$$\hat p_k=p_{k-1}+v_{k-1}\,dt\qquad(\texttt{tr.query(pos+vel*dt, k=1)})$$
게이트 (line 74/131): $\text{ok}_k=\text{alive}_{k-1}\wedge(d\le\text{gate})$. 수용된 seed만 갱신:
$$p_k=\text{ok}_k?\,p^{NN}_k:p_{k-1},\qquad v_k=\text{ok}_k?\,v^{NN}_k:v_{k-1}$$
- **full-K** (`min_len=None`): $k=K$ 생존 seed만, 공통 피팅 길이 $K{+}1$ → 벡터화.
- **varlen** (`min_len` 설정, wake): `kexit`=마지막 생존 프레임 추적, $L\in[\text{min\_len},K_{\max}]$ 별 그룹 피팅. K를 올리면 긴 경로만 추가, 짧은 경로 탈락 없음.

**(B) 길이별 다항 피팅 (공유 Vandermonde 유사역).** 시간축 $tt=[0,dt,\dots,L\,dt]$, 차수 $d=\min(\text{deg},L{-}1)$:
$$V_{ij}=tt_i^{\,j}\quad(\texttt{np.vander(tt,d+1,increasing=True)}),\qquad V^{+}=\texttt{pinv}(V)$$
$$c_x=V^{+}X,\quad c_y=V^{+}Y,\qquad s_x=Vc_x,\ s_y=Vc_y\ (\text{평활 위치})$$

**(C) Deposit — 해석적 미분 = 평활 속도.** 미분 기저 $dV_{i0}=0$, $dV_{ip}=p\,tt_i^{\,p-1}$:
$$s_{vx}=dV\,c_x=dV\,V^{+}X,\qquad s_{vy}=dV\,c_y=dV\,V^{+}Y\quad[\text{px/s}]$$

**(C′) 노이즈 선택기 — lag-1 상관 잔차 블렌드 (full-K 전용, `alpha_sat>0`).** 경로 내 속도 잔차 $r=h^{v}-s_v$ 의 lag-1 자기상관 (`_lag1`):
$$\alpha=\operatorname{clip}\!\Big(\tfrac{1}{\alpha_{sat}}\cdot\frac{\sum_k r_k r_{k-1}}{\sqrt{\sum_k r_k^2\sum_k r_{k-1}^2}},\,0,\,1\Big)$$
$$dv=s_v+\alpha(h^{v}-s_v)$$
상관 성분(실제 난류, $\alpha\to1$)은 되살리고 백색 잡음($\alpha\to0$)은 버림. **wake는 alpha_sat=0 → 순수 평활** (blend 휴면; split-half 안정성 위해 검증됨). 프레임별 `[s_x[k],s_y[k],dv_x[k],dv_y[k]]` 방출.

**FUSE 분기 (config `{tmin,window,step}`, 본체 외부).** 신뢰도 필터 동일 후 Eulerian PIV 공위치화: 격자 셀(변 `window`px, 간격 `step`px → 중첩 $1-\text{step}/\text{window}$, pipe 32/8=75%) 내 벡터를 신뢰도 가중 평균. 시간 추적 없음 — 순간 중첩만.

### 주요 상수
wake pathcurve K=30/deg=3/seed_stride=3/gate=4/tmin=2/alpha_sat=0.0/min_len=8; max_seeds=1500; d=min(deg,L-1); fuse jet{2,16,8}·pipe{4,32,8}(중첩 75%); self-check: 3Hz 궤도 6입자 → 평균 deposit 속도 >100 px/s.

### 유동별 로직
**이 스테이지가 허용된 유동별 축.** 단, 코드에는 flow-name 분기 없음 — `PER_FLOW[flow]["accum"]`에 pathcurve dict 또는 fuse dict가 담기고 run.py가 `pathcurve` 키 존재로 dispatch. pathcurve 내부 2차 분기(`min_len is None`)도 config 파라미터 기반. **통일성 검증에서 제외되는 예외.**

---

## Stage-2 — accumulate_coord (`canonical/stage2_coord.py`)

좌표 분해, 배치 불변 이벤트 누적기 + split-half 노이즈 선택기 + 다중 lag Cov(τ)→0 외삽. jet/pipe/wake **단일 config-only 경로**.

### 입력 (Input)
- `frames`: 프레임별 float64 배열 리스트, 각 `(M_f, 4)` 열 `[x_px, y_px, vx_pxps, vy_pxps]` (`load_frames`, :62–77, `a[:,:4]` 슬라이스). split-half가 **연속 프레임 쌍**을 사용하므로 프레임은 분리 유지.
- `geom` 객체: `xy_to_sn`, `velocity_to_uv` (전 캘리브레이션 담당).
- config 값: `fold`(pipe축대칭 토글), `uv_sign`(pipe −1/jet·wake +1), `u_ref`, `stations`, `normal_range`, `s_halfwin=0.15`, `n_bins=128`, `gate_px=16`, `min_n=200`, `min_pairs=200`, `smooth_bins`, `cross_lag=1`, `n_lags`, `gate_grow=1.0`, `outlier_mad_k`, `min_frac`, `y_trim=0.05`, `proc_chunk=256`.

### 출력 (Output)
- `{"profiles":{station:dict}, "stations":[...], "n":n_centers, "u_ref":float, "fold":bool}` (:362–363).
- 각 `profiles[station]`: `n`(빈 중심), `valid`, `count`, `U`(평균 streamwise), `u_rms`(=√cross_s), `v_rms`(=√cross_n), `uv`(=uv_sign·cross_c), `u_rms_raw`/`v_rms_raw`(=√total, 노이즈-플로어 포함). rms_u는 항상 streamwise, rms_v는 항상 normal.

### 수식 (Math)

**1. 기하 매핑 (per-event, `PipeRadialGeometry`, :52–59), $R=\text{wall\_px}-\text{center\_px}$:**
$$S=y,\quad N=\frac{x-\text{center}}{R},\quad u=\frac{v_y}{u_\text{ref}},\ v=\frac{v_x}{u_\text{ref}}$$
(pipe: S=축, N=반경; u=축, v=반경). Planar은 S←x, N←y.

**2. 빈 할당 `assign(F)` (:156–172).**
- fold(pipe): $m=(s_{lo}\le S\le s_{hi})\wedge(|N|<1)$, 반경외향 부호 $v\leftarrow\operatorname{sgn}(N)v$, $\text{flat}=\operatorname{clip}(\lfloor(N+1)n_\text{bins}\rfloor,0,2n_\text{bins}-1)$. 축 트림 $s_{lo,hi}\pm y_\text{trim}(s_{hi}-s_{lo})$.
- planar(jet/wake): 스테이션 $\text{grp}=si$ ($|S-\text{st}_{si}|<s_\text{halfwin}$), $b=\lfloor(N-n_{lo})/(n_{hi}-n_{lo})\cdot n_\text{bins}\rfloor$, $\text{flat}=\text{grp}\cdot n_\text{bins}+b$.

**3. MAD 이상치 가드 (선택, `outlier_mad_k`, OFF→bit-identical, :80–109):**
$$|u-\tilde u_b|\le k\cdot\text{MAD}_u(b)\ \wedge\ |v-\tilde v_b|\le k\cdot\text{MAD}_v(b)$$
미관측/퇴화 빈은 MAD=∞ → 절대 탈락 안 됨. pipe $k=6$.

**4. TOTAL pass — 각 샘플 독립 (배치 불변, :191–200, `np.bincount`):**
$$N,\ S_u=\sum u,\ S_v=\sum v,\ S_{u^2},\ S_{v^2},\ S_{uv}$$
각 빈 자체 평균 주위 총 변동 (:258–259):
$$\text{SS}^{\text{var}}_s=S_{u^2}-\frac{S_u^2}{N},\quad \text{SS}^{\text{var}}_n=S_{v^2}-\frac{S_v^2}{N}$$
$\text{total}_s=\text{SS}^{\text{var}}_s/N$ = Var(all) = 난류 + 노이즈.

**5. SPLIT-HALF CROSS pass `_cross_moments(lag,gate)` (:206–241).** 쌍 $(A=\text{frame}_k, B=\text{frame}_{k+\text{lag}})$, `range(0,len-lag,2)`. KDTree NN 공위치화: $d,ia=\text{KDTree}(A_{:,:2}).query(B_{:,:2})$, $d\le\text{gate}$ 유지. $e$=A 읽기, $o$=B 읽기, B 기준 binning. 빈 자체 평균 주위 split-half 공분산:
$$\text{ss}_s=\sum e_u o_u-\frac{(\sum e_u)(\sum o_u)}{n_p}=\operatorname{Cov}(e_u,o_u)$$
$$\text{ss}_n=\sum e_v o_v-\frac{(\sum e_v)(\sum o_v)}{n_p}$$
$$\text{ss}_c=\tfrac12\!\left[\Big(\sum e_u o_v-\tfrac{(\sum e_u)(\sum o_v)}{n_p}\Big)+\Big(\sum o_u e_v-\tfrac{(\sum o_u)(\sum e_v)}{n_p}\Big)\right]$$
$e,o$ 는 같은 구조의 두 읽기 → 백색 측정 노이즈는 반쪽 간 독립이라 cross-cov에서 상쇄: $\operatorname{Cov}(e,o)$=난류, 노이즈=total−Cov.

**6. 다중 lag + τ=0 지수 외삽 (:243–283).** `n_lags>1` 시 이류-성장 게이트:
$$\text{gate}(\tau)=\text{gate\_px}\cdot\tau^{\text{gate\_grow}}$$
`_exp_extrap0`가 $\operatorname{Cov}(\tau)=A e^{-\tau/T}$ 를 $y=\log c(\tau)$ 로그-선형 OLS:
$$\text{slope}=\frac{\sum_\tau(t-\bar t)(y-\bar y)}{\sum_\tau(t-\bar t)^2},\qquad A=\exp(\bar y-\text{slope}\cdot\bar t)$$
$A$=τ=0 절편. 어떤 lag서든 비양수 빈은 $\operatorname{Cov}(1)$ fallback; $L<2$면 단일-lag와 bit-identical. jet $n_\text{lags}=6$, pipe/wake=1.

**7. Fold-pool + 박스 윈도우 누적 (:304–320).** fold 미러풀 $\text{pool}(a)=a[:n_\text{bins}]_{\text{rev}}+a[n_\text{bins}:]$ (±N 공유 빈, 풀링 전 각각 de-mean). 박스 윈도우(합):
$$\tilde a=\text{uniform\_filter1d}(a,W,\text{'constant'})\cdot W$$
counts·SS 모두에 적용 → 비율 무편향. wake $W=5$, jet/pipe $W=1$(off).

**8. 물리적 캡 적용 탈잡음 응력 (:329–340).** 다중-lag:
$$\text{cross}_s=\min(\max(A_s,c_s(1)),\text{total}_s),\quad \text{cross}_n=\min(\max(A_n,c_n(1)),\text{total}_n)$$
(lag-1 하한 = 성장 피팅 제거; total 상한 = 난류≤난류+노이즈). Cross 항 Cauchy–Schwarz 캡:
$$\text{cross}_c=\operatorname{clip}(A_c,-b,+b),\quad b=\sqrt{\max(0,\text{cross}_s\cdot\text{cross}_n)}$$

**9. 유효성 + 최종 출력 (:341–361).** 적응 게이트 $\text{min\_n}=\max(8,\lfloor\text{min\_frac}\cdot\operatorname{median}(N_{>0})\rceil)$. $\text{valid}=(N\ge\text{min\_n})\wedge(N_{p,0}\ge\text{min\_pairs})$:
$$U=\begin{cases}|S_u/N| & \text{fold}\\ S_u/N & \text{planar}\end{cases},\quad u_\text{rms}=\sqrt{\text{cross}_s},\quad v_\text{rms}=\sqrt{\text{cross}_n},\quad uv=\text{uv\_sign}\cdot\text{cross}_c$$

`__main__` self-check: split-half가 Var(T)를 cross-cov로 복원, total=Var(T)+노이즈, 배치 불변(proc_chunk 1 vs 999 동일), 다중-lag 외삽이 lag-1 초과·total 이하·Cauchy–Schwarz 준수 확인.

### 주요 상수
`gate_px=16`, `n_bins=128`(fold는 256 후 미러풀), `min_n=200`/`min_pairs=200`, `s_halfwin=0.15`, `y_trim=0.05`, `proc_chunk=256`, `n_lags` jet=6·pipe=1·wake=1, `gate_grow=1.0`, `smooth_bins` wake=5, `outlier_mad_k` pipe=6, `uv_sign` pipe=−1.

### 유동별 로직
**없음(config-only) — 검증됨.** 단일 누적 경로, 유일 분기 `if fold:`(:139/160/304)는 config 불리언(pipe True). 나머지 유동차(`uv_sign`, `n_lags`, `smooth_bins`, `outlier_mad_k`, `geom`)는 전부 config 값. `flow=='jet'` 류 분기 전무. **판정: 단일 통일 config-only 축.**

---

## Stage-3 — gauge (`canonical/stage3_gauge.py`)

이벤트-only 평균-U 재보정 (DNS 미사용).

### 입력 (Input)
- Stage-2 `result` dict 하나: `result["stations"]`, `result["profiles"]`. 각 `prof`: `n`, `U`(이벤트 p90 스케일, DNS의 ~0.8x), `u_rms`, `v_rms`, `uv`, `valid`. **DNS/reference 미판독.**

### 출력 (Output)
- **동일 dict를 in-place 변형**(반환도). 평균 `U`만 양 closure서 재보정; jet closure는 추가로 `u_rms/v_rms/uv`에 감쇠 gain 적용, wake closure는 응력을 p90 스케일로 **유지**. `n`, `valid` 불변. mode=None이면 identity.

### 수식 (Math)

**A. `gauge_jet_momentum` (:28–52) — 스테이션별 축대칭 운동량-연속 재스케일.** 유효점 $m=\text{valid}\wedge\text{isfinite}(U)$, $|m|<3$ 스킵. 정류·정렬 후:
$$nn=n[m],\quad UU=\max(U[m],0),\quad \text{den}=nn_{\max}-nn_{\min}$$
관측 축대칭 운동량 적분:
$$\text{observed}=\frac{\int UU^2|nn|\,d(nn)}{\text{den}}(nn_{\max}-nn_{\min})=\int UU^2|nn|\,d(nn)$$
단위 top-hat 운동량 타깃 $\text{target}=0.25$ 로 평균-U 재스케일:
$$\text{scale}=\operatorname{clip}\!\Big(\sqrt{\tfrac{\text{target}}{\text{observed}}},0.75,1.65\Big)$$
감쇠 응력 gain ($\beta=0.5$):
$$\text{rms\_gain}=\operatorname{clip}(1+\beta(\sqrt{\text{scale}}-1),0.82,1.28)$$
적용:
$$U\leftarrow U\cdot\text{scale},\quad u_{rms}\leftarrow u_{rms}\cdot\text{rms\_gain},\quad v_{rms}\leftarrow v_{rms}\cdot\text{rms\_gain},\quad uv\leftarrow uv\cdot\text{rms\_gain}^2$$

**B. `gauge_wake_tail_uinf` (:55–77) — 공유 원거리-tail 자유흐름 closure (평균 U만).** $\text{absn}=|n|$, $\text{tail\_q}=0.82$:
$$\text{thr}_s=Q_{0.82}(\text{absn}[m]),\quad \text{tail}_s=m\wedge(\text{absn}\ge\text{thr}_s),\quad \text{cand}_s=\operatorname{median}(U[\text{tail}_s])$$
공유 자유흐름 ($\text{uinf\_q}=0.20$):
$$U_\infty=\max(Q_{0.20}(cf),\ 0.5\operatorname{median}(cf))$$
모든 스테이션 평균 재보정 (응력 불변):
$$U\leftarrow U/U_\infty\ \Rightarrow\ \text{freestream}\to1$$

### 주요 상수
jet: target=0.25, β=0.5, clip_scale=(0.75,1.65), clip_rms=(0.82,1.28), uv는 rms_gain². wake: tail_q=0.82, uinf_q=0.20, uinf=max(Q₀.₂₀, 0.5·median). 양 closure 유효점<3 스킵.

### 유동별 로직
**이 스테이지가 의도된 유동별 closure 축, 단 config-값 dispatch.** `apply_gauge(result, mode, params)`가 `mode`(=`cfg['accum']['gauge']` 문자열)를 `_GAUGES={"jet_momentum":..., "wake_tail_uinf":...}`서 조회. mode falsy → identity(pipe). knob(jet `beta`, wake `uinf_q`)는 `params`로 splat. `if flow=="jet"` 없음.

---

## Stage-4 — validate (`canonical/stage4_validate.py`)

DNS 검증 + R² 스코어링 + figure.

### 입력 (Input)
- `validate(cfg, result)` (:145). `cfg`서 읽는 유일값은 `cfg["accum"]["validate"]` ∈ {pipe,jet,wake} (:151) — 어댑터 선택자.
- `result` = Stage-2 출력. 소비: `profiles[station]`의 `n`, `valid`, `U`, `u_rms`(STREAM), `v_rms`(NORMAL), `uv`; `stations`; `u_ref`(suptitle용).
- DNS는 **어댑터 내부서만** 개봉 (pipe `load_pipe_dns` :61, jet `load_jet_dns()` :84, wake `readable_load_wake_reference()` :100). 상류로 DNS 미유입.

### 출력 (Output)
- dict (:153–156): `rows`(스테이션별 채널), `mean_r2`, `r2`(={(station,channel):R²}), `suptitle`(mean_r2·u_ref·DNS 출처·소스경로).
- `make_figure` → 스테이션×채널 그리드 PNG 1장 (검정 DNS vs 빨강 이벤트, 서브플롯 제목에 R²).

### 수식 (Math)

고정 순서 4채널 (:23): $\text{CHANNELS}=(U,\ u_{rms}[\text{stream}],\ v_{rms}[\text{normal}],\ uv)$.

**1. 분산공간 변환.** `sq` 집합 채널은 model rms를 variance로 제곱 후 스코어 (:129):
$$m_{ch}\leftarrow(m_{ch})^2\quad\text{iff }ch\in\text{sq}$$
- jet/wake: `sq={"u_rms","v_rms"}` → model $u_{rms}^2$ vs DNS $\overline{u'u'}$. U·uv 미제곱.
- pipe: `sq=set()` → DNS `gt`가 이미 rms 공간이라 rms-vs-rms.

**2. R² 정의 (`_r2`, :26–33).** 유한-중첩 마스크(≥3점):
$$R^2=1-\frac{\sum_i(t_i-p_i)^2}{\sum_i(t_i-\bar t)^2},\qquad \bar t=\frac1N\sum_i t_i$$
잔차·총변동 모두 DNS 평균 $\bar t$ 주위 → DNS-분산 단위. <3점 또는 $ss_{tot}=0$ 이면 nan. jet/wake 경로는 `data_loading._r2` (동일 식, 유한쌍 ≥4).

**3. 두 스코어링 모드.**
- **(a) `_score_acc` — pipe ("acc")** (:41–50). model은 자체 빈 `n` 유지, DNS를 그 위로 보간:
$$R^2_{\text{pipe}}=\_r2\big(m(n_{\text{insup}}),\ \text{interp}(n_{\text{insup}};x_s,y_s)\big)$$
지지 $n\in[\min x_s,\max x_s]$, `valid & isfinite(m)`, ≥3점.
- **(b) `_score_ref` — jet/wake ("ref")** (:53–56, `_metric_on_ref`). 이벤트 $(n,m)$ 정렬, 중복 x 평균:
$$\hat y(u_x)=\frac{1}{\text{cnt}}\sum_{n_i=u_x} m_i$$
model 지지 $[u_x[0],u_x[-1]]$ 내 native DNS 좌표 $r_x$ 로 보간:
$$\text{pred}=\text{interp}(r_x^{\text{valid}};u_x,\hat y),\quad \text{truth}=r_y^{\text{valid}},\quad R^2=\_r2(\text{pred},\text{truth})$$
model ≥2점, DNS ≥4점 요구.

**4. 평균 R² (:140–141):**
$$\overline{R^2}=\frac{1}{|\mathcal F|}\sum_{(st,ch)\in\mathcal F} R^2_{(st,ch)},\quad \mathcal F=\{(st,ch):R^2\text{ 유한, non-None}\}$$

**Self-check (:198–214):** pipe DNS를 model로 되먹여 $\overline{R^2}>0.999$ → R²/보간 경로 identity-exact 확인.

### 유동별 로직
config dispatch, flow-name 아님. `ad=_ADAPTERS[cfg["accum"]["validate"]](result)` (:151). `_build_rows`(:119)는 단일 통일 루프; 유동별 동작은 어댑터 dict 필드(`line`,`titles`,`x_unit`,`label`,`sq`,`metric`)로 전달. 어댑터 차이는 (a) DNS 소스, (b) 채널 맵, (c) 좌표/미러 관례, (d) sq 집합, (e) metric 모드뿐:

- **pipe** (:65–77): DNS=260617 npz. 채널맵에 반경/축 SWAP (model u_rms(축)→DNS v_rms열, model v_rms(반경)→DNS u_rms열). `sq=set()`, `metric="acc"`, x_unit="r/R".
- **jet** (:80–94): DNS=`load_jet_dns()` (Nguyen-Oberlack Re7000). `_jet_ref_native_line`가 r≥0을 signed y/D로 미러(V/uv는 홀대칭). 채널맵 variance키(model u_rms→DNS vv=uz_var 등). `sq={u_rms,v_rms}`, `metric="ref"`, x_unit="signed y/D".
- **wake** (:97–112): DNS=`readable_load_wake_reference()` Case2. 채널맵(u_rms→uu 등). 결측 ref는 None→R²=NA. `sq={u_rms,v_rms}`, `metric="ref"`, x_unit="y/D".

jet·wake는 sq/metric 공유, pipe만 다름(acc + no-square + 축 swap).

### 주요 상수
CHANNELS=('U','u_rms','v_rms','uv'); R² 최소중첩 3(stage4)·4(data_loading); sq {} pipe·{u_rms,v_rms} jet/wake; metric acc(pipe)·ref(jet/wake); dispatch=`cfg['accum']['validate']`; DNS 개봉은 Stage-4 어댑터서만; self-check DNS-as-model pipe >0.999.

---

## ★ 통일성 감사 (Unified-code verdict)

**판정: YES — 하나의 config-only 축.** Stage-1/2/3/4 알고리즘 코드 어디에도 `if flow==pipe/jet/wake` 조건은 없다. Stage-1 estimator(1586줄)는 완전 flow-agnostic (유일한 `flow` 토큰은 데이터 변수 `flow_data`:272). Stage-2 accumulate_coord는 단일 경로이며 유일 분기는 config 불리언 `if fold:`. Stage-3 gauge, Stage-4 validate는 config **값**(`gauge` closure명, `validate` DNS-소스)에 대한 dict-dispatch이지 flow명이 아니며, Stage-4는 DNS를 맨 마지막에만 개봉한다. run.py의 `if ac['accumulator']=='pipe_radial'`는 geometry+u_ref를 고르는 config 값 판독. 유일한 진짜 유동별 축인 **Stage-1.5 deposit**(fuse vs pathcurve vs raw)만이 유동별 deposit 코드의 소재지이며 config-key 존재로 dispatch된다. **불법 flow-branch: 0건.**

제외한 비-파이프라인/구식 파일(flow-name 루프 포함): `gif.py`, `lag_probe*.py`, `canonical/.ipynb_checkpoints/*`.

### 분류된 분기 감사 표

| 위치 | 코드 | 판정 | 비고 |
|---|---|---|---|
| run.py:126 | `if ac['accumulator']=='pipe_radial':` | config_dispatch_ok | config 값이 geom+u_ref 모드 선택 (flow명 아님) |
| run.py:184–195 | `if pcv: deposit; elif fz: fuse; else raw` | **deposit_axis_ok** | 허용된 단 하나의 축: config-key 존재로 Stage-1.5 deposit 선택 |
| run.py:222 | `flows=sys.argv[1:] or ['pipe','jet','wake']` | config_dispatch_ok | CLI 기본 리스트; run_flow는 PER_FLOW[flow] 인덱싱 |
| stage4_validate.py:115,151 | `_ADAPTERS[cfg['accum']['validate']]` | config_dispatch_ok | 검증전용 DNS-소스 dict-dispatch, 최종 실행 |
| stage4_validate.py:76,210 | `label=lambda st:'pipe'; self-check` | config_dispatch_ok | 표식 라벨 + __main__ self-check, 프로덕션 아님 |
| stage3_gauge.py:80,88 | `_GAUGES[mode]` | config_dispatch_ok | config 값 `gauge`(closure명) 기반 평균-U 재보정, DNS 없음 |
| constants.py:291–377 | `PER_FLOW={'jet':..,'pipe':..,'wake':..}` | config_dispatch_ok | 통일 config 테이블; 유동차는 공유 코드가 소비하는 값 |
| stage2_coord.py:139,160–172 | `if fold: mirror-pool else stations` | config_dispatch_ok | config 불리언 `fold` 분기, 단일 accumulate 경로 |
| stage15_pathcurve.py:41 | `if min_len is not None: varlen` | **deposit_axis_ok** | deposit 스테이지 내부, config 파라미터 min_len 분기 |
| stage1_estimator.py:272 | `if flow_data is None or len==0:` | config_dispatch_ok | flow_data는 이벤트 배열, flow명 아님; Stage-1 flow 리터럴 0개 |

**불법 건수: 0.**

---

## 유동별 config 차이

모든 차이는 `constants.PER_FLOW[...]` 의 값 또는 Stage-1.5 deposit 축이다. 코드 분기 없음.

| 항목 | jet | pipe | wake | 소재 |
|---|---|---|---|---|
| Stage-1 pyramid `(s,g,dx,dy)` | `[(4,4,7,2),(8,8,1,1)]` | `[(6,12,1,10),(6,30,0,2)]` | `[(4,8,4,4),(12,24,2,2)]` | S1Config.pyramid |
| **Stage-1.5 deposit (허용 축)** | fuse `{tmin:2,win:16,step:8}` | fuse `{tmin:4,win:32,step:8}` | pathcurve `{K:30,deg:3,seed_stride:3,gate:4,tmin:2,alpha_sat:0.0,min_len:8}` | accum |
| geometry / accumulator | planar | pipe_radial (fold) | planar | run.py:126 |
| fold (축대칭) | False | **True** | False | accum.fold |
| uv_sign | +1 | **−1** | +1 | accum |
| n_lags (Cov(τ)→0 외삽) | **6** | 1 | 1 | accum |
| smooth_bins (박스 윈도우) | 1(off) | 1(off) | **5** | accum |
| outlier_mad_k (MAD 가드) | None | **6** | None | accum |
| Stage-3 gauge | `jet_momentum` (β=0.5) | None (identity) | `wake_tail_uinf` (uinf_q=0.20) | accum.gauge |
| Stage-4 validate 어댑터 | jet (ref, sq, 미러) | pipe (acc, no-sq, 축 swap) | wake (ref, sq) | accum.validate |
| DNS 소스 | Nguyen-Oberlack Re7000 | 260617 npz | Case2 wake ref | Stage-4 어댑터 |

---

## 현재 정직한 결과

| 유동 | mean R² |
|---|---|
| pipe | **0.943** |
| jet | **0.930** |
| wake | **0.594** |

pipe·jet는 목표선(≈0.9)을 통과, wake는 스월 지배 고변동 유동으로 pathcurve 추적(라그랑주) 채택에도 여전히 격차가 크다 — Stage-1.5 pathcurve가 유일하게 활성화된 이유이자 남은 개선 여지의 소재지다.