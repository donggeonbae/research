# Lensless Depth Diffusion Final Model Status

## Metadata

- Research ID: `lensless-depth-diffusion/2026/final-v15-physics-integrated-ldm`
- Topic: physics-integrated latent diffusion for lensless depth estimation
- Note type: method/status/evidence note
- Last updated: 2026-06-04
- Working project: local lensless-depth-diffusion training workspace
- Related review note: none yet; this file is the research source note
- Related writing target: final project paper and poster
- Public report URL: `https://donggeonbae.github.io/research/projects/lensless-depth-diffusion-final-model-status/`

## Research Question

How can PSF-stack deconvolution physics be integrated into a latent diffusion depth model, especially during reverse diffusion, rather than used only as a static preprocessing stage before a supervised network?

## Source Context

The project is motivated by three source clusters:

| Cluster | Role in this project | Verification status |
| --- | --- | --- |
| MWDNs / Wiener deconvolution for lensless restoration | Provides the PSF deconvolution baseline and focus-volume intuition | Source link exists in project plan; citation metadata still needs final paper verification |
| FlatNet3D-style lensless 3D reconstruction | Provides the supervised lensless-depth baseline family | Source link exists in project plan; citation metadata still needs final paper verification |
| Marigold / DiffusionDepth / diffusion restoration methods | Provides latent diffusion and depth-prior design context | Source links exist in project plan; exact claims should be checked before final citation |

## Dataset And Measurement Setup

- Train split: 66,000 RGB/depth pairs verified locally on 2026-06-04.
- Test split: 6,000 RGB/depth pairs verified locally on 2026-06-04.
- PSF stack: 42 planes.
- No measured lensless raw image split is currently treated as canonical evidence; synthetic lensless measurements are generated from RGB/depth/PSF physics.
- One training epoch equals 66,000 optimizer steps because the current final configuration uses batch size 1.

## Selected Final Model Policy

`Ours` should mean the best physics-integrated diffusion model, not the strongest supervised predictor. This distinction matters because a supervised teacher can produce higher depth metrics while not satisfying the project objective of embedding PSF/deconvolution physics into the diffusion process.

Current selected final family:

- v15 physics-integrated latent diffusion.
- Latent depth autoencoder encodes depth into a compact latent and decodes sampled latents back to depth.
- Latent denoising UNet predicts the reverse-diffusion update.
- 42-plane Wiener/deconvolution stack provides the main measurement-conditioned representation.
- Focus probability, depth-hint, and auxiliary focus channels expose per-pixel focus structure.
- Learnable time-conditioned Wiener parameters are part of the integrated model.
- A fixed auxiliary depth-wise Wiener bank uses per-depth selected deconvolution parameters.
- DAPS-lite posterior guidance/refinement is used during reverse diffusion.
- Depth-guided fusion of deconvolution planes produces all-in-focus RGB for reconstruction checks.

## Current Evidence

Full-test evidence for v15 now includes the 195,000-, 225,000-, 230,000-, 235,000-, and final 330,000-step checkpoints. The 330k checkpoint is selected as final `Ours`: it improves over the 225k checkpoint on foreground delta2, delta3, MAE, AbsRel, RMSE, and boundary MAE, while foreground delta1 is slightly lower. This note is intentionally overwritten at the same URL as new report artifacts arrive.

| Method | Train state | Test size | fg delta1 | fg delta2 | fg delta3 | fg MAE | fg AbsRel |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Physics-only focus/deconv | no training | 6,000 | 0.391 | 0.617 | 0.816 | 0.214 | not recorded in the same summary |
| Ours v15 | 195,000 steps / 2.95 epochs | 6,000 | 0.871 | 0.913 | 0.930 | 0.0567 | 0.133 |
| Ours v15 | 225,000 steps / 3.41 epochs | 6,000 | 0.878 | 0.920 | 0.938 | 0.0536 | 0.124 |
| Ours v15 | 230,000 steps / 3.48 epochs | 6,000 | 0.865 | 0.908 | 0.928 | 0.0561 | 0.128 |
| Ours v15 | 235,000 steps / 3.56 epochs | 6,000 | 0.857 | 0.904 | 0.924 | 0.0600 | 0.131 |
| Ours v15, final selected | 330,000 steps / 5.00 epochs | 6,000 | 0.877 | 0.922 | 0.941 | 0.0515 | 0.121 |
| Supervised residual teacher | trained baseline, not Ours | 6,000 | not recorded in the same summary | not recorded in the same summary | 0.971 | not recorded in the same summary | not recorded in the same summary |

Interpretation:

- Ours v15 substantially improves over physics-only focus/deconvolution.
- The 225k checkpoint improves over the 195k checkpoint on all foreground delta thresholds and MAE.
- The 230k and 235k full-test results are weaker than 225k, but the final 330k checkpoint recovers and becomes the selected `Ours` row.
- Ours v15 does not yet reach the user-requested 98% target.
- The supervised teacher remains useful as an upper-bound baseline, but should not be labeled as `Ours`.

## Final Convergence Run

- Resume source: v15 195,000-step checkpoint.
- Final target: 330,000 steps, equal to 5.0 epochs.
- Learning rate for continuation: `5e-5`.
- W&B project: `lensless-depth-diffusion`.
- W&B aggregate final eval: `https://wandb.ai/oisl/lensless-depth-diffusion/runs/umlaq2hu`
- Latest continuation checkpoint verified in the run directory: step 330,000.
- Latest train-log state observed: step 330,000 on 2026-06-04 UTC.
- Full 6,000-sample evaluation of step 225,000 has completed.
- Full 6,000-sample evaluations of steps 230,000 and 235,000 have completed as intermediate convergence checks.
- The 4-GPU sharded full-6,000-sample evaluation for the 330,000-step `latest.pt` has completed.

The paper/poster table now reports the final 330k `Ours` row.

## Intermediate Partial Evaluations

The final5epoch continuation has reached multiple partial evaluation milestones. These are useful as convergence signals but should not replace the full-test paper row.

| Checkpoint | Eval progress | fg delta1 | fg delta2 | fg delta3 | fg MAE | fg AbsRel |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Physics-only focus/deconv | first 1,000 / 6,000 | 0.391 | 0.618 | 0.817 | 0.214 | 0.423 |
| Ours v15, step 225k | first 500 / 6,000 | 0.883 | 0.924 | 0.942 | 0.0516 | 0.119 |
| Ours v15, step 225k | first 1,000 / 6,000 | 0.880 | 0.921 | 0.939 | 0.0528 | 0.122 |
| Ours v15, step 225k | first 1,500 / 6,000 | 0.880 | 0.922 | 0.940 | 0.0524 | 0.121 |
| Ours v15, step 225k | first 2,000 / 6,000 | 0.880 | 0.921 | 0.939 | 0.0534 | 0.122 |
| Ours v15, step 225k | first 3,000 / 6,000 | 0.878 | 0.920 | 0.938 | 0.0536 | 0.123 |
| Ours v15, step 225k | first 4,000 / 6,000 | 0.877 | 0.919 | 0.937 | 0.0538 | 0.124 |
| Ours v15, step 225k | first 5,000 / 6,000 | 0.877 | 0.919 | 0.937 | 0.0538 | 0.124 |
| Ours v15, step 225k | full 6,000 / 6,000 | 0.878 | 0.920 | 0.938 | 0.0536 | 0.124 |
| Ours v15, step 230k | first 500 / 6,000 | 0.869 | 0.912 | 0.932 | 0.0543 | 0.124 |
| Ours v15, step 230k | first 1,000 / 6,000 | 0.867 | 0.910 | 0.930 | 0.0552 | 0.127 |
| Ours v15, step 230k | first 1,500 / 6,000 | 0.867 | 0.911 | 0.930 | 0.0548 | 0.126 |
| Ours v15, step 230k | first 2,500 / 6,000 | 0.866 | 0.909 | 0.929 | 0.0558 | 0.127 |
| Ours v15, step 230k | first 3,500 / 6,000 | 0.865 | 0.908 | 0.928 | 0.0560 | 0.128 |
| Ours v15, step 230k | first 4,500 / 6,000 | 0.864 | 0.908 | 0.928 | 0.0562 | 0.129 |
| Ours v15, step 230k | first 5,500 / 6,000 | 0.864 | 0.908 | 0.928 | 0.0562 | 0.128 |
| Ours v15, step 230k | full 6,000 / 6,000 | 0.865 | 0.908 | 0.928 | 0.0561 | 0.128 |
| Ours v15, step 235k | first 500 / 6,000 | 0.864 | 0.910 | 0.929 | 0.0579 | 0.126 |
| Ours v15, step 235k | first 1,000 / 6,000 | 0.860 | 0.906 | 0.925 | 0.0591 | 0.129 |
| Ours v15, step 235k | first 1,500 / 6,000 | 0.860 | 0.907 | 0.926 | 0.0587 | 0.128 |
| Ours v15, step 235k | first 2,500 / 6,000 | 0.859 | 0.905 | 0.924 | 0.0599 | 0.129 |
| Ours v15, step 235k | first 3,000 / 6,000 | 0.858 | 0.904 | 0.924 | 0.0600 | 0.130 |
| Ours v15, step 235k | first 4,000 / 6,000 | 0.857 | 0.903 | 0.923 | 0.0602 | 0.131 |
| Ours v15, step 235k | first 5,500 / 6,000 | 0.857 | 0.904 | 0.923 | 0.0602 | 0.131 |
| Ours v15, step 235k | full 6,000 / 6,000 | 0.857 | 0.904 | 0.924 | 0.0600 | 0.131 |
| Ours v15, step 330k | full 6,000 / 6,000 | 0.877 | 0.922 | 0.941 | 0.0515 | 0.121 |

Interpretation:

- The intermediate checkpoint remains clearly above the physics-only focus baseline.
- The final 330k checkpoint is the best v15 continuation checkpoint by delta3, MAE, AbsRel, RMSE, and boundary MAE.
- Foreground delta1 is slightly lower at 330k than at 225k, so the improvement is not uniform across all metrics.
- The paper/poster now report the final 330k full-test row as `Ours`.

## Cross-Repo Artifacts

The project artifacts are now split across the public research-system repositories so the paper, figures, and presentation can be updated independently while keeping this research URL as the status anchor.

| Artifact | URL or path | Status |
| --- | --- | --- |
| Research status HTML | `https://donggeonbae.github.io/research/projects/lensless-depth-diffusion-final-model-status/` | Active canonical link; overwrite on every result update |
| Figure set HTML | `https://donggeonbae.github.io/figure/projects/lensless-depth-diffusion-figure-set/` | Files pushed to `main` and `gh-pages`; public Pages currently returns 404 |
| Presentation poster HTML | `https://donggeonbae.github.io/presentation/projects/lensless-depth-diffusion-poster/` | Active encrypted poster archive |
| Manuscript status HTML | `https://donggeonbae.github.io/writing/projects/lensless-depth-diffusion-manuscript-status/` | Active encrypted writing archive |
| Working paper PDF | `paper/main.pdf` in the training project | Updated to final v15 330k full-test metrics |
| Working poster PDF | `poster/poster.pdf` in the training project | Updated to final v15 330k full-test metrics |

Local `.env.local` files in the archive repos define `REPORT_PASSWORD=4716` and are intentionally untracked.

## Figure Evidence Notes

Current figure policy:

- Use mid/late deconvolution planes where focus behavior is visible.
- Avoid z=0 and z=7 in the deconvolution feature figure because those planes did not show useful focus behavior in current visual checks.
- Use clean result panels with RGB, GT depth, physics baseline, and Ours.
- Do not show teacher output as the primary qualitative result unless explicitly labeled as an upper-bound baseline.
- Architecture figure should show latent encoder/decoder, denoising UNet, PSF/deconvolution conditioning, and reverse-diffusion guidance.
- The figure repo now contains separate specs for architecture, deconvolution focus planes, and depth-result panels, following the local `templates/figure-spec.md` structure.
- The presentation repo now contains a poster planning/archive file following `templates/poster.md`, with background, method, result, speaker-script, and export-checklist sections.

## Open Questions

- Does 5-epoch continuation improve full-test depth metrics relative to the 195k checkpoint? Yes for delta2, delta3, MAE, AbsRel, RMSE, and boundary MAE; delta1 is slightly below the 225k checkpoint.
- Is the DAPS-lite posterior guidance improving the diffusion model beyond static deconvolution conditioning, or mostly improving methodological alignment and interpretability?
- Can per-depth Wiener parameter selection improve early/mid deconvolution planes without making late planes worse?
- Should the final paper report the supervised teacher only as an upper-bound baseline, or include it in the main comparison table with a clear `not Ours` label?

## Next Verification Steps

1. Final v15 checkpoint reached 330,000 steps.
2. Full 6,000-sample evaluation with 16 diffusion sampling steps completed.
3. The 330k checkpoint is selected as final `Ours`.
4. Paper table, poster table, and qualitative figures have been updated.
5. Final paper and poster PDFs have been rebuilt.
6. Remaining cleanup: final citation metadata review and optional vector redraw of the architecture figure.
