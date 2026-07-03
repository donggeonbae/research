# Nonlinear Image Inverse Scaffold — Phase Retrieval 실험 뼈대 구축 보고

이 문서는 **phase retrieval 기반 이미지 nonlinear inverse problem 실험을 위한 research scaffold** 구축 결과를 정리한다. 핵심 전제: **복원 모델은 아직 구현하지 않았다.** 현재 들어 있는 `DummyReconstructor`는 유효한 복원 방법이 아니며, dataset → forward operator → metric → HTML report → W&B logging 파이프라인 전체가 정상 동작하는지 검증하기 위한 자리표시자다. 낮은 PSNR/SSIM은 실패가 아니라 스캐폴드 검증의 정상 결과다.

- **코드 위치**: 로컬 `nonlinear_image_inverse_scaffold/` (src/evaluate.py가 진입점)
- **W&B**: `oisl/nonlinear-image-inverse-scaffold` (scalar/image/table/artifact 로깅 확인, run `7er8h1zk`)
- **작성일**: 2026-07-03

![GT | measurement | dummy recon | error map](assets/hero_comparison.png)

---

## 1. 문제 정의

Phase retrieval forward model:

$$y = |A x|^2 + \eta$$

여기서 $x \in [0,1]^{H \times W}$는 ground-truth 이미지, $A$는 2D Fourier transform(orthonormal, `norm="ortho"`), $y$는 intensity-only measurement, $\eta$는 noise다. $|Ax|^2$에서 **위상 정보가 소실**되므로 forward map은 $x$에 대해 nonlinear하고, 복원은 nonlinear inverse problem이 된다. 위 히어로 이미지의 두 번째 패널이 measurement(log-scale spectrum) — 위상이 없어 구조 정보가 보이지 않는 것이 문제의 본질이다.

현재 $A$는 단일 FFT만 지원하며 coded diffraction mask(다중 마스크)는 TODO다. Noise는 Gaussian($y + \sigma\epsilon$, 기본 $\sigma=0.01$)만 지원, Poisson은 TODO.

## 2. 스캐폴드 구성

```
nonlinear_image_inverse_scaffold/
├── configs/scaffold_phase_retrieval_dummy.yaml   # 실험 전체를 config로 정의
├── src/
│   ├── datasets.py            # toy(다운로드 불필요) + local folder dataset
│   ├── forward_operators.py   # FourierPhaseRetrieval (+ registry)
│   ├── reconstructors/        # base/dummy/registry + 4개 TODO skeleton
│   ├── models/                # UNet/unrolled/diffusion prior — 전부 TODO
│   ├── metrics.py             # PSNR·SSIM·measurement error·DC loss
│   ├── evaluate.py            # evaluate-only 진입점 (step 누적)
│   ├── report_utils.py        # 독립형 HTML report 생성
│   ├── wandb_utils.py         # 전부 graceful no-op 가능
│   └── train.py               # 의도적 placeholder (안내 후 종료)
├── notebooks/
│   ├── scaffold_demo.ipynb    # 단일 샘플 인터랙티브 데모
│   └── view_results.ipynb     # 저장된 결과(지표·비교이미지·failure) 열람
└── outputs/reports/           # index.html + latest.html + metrics + samples
```

설계 원칙:

- **HTML report는 W&B 없이 독립 동작.** `use_wandb: false`로 꺼도 보고서는 완전하게 생성된다(실측 확인).
- **실험 = config.** dataset/forward/reconstructor/logging 전부 YAML 한 장으로 결정되고, config 스냅샷이 HTML 보고서에 포함되어 재현 가능하다.
- **나중에 꽂는 구조.** 새 reconstructor는 `Reconstructor.reconstruct(measurement, forward_operator, init=None)` 인터페이스 구현 → `registry.py` 한 줄 등록 → config에서 이름 선택. Wirtinger Flow / TV / unrolled / diffusion prior용 빈 파일이 이미 자리 잡고 있다.
- **measurement consistency와 image quality를 항상 병기.** nonlinear 문제 특성상 "measurement는 잘 맞는데 이미지가 틀린" ambiguity/local minimum 케이스를 잡기 위해 failure case를 PSNR·SSIM·measurement error 세 기준으로 따로 저장하고, 자동 코멘트(예: *high measurement consistency but poor image quality*)를 붙인다.

## 3. Dummy reconstructor (자리표시자)

$$\hat{x} = \mathrm{normalize}\left(\left|\mathcal{F}^{-1}\!\left(\sqrt{y}\right)\right|\right)$$

위상을 전부 버리고 magnitude만 역변환하므로 **의도적으로 틀린** 복원이다. shape이 맞고 결정적(deterministic)이라 파이프라인 검증에는 충분하다. 실제 복원은 스펙트럼 초기화 + Wirtinger Flow gradient가 첫 후보이며, 이를 위해 `forward_operators.py`에 선형 파트 $A$의 adjoint($\mathcal{F}^{-1}$)를 빌딩블록으로 미리 넣어 두었다.

## 4. 검증 결과 (toy dataset 32장, 128×128 grayscale, GPU)

| 지표 | 값 | 해석 |
|---|---|---|
| mean PSNR | **10.03 dB** | dummy라서 낮음 — 정상 |
| mean SSIM | **0.229** | 〃 |
| mean measurement error | **0.981** | $\||A\hat{x}|^2 - y\|_2 / \|y\|_2$, ~1 = 복원 불능 상태 |
| mean DC loss | 1.75e6 | $\||A\hat{x}|^2 - y\|_2^2$ |
| runtime/sample | ~5 ms | forward+dummy recon |
| 전체 평가 | ~11 s | 32장, 이미지·보고서 생성 포함 |

![step 2 per-sample PSNR curve](assets/psnr_curve.png)

파이프라인 체크리스트 (전부 실측 통과):

- toy dataset이 외부 다운로드 없이 동작 (skimage 샘플 8장을 train/val/test로 분리 + split별 disjoint synthetic 이미지로 num_samples 충족)
- 평가 재실행 시 step 0→1→2 누적, `metrics.json`에 history/best 갱신
- `outputs/reports/`: index.html(11개 섹션)·latest.html·metrics.csv/json·5종 metric curve·샘플별 gt/measurement/recon/error_map/comparison PNG·3기준 failure case + 자동 코멘트
- W&B online: scalar + comparison image + sample table + HTML report artifact가 `oisl` entity로 업로드
- `use_wandb: false` / wandb 미설치 환경에서도 전 기능 동작 (graceful no-op)
- 두 노트북(`scaffold_demo`, `view_results`) headless 실행 통과
- `src/train.py`는 의도된 안내 메시지 출력 후 종료

## 5. TODO 로드맵

- [ ] Wirtinger Flow baseline (스펙트럼 초기화 + gradient descent)
- [ ] TV-regularized optimization
- [ ] U-Net denoiser prior
- [ ] Unrolled reconstruction network
- [ ] Diffusion prior
- [ ] Coded diffraction masks (다중 마스크 측정)
- [ ] Poisson noise + noise robustness 실험
- [ ] Ablation runner
- [ ] DIV2K full dataset (다운로드 스크립트는 placeholder 상태)

## 6. 사용법

```bash
pip install -r requirements.txt
python src/evaluate.py --config configs/scaffold_phase_retrieval_dummy.yaml
xdg-open outputs/reports/latest.html      # 또는 notebooks/view_results.ipynb
```

새 복원 알고리즘 추가: `src/reconstructors/base.py`의 인터페이스 구현 → `registry.py` 등록 → config `reconstructor.name` 변경. 그 외 코드는 손댈 필요 없다.

---

*출처: 로컬 스캐폴드 `nonlinear_image_inverse_scaffold/` (evaluate 결과물 `outputs/reports/`, 그림은 step_0002 산출물). W&B: `oisl/nonlinear-image-inverse-scaffold`.*
