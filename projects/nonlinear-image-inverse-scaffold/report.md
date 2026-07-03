# Nonlinear Image Inverse — Phase Retrieval FFHQ-256 벤치마크

이미지 nonlinear inverse problem(phase retrieval) 실험 프로젝트의 통합 보고서다. 처음에는 파이프라인 검증용 scaffold로 출발했으나 현재는 **실제 벤치마크 프로젝트**다: 고전 베이스라인(HIO/WF/TV)과 학습 기반 PnP-UNet(자체 학습)을 in-repo로 구현했고, 표준 베이스라인 DPS(ICLR 2023)·SOTA DAPS(CVPR 2025)를 공식 체크포인트로 실행해 **동일 프로토콜로 비교**했다. 데이터셋은 두 논문의 표준 벤치마크인 **FFHQ-256으로 통일**했다.

- **코드**: 로컬 `nonlinear_image_inverse/` (`src/evaluate.py` 진입점, config 기반; 舊 `nonlinear_image_inverse_scaffold`는 심링크로 유지)
- **W&B**: `oisl/nonlinear-image-inverse-scaffold` · **논문 리뷰**: [DPS vs DAPS 리뷰](https://donggeonbae.github.io/review/projects/dps-daps-phase-retrieval/) (`donggeonbae/review`)
- **작성일**: 2026-07-03 (전면 재작성 — scaffold 프레이밍 해제, FFHQ 전환, U-Net denoiser 추가)

![GT vs dummy/HIO/WF/TV/PnP-UNet/DPS/DAPS](assets/ffhq10_method_comparison.png)

---

## 1. 문제 정의와 forward model

$$y = |A(\text{pad}(x))| + \eta$$

$x\in[0,1]^{C\times H\times W}$, $A$는 centered orthonormal 2D FFT, pad는 DPS식 oversampling($\text{pad}=\lfloor\frac{o}{8}H\rfloor$/side, $o{=}2.0$: 256→384), $\eta$는 측정영역 Gaussian($\sigma{=}0.05$). **DPS 공식 코드와 비트 단위로 같은 설정**이며(centered FFT=`fft2_m`, pad 공식, amplitude 측정), intensity($|Ax|^2$)와 DPS식 Poisson noise도 지원한다. 위상 소실로 문제는 nonlinear·ill-posed이고 해는 180° 회전·순환 이동 모호성을 가진다 — 채점 전 전역 정합(`resolve_global_ambiguity`)은 문헌 표준 관행을 따른 것.

## 2. 방법

**In-repo 구현** (`src/reconstructors/`, registry 등록·config 선택):

| 이름 | 내용 |
|---|---|
| `hio` | Hybrid Input-Output(β=0.9) + ER polish, oversampling 패딩=support 제약, best-of-4 restarts |
| `wirtinger_flow` | amplitude loss $\||A(x)|-y\|^2$에 Adam + [0,1] projection, best-of-3 |
| `tv` | 위 + isotropic TV |
| `pnp_unet` | **자체 학습 U-Net denoiser prior** + PnP-FBS(HIO warm start → gradient step과 denoising 교대) |
| `dummy` | $|A^H y|$ — 파이프라인 sanity용, 유효한 방법 아님 |

**U-Net denoiser 학습**: 1.05M 파라미터 residual U-Net(3-scale, GroupNorm/SiLU, noise residual 예측), blind Gaussian denoising($\sigma\sim U[0.01,0.2]$), **FFHQ val 뒤쪽 900장(49100–49999)으로 학습 — 벤치마크 100장(49000–49099)과 분리**. 20k steps/18분(A6000), held-out에서 $\sigma{=}0.05$ 노이즈 26.2→37.2 dB. `python src/train.py --config configs/train_unet_denoiser.yaml`.

**체크포인트 실행**: DPS·DAPS 공식 레포(`/home/dgbae/data/baselines/`) + 공식 `ffhq_10m.pt`(FFHQ-256 DDPM). 출력은 `scripts/eval_external_recons.py`로 동일 forward·noise seed·정합 기준 채점.

## 3. 결과 ① — FFHQ-100 벤치마크 (49000–49099, 256px RGB, single-run)

| 방법 | PSNR | SSIM | meas. err | 시간/장 |
|---|---|---|---|---|
| dummy | 6.5 | 0.071 | 0.953 | 0.01 s |
| Wirtinger Flow | 12.9 | 0.144 | 0.158 | 6.6 s |
| TV | 13.0 | 0.152 | 0.157 | 10.7 s |
| HIO | 13.7 | 0.178 | **0.149** | 1.2 s |
| **PnP-UNet (자체 학습)** | **14.0** | **0.269** | 0.157 | 3.3 s |
| DPS (체크포인트) | 11.0 | 0.200 | 0.448 | ~150 s |
| **DAPS (체크포인트)** | **26.3** | **0.691** | 0.165 | ~30 s |

- DAPS single-run 26.3 dB(중앙값 29.4): 100장 중 20장이 <20 dB로 실패 — single run에서도 bimodal posterior의 mode 실패가 남는다(4-run이면 소거, §4 참조). DAPS 자체 평가는 25.0 dB(std 8.7)로 우리 채점과 일관(정합 유무 차이).
- **DPS single-run 11.0 dB(100장 전부 <20 dB)**: best-of-N 없이 단일 run으로는 좋은 mode에 거의 도달하지 못한다 — §4의 best-of-4(18.8 dB)와의 격차가 DPS 계열 수치를 읽을 때 프로토콜 명시가 필수인 이유를 100장 규모로 재확인해준다. 같은 single-run 조건에서는 자체 학습 PnP-UNet(14.0)이 DPS(11.0)보다 높다.
- **PnP-UNet이 in-repo 최선**: PSNR은 HIO +0.3 dB지만 SSIM은 +0.09 — denoiser prior가 구조 복원에 크게 기여(몽타주에서 시각적으로 확인).

## 4. 결과 ② — head-to-head 10장 (DAPS demo set, 4-run 프로토콜)

Diffusion 방법의 논문 프로토콜(best-of-4)로 전 방법 비교:

| 방법 | PSNR (mean / best-of-4) | SSIM | meas. err |
|---|---|---|---|
| dummy | 6.3 | 0.076 | 0.95 |
| WF | 12.5 | 0.147 | 0.147 |
| TV | 12.6 | 0.159 | 0.146 |
| HIO | 15.1 | 0.216 | 0.141 |
| **PnP-UNet** | **15.6** | **0.336** | 0.150 |
| DPS | 12.5 / **18.8** | 0.539 | 0.268 |
| **DAPS** | 27.5 / **30.3** | **0.795** | 0.156 |

핵심 관찰:

1. **DAPS 재현 성공** — 자체 평가 30.36 dB(논문 30.72), 통일 채점 best-of-4 30.34 dB. DPS best-of-4 18.8 dB도 문헌치(17.6)와 부합, run 간 대분산까지 문헌대로.
2. **학습 prior의 가치가 규모 순서로 정렬**: 손수 만든 1M U-Net(+0.5 dB, SSIM +0.12) ≪ 사전학습 diffusion prior(+15 dB). prior의 표현력이 성능 사다리를 결정한다.
3. **measurement error ↔ 화질 괴리**: HIO(0.141)가 DAPS(0.156)보다 measurement에 더 잘 맞지만 PSNR은 15 dB 낮음 — nonlinear 문제의 ambiguity/local minimum을 정량화하는 사례. 두 지표 병기가 이 프로젝트의 기본 설계인 이유.
4. 고전 방법의 RGB 채널별 독립 PR로 인한 색 어긋남(몽타주)도 구조적 한계로 확인 — PnP-UNet은 denoiser가 채널을 결합해 이를 완화.

## 5. 보조 결과 — DIV2K valid 32장 (grayscale 256px, 동일 forward)

HIO 14.8 / TV 13.3 / WF 13.2 / dummy 6.8 dB. 얼굴 도메인이 아니어도 고전 방법 순위는 동일.

## 6. 재현 가이드

```bash
# in-repo 방법 (nonlinear_image_inverse/)
python src/evaluate.py --config configs/phase_retrieval_ffhq.yaml --set reconstructor.name=pnp_unet
python src/train.py --config configs/train_unet_denoiser.yaml     # denoiser 재학습

# 외부 방법 채점
python scripts/eval_external_recons.py --gt <GT dir> --recon <recon dir> --out <json>
```

자산: 체크포인트 `outputs/checkpoints/unet_denoiser_ffhq.pt`(자체)·`/home/dgbae/data/baselines/checkpoints/dps-checkpoint/ffhq_10m.pt`(공식), FFHQ val 1000장 `data/raw/ffhq256_val`, 채점 JSON `outputs/metrics/`, 몽타주 `scripts/make_method_montage.py`. HTML 대시보드는 각 `outputs/reports_*/latest.html`, W&B `oisl/nonlinear-image-inverse-scaffold`.

## 7. TODO

- [ ] Wirtinger Flow 스펙트럼 초기화
- [ ] In-repo unrolled network / diffusion prior (DAPS 구조 우선 후보 — 리뷰 §3 참조)
- [ ] Coded diffraction masks, noise robustness sweep, ablation runner

---

*출처: 로컬 `nonlinear_image_inverse/`(구현·채점·그림 생성 코드), `/home/dgbae/data/baselines/`(DPS/DAPS 공식 레포·체크포인트), 그림은 `outputs/figures/ffhq10_method_comparison.png` 및 `outputs/metrics/`. 논문 리뷰: donggeonbae/review `dps-daps-phase-retrieval`.*
