# Lensless Depth Diffusion Final Model Status

## Metadata

- Research ID: `lensless-depth-diffusion/2026/ldldm-bg-suppressed`
- Topic: physics-integrated latent diffusion for synthetic lensless depth estimation
- Last updated: 2026-06-07
- Public report URL: `https://donggeonbae.github.io/research/projects/lensless-depth-diffusion-final-model-status/`
- Figure archive mirror: `https://donggeonbae.github.io/research/projects/lensless-depth-diffusion-figure-set/`
- Manuscript status: `https://donggeonbae.github.io/writing/projects/lensless-depth-diffusion-manuscript-status/`

## Research Question

How can PSF-stack deconvolution physics be integrated into a latent diffusion depth model, instead of being used only as a static preprocessing step before a supervised depth regressor?

## Synthetic Scope

- Dataset protocol: fixed synthetic train/test split.
- PSF stack: 42 calibrated planes.
- Physical depth range: 4--70 cm.
- Synthetic test measurements are generated from RGB/depth/PSF physics.
- The current paper is scoped to synthetic train/test results. Real-capture validation is the next step for demonstrating practical effectiveness and is not included in the paper result table.

## Model Naming Policy

The final model name is `LDLDM`, short for Lensless Depth Latent Diffusion Model.

`LDLDM` means the promoted model must be a diffusion model with PSF/deconvolution physics active inside the model. A supervised U-Net or plane-posterior model may score higher, but it is a baseline or diagnostic comparison, not the promoted method.

## Current LDLDM Checkpoint

Current selected checkpoint:

- Model family: integrated-Wiener latent diffusion with PSF-stack deconvolution/focus conditioning.
- Checkpoint: selected LDLDM continuation checkpoint.
- Reverse diffusion sampling: 16 DDIM-style denoising steps.
- Added regularization: lightweight background depth and smoothness losses.
- Verified evaluation: shared synthetic test split.

## Background Regularization

The selected training recipe adds a lightweight background depth/smoothness regularizer to reduce isolated speckle in empty regions. The term is reported as part of the training configuration rather than as a separate model variant.

## Current Verified Metrics

The current checkpoint is verified on the shared synthetic test split. The paper table reports only metric values under the common evaluation protocol.

| Method | fg delta1 | fg delta2 | fg delta3 | fg MAE | Boundary MAE |
| --- | ---: | ---: | ---: | ---: | ---: |
| Physics focus, lambda=1e-4 | 0.391 | 0.617 | 0.816 | 0.2137 | 0.2368 |
| Raw-measurement U-Net | 0.436 | 0.629 | 0.753 | 0.2040 | 0.3760 |
| Deconv-volume U-Net | 0.865 | 0.926 | 0.949 | 0.0501 | 0.1144 |
| FlatNet3D-style RGB/depth | 0.823 | 0.908 | 0.939 | 0.0685 | 0.1740 |
| Plane-posterior U-Net | 0.898 | 0.939 | 0.957 | 0.0369 | 0.0925 |
| **LDLDM** | 0.879 | 0.918 | 0.931 | 0.0847 | 0.1126 |
| Plane-posterior + calibration | 0.885 | 0.946 | 0.971 | 0.0406 | 0.1099 |

Additional LDLDM empty-region metrics on the same full split:

- Background MAE: 0.0058
- Background total variation: 0.0020

## Qualitative Result

| LDLDM qualitative result |
| --- |
| ![](assets/ldldm_bg_suppressed_qualitative_colorbar.png) |

The paper now separates the qualitative evidence into two figures. Figure 2 is the two-column deconvolution-depth evidence panel using mid/late planes `z={14,22,30,38}`. Page 4 is ordered from the top as Figure 2 followed by Table 3. Figure 3 is the one-column synthetic comparison with RGB, GT depth, physics focus baseline, and LDLDM. The colorbar maps normalized depth `d in [0,1]` to the physical 4--70 cm depth range and PSF plane index `z=round(41d)`.

## Paper Update

The synthetic paper has been updated with:

- A tighter Introduction section with the large paragraph gap removed.
- The promoted method name `LDLDM`.
- Background regularization described compactly in the training protocol.
- A metric-only comparison table under the common synthetic evaluation protocol.
- Figure 2 split out as a large two-column deconvolution-depth evidence figure.
- Page 4 float order set to Figure 2 followed by Table 3.
- Figure 3 uses the cleaned LDLDM depth maps as a separate one-column comparison figure.

The local manuscript currently builds to a 6-page PDF including references.
