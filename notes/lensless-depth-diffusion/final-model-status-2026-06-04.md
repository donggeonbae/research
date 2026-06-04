# Lensless Depth Diffusion Final Model Status

## Metadata

- Research ID: `lensless-depth-diffusion/2026/proposed-plus-realadapt`
- Topic: physics-integrated latent diffusion for lensless depth estimation
- Last updated: 2026-06-04
- Public report URL: `https://donggeonbae.github.io/research/projects/lensless-depth-diffusion-final-model-status/`
- Figure archive mirror: `https://donggeonbae.github.io/research/projects/lensless-depth-diffusion-figure-set/`
- Manuscript status: `https://donggeonbae.github.io/writing/projects/lensless-depth-diffusion-manuscript-status/`

## Research Question

How can PSF-stack deconvolution physics be integrated into latent diffusion reverse sampling, instead of being used only as a static preprocessing step before a supervised depth regressor?

## Dataset And Setup

- Train split: 66,000 RGB/depth pairs.
- Test split: 6,000 RGB/depth pairs.
- PSF stack: 42 calibrated planes.
- Synthetic test measurements are generated from RGB/depth/PSF physics.
- Real captured validation frames are used only as pseudo-label diagnostics, because their references are pseudo color/depth labels rather than independently measured GT depth.
- One epoch is approximately 66,000 optimizer updates in the final batch-size-1 configuration.

## Final Model Policy

`Ours` means the best model that satisfies the project policy: physics must be active inside latent diffusion reverse sampling. It does not mean the numerically strongest supervised baseline.

Final `Ours / Proposed` components:

- Latent depth VAE encoder/decoder.
- Conditional latent denoising U-Net.
- Timestep-conditioned learnable PSF-Wiener bank.
- Deconvolution-volume and focus-posterior conditioning.
- Clean-posterior focus likelihood evaluated inside reverse sampling.
- Latent correction from the focus likelihood before the DDIM step.
- Edge-aware smoothness and depth-guided RGB deconvolution-plane fusion.

## Final Full-Test Evidence

The final full-test run used 4 GPU shards, 1,500 samples per shard, and 16 reverse denoising steps. The checkpoint was evaluated after 330,020 optimizer updates, approximately 5.0 epochs. W&B logging was kept on under the `lensless-depth-diffusion` project with shard run names `proposed_full6k_shard0` through `proposed_full6k_shard3`.

| Method | Train state | Test size | fg delta1 | fg delta2 | fg delta3 | fg MAE | fg AbsRel |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Physics-only focus/deconv | no training | 6,000 | 0.391 | 0.617 | 0.816 | 0.214 | 0.425 |
| Earlier integrated LDM | 40k updates | 6,000 | 0.878 | 0.927 | 0.948 | 0.059 | not recorded in same aggregate |
| **Ours / Proposed** | 330,020 updates / 5.0 epochs | 6,000 | **0.896** | **0.922** | **0.932** | **0.050** | **0.115** |
| Guided diffusion ablation | 4k updates | 6,000 | 0.839 | 0.920 | 0.953 | not recorded in same aggregate | not recorded in same aggregate |
| Supervised teacher + affine | 66k updates | 6,000 | 0.885 | 0.946 | 0.971 | 0.041 | not recorded in same aggregate |

Interpretation:

- `Ours / Proposed` improves strongly over physics-only focus scoring.
- It improves strict depth and visual denoising relative to the earlier noisy integrated LDM, but its loose delta3 is lower.
- It does not reach the requested 98% target.
- The supervised teacher remains an upper-bound baseline and should not be renamed `Ours`.

## Learnable Deconvolution Diagnostic

The real validation data exposed a synthetic-to-real gap: fixed deconvolution amplified structured artifacts, including vertical stripe-like errors. A diagnostic branch, `Ours-RealAdapt`, was trained against real pseudo labels for 30 epochs. It is not the final diffusion method, but it confirms that measured captures need learnable inverse filtering.

| Split | Samples | Physics focus MAE / d1 / d3 | Diffusion Ours MAE / d1 / d3 | Ours-RealAdapt MAE / d1 / d3 | Main observation |
| --- | ---: | ---: | ---: | ---: | --- |
| 20250505 real validation | 20 | 0.230 / 0.294 / 0.852 | 0.365 / 0.337 / 0.639 | 0.264 / 0.382 / 0.648 | Learnable deconvolution improves learned-model MAE and suppresses artifacts, but physics focus still has lower pseudo-label MAE. |
| 20250527 real subset | 32 | 0.291 / 0.218 / 0.662 | 0.419 / 0.198 / 0.390 | 0.177 / 0.363 / 0.692 | Real-adaptive learnable deconvolution is strongest on the adaptation-domain subset. |

## Figure And Writing Status

- Architecture figure was rebuilt as a deterministic paper figure using real project tensors, not a generated placeholder.
- Architecture now explicitly shows the latent encoder/decoder, denoising U-Net, learnable PSF-Wiener bank, focus likelihood, latent correction, and depth-guided fusion.
- Deconvolution feature figure uses only mid/late planes `z={14,22,30,38}` because early planes were visually weak.
- Qualitative depth result panel shows RGB, GT depth, physics focus, and `Ours`; teacher and pure error maps are omitted.
- Paper and poster tables now report the final `Ours / Proposed` full-6k aggregate.

## Limitations

- The final diffusion model does not reach 98% delta accuracy.
- Synthetic full-test metrics are much stronger than real pseudo-label transfer.
- Plane-to-depth calibration is still approximate.
- The real-adaptive branch is supervised pseudo-label fitting, not proof that the diffusion model generalizes to real captures.
- The supervised teacher remains a stronger metric baseline than `Ours / Proposed`.

## Next Steps

1. Learn the optical plane-to-label-depth calibration instead of using a uniform depth-to-plane map.
2. Move the real-adaptive learnable inverse into the diffusion sampler rather than keeping it as a separate supervised diagnostic.
3. Add uncertainty-aware or mixed-depth boundary prediction for RGB fusion.
4. Tune clean-latent tether strength and focus-gradient logging to improve both strict delta1 and loose delta3 simultaneously.
