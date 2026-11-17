# GSS-FPM on multiple-scattering data: how the data were made and how heights are recovered

**Question.** GSS-FPM reconstructs a reflective surface's height from LED-array Fourier ptychographic images. Its forward model assumes *single reflection*: each small facet reflects once. Real light can scatter several times — between a wall and a floor, or through the 80 nm oxide film from one place to another. Does GSS-FPM still recover the height when the data contain this multiple scattering?

**Answer in one figure.** Figure 1 compares, on the same specimens, data made by a single-reflection model (F) with data made by a rigorous multiple-scattering solver (R). GSS-FPM beats phase retrieval (PR) on every set and on both kinds of data. Multiple scattering raises the GSS-FPM error 1.5× on 1D edges, 1.7× on non-periodic 2D specimens and 2.0× on dense 2D cells. On 1D edges no height lands on the wrong λ/2 branch. On 2D specimens with the film, wrong-branch errors appear (2 of 4 and 1 of 6 cases).

![Summary](assets/fig7_summary.png)

**Figure 1.** Geometric-mean height RMSE per specimen set, PR + unwrap (orange) versus GSS-FPM (blue). Left: single-reflection data (F). Right: multiple-scattering data (R). White numbers: cases with a branch error, meaning more than 1 % of the evaluated field is off by more than λ/4 = 117 nm. Source: `research/build_gss_fpm_multiscatter_report_20261117.py` (`fig_summary`). Artifact: `reports/gss_fpm_multiscatter_20261117/figures/fig7_summary.png`. Numbers: `reports/gss_fpm_multiscatter_20261117/numbers.json`.

| Set | Data | PR + unwrap (nm) | GSS-FPM (nm) | GSS-FPM R/F | Branch-error cases, PR / GSS-FPM |
|---|---|---:|---:|---:|---|
| D1: 1D edges, 24 cases, BF+DF | F | 14.5 | **4.08** | | 3 / 0 |
| | R | 11.1 | **6.17** | 1.51 | 3 / 0 |
| D2: dense 2D cells, 4 cases, BF+DF (descriptive) | F | 73.0 | **17.5** | | 3 / 0 |
| | R | 52.3 | **35.1** | 2.01 | 2 / 2 |
| v5: 2D phase-hard, 6 cases, BF only | F | 72.9 | **11.0** | | 5 / 0 |
| | R | 76.0 | **18.2** | 1.66 | 5 / 1 |

## 1. Two versions of the same data

Both data versions share everything except the scattering physics:

- **Optics:**
  - wavelength 470 nm;
  - objective NA 0.28;
  - 93 LEDs up to illumination NA 0.468 (29 bright-field, 64 dark-field), unpolarised;
  - 6.5 µm field on 10 × 10 camera pixels of 0.65 µm;
  - the same pupil, with its small defocus, astigmatism, coma and apodisation;
  - the same band-limited pixel integration.
- **Noise:** the same calibrated photon, read-noise and background model, with the same noise-draw rule.
- **LED split:** 85 LEDs for fitting and 8 held out.
- **Specimens:** silicon with a conformal 80 nm SiO$_2$ film. Heights reach 150–200 nm peak to valley, beyond λ/4 = 117 nm. Because the phase is $\phi = -4\pi h/\lambda$, the height is ambiguous by λ/2 = 235 nm.
  - **D1:** 12 y-invariant edge profiles (blocks, stairs, double blocks) plus their 12 x-invariant twins.
  - **D2:** four dense cells of period 1.625 µm tiled 4 × 4.
  - **v5:** six non-periodic phase-hard checkers and staircases.

![Forward models](assets/fig1_forward_models.png)

**Figure 2.** The same edge as seen by the two forward models.
- **(a) Single reflection (F data).** The surface is a staircase of flat 62.5 nm facets with vertical side walls. Each facet reflects once with the reflection coefficient $r(\theta)$ of a flat 80 nm SiO$_2$/Si stack, which already includes the bounces inside a *flat* film. Shadowing is applied, and the surface is integrated with the Kirchhoff method.
- **(b) Multiple scattering (R data).** A smooth 1.56 nm-sampled profile with a true conformal film, cut into 10 nm horizontal slices and solved with a vector Fourier modal method (FMM) that couples every diffraction order in every slice, for both polarisations.

Source: `research/build_gss_fpm_multiscatter_report_20261117.py` (`fig_forward_models`); geometry from `research/gss_fpm_rev_rigorous.py`. Artifact: `reports/gss_fpm_multiscatter_20261117/figures/fig1_forward_models.png`.

### How the multiple-scattering (R) data were computed

1. **Geometry.**
   - The surface $h(x,y)$ is sampled every 1.5625 nm.
   - The film is conformal: every point of the solid closer than $t = 80$ nm to the air is oxide. The Si top is therefore the erosion of $h$ by a hemisphere of radius $t$:
     $$s(\mathbf{x}) = \min_{|\mathbf{d}|\le t}\Big[h(\mathbf{x}+\mathbf{d}) - \sqrt{t^2-|\mathbf{d}|^2}\Big].$$
   - Unlike the facet model, the film is thinner measured vertically on steep walls, and it rounds the corners.
2. **Slices.**
   - Horizontal slices are cut at $z = k\cdot 10$ nm, anchored to $z=0$, plus every designed plateau level and its Si interface.
   - In each slice the permittivity is area-averaged on 6.25 nm pixels from the material at mid-height:
     $$\varepsilon = \varepsilon_{\mathrm{Si}}\,f_{\mathrm{Si}} + \varepsilon_{\mathrm{ox}}\,(f_{\mathrm{solid}}-f_{\mathrm{Si}}) + (1-f_{\mathrm{solid}}).$$
3. **Solver.**
   - We use FMMAX 1.7.1, a vector Fourier modal method also known as RCWA. The whole 6.5 µm field is treated as one period.
   - FMMAX's mode-direction rule can pick the wrong sign in lossless layers. We patch it at run time with our `signfix2` rule.
   - Settings per set:
     - **D1:** a 1D basis $|m|\le 157$ (315 orders) with the exact 1D Li factorisation.
     - **D2:** the FFT (Laurent) formulation with 793 orders on the 1.625 µm cell lattice.
     - **v5:** the FFT formulation with 1245 orders.
   - Each LED is solved for unit s- and p-polarised input. The output is the complex amplitude of every reflected order, referenced to $z=0$.
4. **Image formation (shared with the F data).**
   - Orders inside the objective NA pass the same pupil and are inverse-transformed to the camera plane.
   - The camera records $|E_x|^2+|E_y|^2$, averaged over s and p input (unpolarised LED, polarisation-blind camera).
   - The same path amplitudes, band-limited pixel integration and noise model then apply.
5. **Convergence.**
   - **D1 is converged.** The last order step changes images by 0.07–0.32 % (BF) and 0.29–0.79 % (DF). Halving the slice thickness changes them by 0.38 %, and FFT vs Li factorisation differ by 0.95 %.
   - **D2 is converged to a few per cent.** 793 vs 1800 orders differ by 2–4 % on the training cells, and the D2 dark-field reference is unresolved at the 2–3.5 % level.
   - **v5 is uncertain at the 10–25 % level** in bright field (two formulations disagree). It is used only as a BF reference.
   - D1 is therefore the clean multiple-scattering test, and D2 and v5 are supporting evidence.

![Images](assets/fig2_images.png)

**Figure 3.** Clean camera images of the same specimen and LED in both data versions. In D1, multiple scattering changes bright-field images little and dark-field images more. In D2 the differences are larger in both.

| Set | BF image difference ‖F−R‖/‖R‖ | DF image difference | DF brightness F/R |
|---|---:|---:|---:|
| D1 (24) | 3.9 % | 15.9 % | 1.10 |
| D2 (4) | 13.9 % | 25.8 % | 1.20 |
| v5 (6) | 11.6 % | — | — |

Values are the median over cases of the NRMSE pooled over the BF (or DF) LEDs. Source: `research/build_gss_fpm_multiscatter_report_20261117.py` (`fig_images`, `image_gap`). Artifact: `reports/gss_fpm_multiscatter_20261117/figures/fig2_images.png`.

## 2. Where the reflected light goes

![Light paths](assets/fig8_light_paths.jpg)

**Figure 4.** The reflected light on the D1 double-trench specimen. This is an independent 2D frequency-domain wave solution (FDFD, s-polarised) on the same geometry as the R data.
- **(a, c) Total field.** Above the surface the incident and reflected waves interfere. Light also enters the film and the silicon.
- **(b, d) Off-mirror light.** This is the reflected field minus a flat wafer's mirror wave: the beams the trench edges send off the mirror direction.
- **(a′, c′) Reflected power by outgoing direction.** At normal incidence (LED 0) 84 % of the reflected power enters the objective. At the dark-field LED 29 (NA 0.36) only 13 % does.
- **(e) Single-reflection picture.** Every mirror ray of LED 29 leaves at sin θ = 0.36 and misses the objective. In the facet model the dark-field image comes only from the diffraction of finite facets.

The FDFD order amplitudes match the FMM records of the R data within 1.9 % (LED 0) and 3.7 % (LED 29). A flat wafer matches the analytic Airy coefficient within 2 %. Source: `research/fdfd_d1_fieldmap.py`, `research/build_gss_fpm_multiscatter_report_20261117.py` (`fig_light_paths`). Artifacts: `reports/gss_fpm_multiscatter_20261117/figures/fig8_light_paths.png`, `.../fdfd_checks.json`.

![Multiple-scattering paths](assets/fig9_multiscatter_paths.jpg)

**Figure 5.** Multiple-scattering paths in a ray picture on the same geometry, at true aspect ratio. Rays split at every interface into reflected and refracted parts with s-polarised Fresnel powers. Rays that touch the surface only once, or only on one flat piece, are grey; this is what the facet model keeps. Rays that touch it at several places are magenta (orange where they enter the objective).

The paths it misses are:
- a slope reflection that hits the opposite wall or the floor;
- light that enters the film on a slope and leaves it elsewhere;
- light that crosses the trench floor inside the film.

The amounts of collected light, as a share of the incident light:
- At normal incidence the collected light is almost all single-contact: 22.7 % versus 0.24 %.
- At the dark-field LEDs, single-contact rays miss the objective: 0 % (LED 29) and 0.15 % (LED 61). Multiple-contact rays put 0.21 % and 0.27 % of the incident light into it.

The ray picture omits diffraction and adds powers incoherently. The 80 nm film is thinner than a wavelength, so the in-film zig-zag only means "light moves sideways inside the film". Figure 4 is the quantitative wave answer.

Source: `research/ray_paths_d1.py`, `research/build_gss_fpm_multiscatter_report_20261117.py` (`fig_ray_paths`). Artifacts: `reports/gss_fpm_multiscatter_20261117/figures/fig9_multiscatter_paths.png`, `.../ray_summaries.json`.

Together, Figures 3–5 show why the two data versions differ most in dark field and at edges. There, the collected light depends on paths the single-reflection model does not have.

## 3. How heights are recovered

![Pipeline](assets/fig3_pipeline.png)

**Figure 6.** GSS-FPM step by step on one D1 case with multiple-scattering data. Profiles are averaged along y. Source: `research/build_gss_fpm_multiscatter_report_20261117.py` (`fig_pipeline`), reading `runs/gss_fpm_edge_df_2026-11-17/inversion/F-all/`. Artifact: `reports/gss_fpm_multiscatter_20261117/figures/fig3_pipeline.png`.

1. **Phase retrieval (PR), also the baseline.**
   - One complex reflectance field on the 40 × 40 wave grid is fitted to all fit images through the known shifted pupil. The fit uses Wirtinger gradients with Adam from three starts, and the lowest FIT is kept.
   - The phase is unwrapped and converted by $h = -\lambda\phi/(4\pi)$, gauged to the frame and upsampled to the 104 grid.
   - PR is a thin-object model: no walls, no shadowing, no angle-dependent film response. In Figure 6 its spatial unwrap puts part of the field on the wrong λ/2 branch (RMSE 106 nm).
2. **Starts.** The PR phase fixes the height only modulo λ/2. Ten readings of it are kept as starts: nine wrap windows (`pr_w0`–`pr_w8`) and the spatial unwrap.
3. **Stage A (branch choice).**
   - From each start, a fast facet model is fitted for 200 cycles. It has no walls and no shadowing and uses a fused GPU kernel.
   - The representation is 32 × 32 overlapping Gaussian-weighted local planes, which form one 2.5D height field.
   - The two starts with the lowest own FIT are kept. The truth is never used; the numbers above the bars in Figure 6 are post-hoc.
4. **Stage B (accurate refinement).**
   - From each kept PR start, the accurate facet model (walls + hard shadowing) is rendered on the 208 data grid. It is fitted for 100 cycles with anisotropic TV 2.6.
   - The candidate with the lowest own FIT is the result.
5. **Loss.**
   - The loss is a background-aware Anscombe distance on absolute intensities, with no gain fit:
     $$\mathcal{L} = \tfrac12\,\mathrm{mean}\Big[\tfrac{4N}{c}\big(\sqrt{I_{\mathrm{pred}} + b/N + \epsilon} - \sqrt{I_{\mathrm{obs}} + \epsilon}\big)^2\Big],\qquad \epsilon = \frac{3/8+\sigma_r^2}{N}.$$
   - Here $N$ is the photon scale, $b$ the background, $\sigma_r$ the read noise and $c$ a fixed scale.

The pipeline is the frozen v2 (`models/surfelsplat_fpm_twostage_g208c0_20261115/`). **The inversion always uses the single-reflection facet model**, also on R data, so the R results measure the cost of model mismatch.

Gauge and frame rules:
- D1 and v5 use no gauge (flat frame at 0), as their evaluators do.
- D2 has no frame, because the cells fill the field. Its gauge is the full-field median of (recon − truth), applied the same way to every arm.

## 4. Results

![D1 3D](assets/fig4_d1_3d.jpg)

**Figure 7.** D1, three cases (worst, middle and best R/F). Columns: truth | PR (F) | GSS-FPM (F) | PR (R) | GSS-FPM (R). Error maps are clipped at ±20 nm. PR surfaces far off the truth are clipped in z ("z clipped"). Source: `research/gss_fpm_film2d_q3_figure.py`, PR heights from `research/gss_fpm_film2d_q3_pr_export.py`. Artifact: `runs/gss_fpm_film2d_2026-11-17/q3/q3_d1_pr_3d.png`.

**D1 (24 cases).**
- GSS-FPM height RMSE is 4.08 nm on F data and 6.17 nm on R data (R/F 1.51), with no branch error on either.
- The penalty sits at the edges:
  - edge band 8.9 → 13.8 nm;
  - plateaus 1.09 → 0.77 nm, i.e. not worse.
- Per case, R/F ranges from 0.72 to 3.41, and R is worse on 16 of 24 cases. By family, R/F is 1.18 for blocks, 2.20 for stairs and 1.34 for double blocks. The extra R error sits on the walls.
- PR is 14.5 / 11.1 nm with branch errors in 3 cases on each data version.

![D2 3D](assets/fig5_d2_3d.jpg)

**Figure 8.** D2 dense cells, central 2 × 2 tiles in 3D, full field in the error maps (±40 nm). Artifact: `runs/gss_fpm_film2d_2026-11-17/q3/q3_d2_pr_3d.png`.

**D2 (4 cells, descriptive).** Even on F data the pipeline does not reach the noise floor on these cells:
- the own FIT is 6–13× the noise floor and still falling at 100 cycles;
- edges come every 0.81 µm;
- the synthetic NA passes only about two harmonics of the 1.625 µm cell.

Absolute D2 accuracy is therefore not claimed; only the same-pipeline R/F ratio is reported.
- GSS-FPM is 17.5 → 35.1 nm (R/F 2.01).
- On R data, `cell_rounded` lands on the wrong λ/2 branch over about a third of the field (120.7 nm), and `cell_checker` over 2.2 % of it. `cell_offset` is unchanged (0.97).
- PR is 73.0 / 52.3 nm.

![v5 3D](assets/fig6_v5_3d.jpg)

**Figure 9.** v5 non-periodic specimens, BF-only arms, three cases. Artifact: `runs/gss_fpm_film2d_2026-11-17/q3/q3_v5_pr_3d.png`.

**v5 (6 cases, BF only).**
- GSS-FPM is 11.0 → 18.2 nm (R/F 1.66). The low blocks of the checkers come out systematically 20–40 nm too deep on R data.
- One case (`offset_checker_hard-02`) has a small branch error (1.1 % of the field).
- PR is 72.9 / 76.0 nm with branch errors in 5 of 6 cases on both.

## 5. What this means

- **GSS-FPM versus PR.** GSS-FPM wins on every set and on both data versions, by 1.5× (D2 R) to 6.7× (v5 F) in geometric-mean RMSE. PR fails mostly on the λ/2 branch; GSS-FPM's start-and-fit selection fixes that.
- **Multiple scattering costs 1.5–2×, mostly at edges.** On 1D edges GSS-FPM still reconstructs well from rigorous data: no branch errors, plateaus under 1 nm, edge band 13.8 nm.
- **2D with the film is not solved.** Wrong-branch errors appear on rigorous data (D2 2/4, v5 1/6). The 2D model gap is mostly the film: bare-wafer facet vs rigorous differs 9–12 %, with film 26–38 %. Zero-parameter local film corrections (vertical or conformal thickness, unpolarised r) did not close it (G1-D2 failed). The missing physics is non-local — light moving sideways through the film and between wall and floor, as in Figures 4 and 5.

**Caveats.**
- The case counts are small (24 / 4 / 6).
- D2 is descriptive, because the pipeline does not converge on these dense cells even with F data.
- The D2 and v5 rigorous references carry a few-per-cent (D2) to 10–25 % (v5 BF) uncertainty.
- v5 is BF only.
- The FDFD and ray pictures cover one D1 specimen in s-polarisation.

**Next.**
- A non-local film treatment in the forward model.
- Running other published reconstruction methods on the same data as further baselines (a survey is in progress).

## Reproduction

- Data, inversions and exports: `research/gss_fpm_q3.py`, `research/gss_fpm_q3_data.py`, `runs/gss_fpm_film2d_2026-11-17/q3/` (protocol `research/gss_fpm_film2d_protocol_2026-11-17.md`).
- Rigorous solver and specimens: `research/gss_fpm_rev_rigorous.py`, `research/slide470v5_rigorous.py`, `research/slide470v5_fmmax.py`.
- Report figures and numbers: `python research/build_gss_fpm_multiscatter_report_20261117.py`, which also calls `research/fdfd_d1_fieldmap.py` outputs and `research/ray_paths_d1.py`.
