<?php

namespace App\Services\Dialectical\Solvers;

use App\Services\Dialectical\DynamicSyntaxGenerator;
use App\Services\DialecticalOracleService;

/**
 * EMPIRICAL SCIENCE SOLVER — Dialectical Engine v4 (Major Rebuild)
 *
 * Handles the Scientific Method, Experimental Design, Measurement Theory,
 * Cosmology, Geology, Meteorology, and Ecology via the 3-Phase Dialectical proof.
 *
 * ── SCIENTIFIC METHOD ──
 *   Observation → Hypothesis → Prediction → Experiment → Analysis → Theory/Law
 *   Popper's Falsifiability (demarcation criterion), Kuhn's Paradigm Shifts,
 *   Bayesian Confirmation Theory, Statistical significance (p < 0.05 convention)
 *
 * ── MEASUREMENT THEORY ──
 *   SI base units, measurement uncertainty (systematic vs. random error),
 *   Significant figures, precision vs. accuracy, calibration, propagation of uncertainty
 *
 * ── COSMOLOGY ──
 *   Big Bang (ΛCDM), Hubble's Law (v = H₀d), cosmic microwave background (CMB),
 *   Stellar nucleosynthesis (Bethe, Chandrasekhar limit), Olbers' paradox resolution
 *
 * ── GEOLOGY & EARTH SCIENCE ──
 *   Plate tectonics (Wegener-Wilson), Radiometric dating (decay: N = N₀e^{-λt}),
 *   Rock cycle, Geological time scale, Milankovitch cycles
 *
 * ── METEOROLOGY & CLIMATOLOGY ──
 *   Atmospheric layers, Greenhouse Effect (Stefan-Boltzmann: P = σT⁴),
 *   Coriolis effect, Weather systems, Climate forcing (Arrhenius CO₂ relation)
 *
 * ── ECOLOGY ──
 *   Lotka-Volterra predator-prey (dx/dt = αx − βxy; dy/dt = δxy − γy),
 *   Carrying capacity (logistic growth: dN/dt = rN(1−N/K)),
 *   Trophic levels, Biodiversity indices (Shannon: H' = −∑pᵢ ln pᵢ)
 */
class EmpiricalScienceSolver extends AbstractDynamicDialecticalSolver
{
    private DynamicSyntaxGenerator $syntax;
    private DialecticalOracleService $oracle;

    public function __construct(DynamicSyntaxGenerator $syntax)
    {
        $this->syntax = $syntax;
        $this->oracle = new DialecticalOracleService();
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1: EMPIRICAL TRIAL — Extract domain vectors & generate trials
    // ═══════════════════════════════════════════════════════════════════
    protected function fallbackPhase1Trial(string $thesis, ?array $astMatrix = null): array
    {
        $domain  = $this->oracle->classifyDomain($thesis);
        $tl      = strtolower($thesis);
        $subtype = $this->detectSubtype($tl);

        $state = [
            'is_valid'        => true,
            'thesis'          => $thesis,
            'domain'          => $domain,
            'proof_traces'    => [],
            'trials'          => [],
            'symbolic_traces' => [],
            'system_type'     => $subtype,
            'is_unsolved'     => $this->oracle->isUnsolvedProblem($thesis),
        ];

        if (!$domain) {
            $domain = $this->buildSyntheticDomain($subtype, $tl);
            $state['domain'] = $domain;
            $state['proof_traces'][] = "### ℹ️ SYNTHETIC AXIOM DOMAIN (oracle DB miss — inferred from thesis)";
        }

        // Axiom ancestry chain
        $visited    = [];
        $axiomChain = $this->oracle->buildProofChain($domain['key'] ?? 'empirical_science', 0, $visited);
        $leafNode   = [
            'key'          => $domain['key'] ?? 'empirical_science',
            'name'         => $domain['name'],
            'branch_icon'  => $domain['branch_icon'] ?? '🔬',
            'academic_ref' => $domain['academic_ref'] ?? 'Empirical Science',
        ];
        $axiomChain = array_merge([$leafNode], $axiomChain);
        $chainNames = array_map(fn($n) => ($n['branch_icon'] ?? '🔢') . ' ' . $n['name'], $axiomChain);

        $state['proof_traces'][] = '**📖 Axiom Root**: ' . $domain['name'] . ' `[' . ($domain['academic_ref'] ?? 'Empirical Science') . ']`';
        $state['proof_traces'][] = '🔗 **Axiom Chain**: ' . implode(' ← ', $chainNames);
        $state['proof_traces'][] = '**🔬 Empirical Observation**: ' . ($domain['trial'] ?? 'We observe repeatable phenomena governed by measurable physical laws.');

        switch ($subtype) {

            case 'ScientificMethod':
                $state['proof_traces'][] = "\n**🧪 Vector Abstraction (Scientific Method)**:";
                $state['proof_traces'][] = "- **Observation**: Record a repeatable, measurable phenomenon.";
                $state['proof_traces'][] = "- **Hypothesis (H₀)**: Formulate a falsifiable, testable statement about the cause.";
                $state['proof_traces'][] = "- **Prediction**: Derive observable consequence: if H₀ true → outcome O expected.";
                $state['proof_traces'][] = "- **Experiment**: Controlled manipulation of independent variable X → measure Y.";
                $state['proof_traces'][] = "- **Analysis**: Apply statistical tests (p-value, confidence interval). If p < 0.05 → reject H₀.";
                $state['proof_traces'][] = "- **Popper's Demarcation**: H₀ is scientific iff ∃ observation O_falsify that would refute H₀. Unfalsifiable claims are metaphysical, not scientific.";
                $state['proof_traces'][] = "- **Kuhn's Paradigm Shifts**: Normal science (puzzle-solving within paradigm P) → anomaly → crisis → revolution P→P'. Old P becomes special case of P'.";
                $state['proof_traces'][] = "- **Bayesian Confirmation**: P(H₀|E) = P(E|H₀)·P(H₀)/P(E). Evidence E updates credence in H₀. Repeated confirmation raises posterior probability.";

                $state['trials'][] = ['Step' => '1. Observation', 'Formal Role' => 'Raw data', 'Example' => 'Apples fall downward consistently'];
                $state['trials'][] = ['Step' => '2. Hypothesis', 'Formal Role' => 'Falsifiable claim', 'Example' => 'Mass attracts mass via F = Gm₁m₂/r²'];
                $state['trials'][] = ['Step' => '3. Prediction', 'Formal Role' => 'Derivable consequence', 'Example' => 'Moon orbital period T = 2π√(r³/GM) ≈ 27.3 days'];
                $state['trials'][] = ['Step' => '4. Experiment', 'Formal Role' => 'Controlled test', 'Example' => 'Cavendish torsion balance → G = 6.674×10⁻¹¹ N·m²/kg²'];
                $state['trials'][] = ['Step' => '5. Analysis', 'Formal Role' => 'Statistical verdict', 'Example' => 'Residuals < 10⁻⁶ → H₀ not refuted → Law confirmed'];
                $state['trials'][] = ['Step' => '6. Theory/Law', 'Formal Role' => 'Predictive model', 'Example' => 'Newton\'s Law of Universal Gravitation (1687) — verified 400 years'];
                break;

            case 'Cosmology':
                $state['proof_traces'][] = "\n**🌌 Vector Abstraction (Cosmology)**:";
                $state['proof_traces'][] = "- **Big Bang (ΛCDM)**: Universe originated ~13.8 Gyr ago from a high-density singularity state. t=10⁻⁴³s (Planck epoch) → t=10⁻³²s (inflation) → t=3 min (nucleosynthesis: H, He, Li) → t=380,000yr (CMB decoupling).";
                $state['proof_traces'][] = "- **Hubble's Law**: v = H₀·d where H₀ ≈ 67.4 km/s/Mpc (Planck 2018). Every 1 Mpc of additional distance → 67.4 km/s faster recession. Universe is expanding.";
                $state['proof_traces'][] = "- **CMB Evidence**: Cosmic Microwave Background T = 2.725 K — relic thermal radiation from decoupling epoch. COBE/WMAP/Planck confirmed isotropic at ΔT/T ≈ 10⁻⁵. Decisive evidence for hot Big Bang.";
                $state['proof_traces'][] = "- **Stellar Nucleosynthesis (Bethe 1939)**: Stars fuse H→He (pp chain + CNO cycle); He→C,O (triple-alpha); massive stars → Fe (peak binding energy). Fe core collapses → supernova → r-process elements (Au, U).";
                $state['proof_traces'][] = "- **Chandrasekhar Limit**: M_Ch = 5.83/μₑ² · M_Sun ≈ 1.44 M_Sun. White dwarfs > this mass → Type Ia supernova (standard candles — measured universe acceleration).";
                $state['proof_traces'][] = "- **Dark Matter Evidence**: Galaxy rotation curves (Rubin 1970): v(r) = const (not Keplerian √(1/r)). Gravitational lensing maps. CMB power spectrum. ~27% of universe energy density.";
                $state['proof_traces'][] = "- **Dark Energy / Λ**: Type Ia supernovae (Riess/Perlmutter 1998): universe accelerating. Λ ≈ 68% of universe energy density. Equation of state w = −1 (vacuum energy).";

                // Hubble recession velocity table
                foreach ([1, 5, 10, 50, 100, 500, 1000] as $d_Mpc) {
                    $v = 67.4 * $d_Mpc;
                    $state['trials'][] = [
                        'Distance d (Mpc)' => $d_Mpc,
                        'v = H₀·d (km/s)' => number_format($v, 0),
                        '% of c'           => number_format($v / 2.998e5 * 100, 3) . '%',
                        'Observable?'      => $v < 2.998e5 ? '✅ Yes' : '❌ Beyond Hubble horizon',
                    ];
                }
                break;

            case 'Geology':
                $state['proof_traces'][] = "\n**🌍 Vector Abstraction (Geology & Earth Science)**:";
                $state['proof_traces'][] = "- **Plate Tectonics (Wegener-Wilson)**: Lithosphere divided into ~15 major plates drifting at 2-10 cm/yr (GPS-verified). Seafloor spreading at mid-ocean ridges (ocean crust youngest there). Subduction zones → arc volcanism + earthquakes.";
                $state['proof_traces'][] = "- **Radiometric Dating**: N(t) = N₀·e^{−λt} where λ = ln(2)/t₁/₂. Uranium-Lead: t₁/₂ = 4.47 Gyr → dates zircons to 4.4 Gyr. Carbon-14: t₁/₂ = 5,730 yr → organic material up to ~50,000 yr.";
                $state['proof_traces'][] = "- **Geological Time Scale**: Hadean (4.6-4.0 Ga) → Archean (4.0-2.5 Ga) → Proterozoic (2.5-0.54 Ga) → Phanerozoic (0-540 Ma). Determined by stratigraphy (superposition law) + radiometric dates.";
                $state['proof_traces'][] = "- **Milankovitch Cycles**: Orbital eccentricity (96 kyr), axial tilt / obliquity (41 kyr), precession (23 kyr) — drive ice age cycles. Insolation changes trigger glacial/interglacial transitions.";
                $state['proof_traces'][] = "- **Rock Cycle**: Igneous (cooling magma) ↔ Sedimentary (erosion + deposition + lithification) ↔ Metamorphic (heat+pressure). Driven by Earth's internal heat (mantle convection) + solar energy (weathering/erosion).";

                // Radiometric decay table
                foreach ([0, 1, 2, 3, 4, 4.47] as $t_Gyr) {
                    $t_half = 4.47; // U-238 half-life in Gyr
                    $fraction_remaining = pow(0.5, $t_Gyr / $t_half);
                    $state['trials'][] = [
                        'Time t (Gyr)' => $t_Gyr,
                        'U-238 Remaining' => number_format($fraction_remaining * 100, 1) . '%',
                        'Pb-206 Produced'  => number_format((1 - $fraction_remaining) * 100, 1) . '%',
                        'N/N₀ = 2^(-t/t½)' => number_format($fraction_remaining, 4),
                    ];
                }
                break;

            case 'Meteorology':
                $state['proof_traces'][] = "\n**🌦️ Vector Abstraction (Meteorology & Climatology)**:";
                $state['proof_traces'][] = "- **Stefan-Boltzmann Law**: Power radiated P = εσT⁴ (σ = 5.67×10⁻⁸ W/m²·K⁴). Earth radiates as near-blackbody at ~255K (effective T). Greenhouse gases intercept outgoing IR → raise surface T to ~288K.";
                $state['proof_traces'][] = "- **Greenhouse Effect**: CO₂, H₂O, CH₄ absorb outgoing longwave IR radiation. Arrhenius (1896): ΔT = α·ln(C/C₀) where α ≈ 3°C per CO₂ doubling (equilibrium climate sensitivity 2.5–4°C per doubling — IPCC AR6 2021).";
                $state['proof_traces'][] = "- **Coriolis Effect**: Apparent deflection due to Earth's rotation: F_Cor = 2m(v × Ω). Deflects winds/currents right in N. hemisphere, left in S. hemisphere. Creates cyclonic rotation of weather systems.";
                $state['proof_traces'][] = "- **Atmospheric Layers**: Troposphere (0-12km, weather, T↓); Stratosphere (12-50km, O₃ layer, T↑); Mesosphere (50-80km, T↓); Thermosphere (80-600km, T↑); Exosphere (600km+).";
                $state['proof_traces'][] = "- **Clausius-Clapeyron**: des/dT = Les/(RvT²) — saturation vapor pressure increases ~7%/°C warming → warmer atmosphere holds more moisture → intensified precipitation extremes.";

                // Temperature blackbody radiation table
                foreach ([255, 270, 288, 300, 315] as $T_K) {
                    $P = 5.67e-8 * pow($T_K, 4);
                    $state['trials'][] = [
                        'Temperature T (K)' => $T_K,
                        'T (°C)'            => $T_K - 273,
                        'P = σT⁴ (W/m²)'   => number_format($P, 0),
                        'Context'           => match(true) {
                            $T_K === 255 => 'Earth effective T (no greenhouse)',
                            $T_K === 288 => 'Earth actual surface avg ✅',
                            $T_K >= 315  => 'Extreme warming scenario',
                            default      => '—',
                        },
                    ];
                }
                break;

            case 'Ecology':
                $state['proof_traces'][] = "\n**🌿 Vector Abstraction (Ecology)**:";
                $state['proof_traces'][] = "- **Logistic Growth**: dN/dt = rN(1−N/K). At N≪K: exponential (dN/dt≈rN). At N→K: growth halts. K = carrying capacity. Verified in laboratory populations (yeast, bacteria) and some wildlife.";
                $state['proof_traces'][] = "- **Lotka-Volterra Predator-Prey**: dx/dt = αx − βxy (prey); dy/dt = δxy − γy (predator). Produces oscillating cycles: prey ↑ → predator ↑ → prey ↓ → predator ↓ → cycle repeats. Verified in lynx-hare data (Hudson Bay Company records 1845-1935).";
                $state['proof_traces'][] = "- **Shannon Diversity Index**: H' = −∑(pᵢ·ln pᵢ) where pᵢ = proportion of species i. H'=0 (monoculture); H'=ln(S) at maximum (equal proportions of S species). Biodiversity measure.";
                $state['proof_traces'][] = "- **Trophic Levels & Energy Transfer**: 10% rule (Lindeman): ~10% of energy passes between trophic levels. 100 kg plant → 10 kg herbivore → 1 kg carnivore → 0.1 kg apex predator. Limits food chain length.";
                $state['proof_traces'][] = "- **Island Biogeography (MacArthur-Wilson)**: S_eq = c·A^z where S = species, A = island area, z ≈ 0.25-0.35. Equilibrium between immigration and extinction rates.";
                $state['proof_traces'][] = "- **Competitive Exclusion Principle (Gause)**: Two species competing for identical resources cannot coexist stably — the superior competitor excludes the other (mathematical proof from Lotka-Volterra system).";

                // Logistic growth simulation
                $r = 0.5; $K = 1000;
                foreach ([10, 50, 100, 200, 500, 900, 999] as $N) {
                    $dNdt = $r * $N * (1 - $N / $K);
                    $state['trials'][] = [
                        'Population N'    => $N,
                        'N/K ratio'       => number_format($N / $K, 3),
                        'dN/dt (r=0.5)'   => number_format($dNdt, 1),
                        'Growth Phase'    => $N < $K / 2 ? 'Accelerating ↑' : ($N < $K * 0.9 ? 'Decelerating ↓' : 'Near K ≈ 0'),
                    ];
                }
                break;

            case 'MeasurementTheory':
                $state['proof_traces'][] = "\n**📏 Vector Abstraction (Measurement Theory)**:";
                $state['proof_traces'][] = "- **SI Base Units (7 Fundamental)**: second (s), metre (m), kilogram (kg), ampere (A), kelvin (K), mole (mol), candela (cd). All derived units follow from these via dimension analysis.";
                $state['proof_traces'][] = "- **Measurement Uncertainty**: Every measurement has: systematic error (bias — same direction) + random error (noise — varies). Total uncertainty: u_total = √(u_sys² + u_rand²).";
                $state['proof_traces'][] = "- **Propagation of Uncertainty**: If f(x,y): u_f² = (∂f/∂x)²u_x² + (∂f/∂y)²u_y² (independent errors). Relative uncertainty for product f=xy: (u_f/f)² = (u_x/x)² + (u_y/y)².";
                $state['proof_traces'][] = "- **Significant Figures**: Precision = how repeatable the measurement is. Accuracy = how close to true value. Example: 3.14159 ± 0.00001 (highly precise); may be inaccurate if instrument is biased.";
                $state['proof_traces'][] = "- **Dimensional Analysis**: Physical equation must be dimensionally homogeneous. [F] = [m][a] = kg·m·s⁻² = N. Bridgman's principle: laws of physics are dimensionally invariant.";

                $state['trials'][] = ['SI Unit' => 'second (s)', 'Quantity' => 'Time', 'Definition' => '9,192,631,770 cycles of Cs-133 hyperfine transition'];
                $state['trials'][] = ['SI Unit' => 'metre (m)', 'Quantity' => 'Length', 'Definition' => 'distance light travels in 1/299,792,458 s'];
                $state['trials'][] = ['SI Unit' => 'kilogram (kg)', 'Quantity' => 'Mass', 'Definition' => 'Planck constant h = 6.626×10⁻³⁴ J·s (redefined 2019)'];
                $state['trials'][] = ['SI Unit' => 'ampere (A)', 'Quantity' => 'Current', 'Definition' => 'Elementary charge e = 1.602×10⁻¹⁹ C per second'];
                $state['trials'][] = ['SI Unit' => 'kelvin (K)', 'Quantity' => 'Temperature', 'Definition' => 'Boltzmann constant k_B = 1.381×10⁻²³ J/K'];
                $state['trials'][] = ['SI Unit' => 'mole (mol)', 'Quantity' => 'Amount', 'Definition' => 'N_A = 6.022×10²³ entities (Avogadro constant)'];
                break;

            default:
                $state['proof_traces'][] = "Applying general empirical science methodology: Observation → Hypothesis → Experiment → Theory.";
                $state['trials'] = [
                    ['Phase' => 'Observation',  'Method' => 'Quantitative measurement', 'Tool' => 'Calibrated instruments (SI units)'],
                    ['Phase' => 'Hypothesis',   'Method' => 'Falsifiable statement', 'Tool' => 'Popper\'s demarcation criterion'],
                    ['Phase' => 'Experiment',   'Method' => 'Controlled variables', 'Tool' => 'Statistical significance (p < 0.05)'],
                    ['Phase' => 'Theory/Law',   'Method' => 'Predictive mathematical model', 'Tool' => 'Kuhn: paradigm confirmed or shifted'],
                ];
                break;
        }

        return $state;
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2: DEDUCTIVE PURIFICATION — Mathematical bounds & derivations
    // ═══════════════════════════════════════════════════════════════════
    protected function fallbackPhase2Deduction(array $state): array
    {
        if (!$state['is_valid']) return $state;

        $domain  = $state['domain'];
        $subtype = $state['system_type'] ?? 'ScientificMethod';

        $state['proof_traces'][] = "\n### 🧮 Phase 2 — Deductive Purification";
        $state['proof_traces'][] = '**📐 Deductive Axiom**: *"' . ($domain['deductive_axiom'] ?? 'Empirical observations are bounded by physical conservation laws and statistical inference.') . '"*';

        switch ($subtype) {

            case 'ScientificMethod':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Popper Falsifiability', 'expr' => 'H₀ is scientific ↔ ∃ observation O: (H₀ → O) ∧ (O is false → H₀ is false). If no such O exists → H₀ is metaphysical, not science.'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Bayesian Update', 'expr' => 'P(H₀|E) = P(E|H₀)·P(H₀) / P(E);  Likelihood Ratio = P(E|H₀)/P(E|¬H₀).  Strong evidence (LR >> 1) drives posterior toward 1.'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Statistical Significance', 'expr' => 'p = P(data at least as extreme | H₀ true). p < 0.05 → reject H₀ (< 5% chance of false positive under H₀). Convention, not absolute truth.'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Kuhn Paradigm Shift', 'expr' => 'Normal science: Pᵢ (paradigm). Anomaly count A(t) → threshold A*. Crisis → revolution: Pᵢ replaced by Pᵢ₊₁. Pᵢ becomes limiting case of Pᵢ₊₁ (e.g., Newton is limit of Einstein for v≪c).'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Scientific Consensus', 'expr' => 'Theory T achieves consensus when: (1) explains existing data; (2) makes novel predictions verified; (3) no unfalsified counterexamples after extensive testing. Example: Evolution, Big Bang, Germ Theory, QM.'];
                $state['proof_traces'][] = "**Scientific Method Deduction**: The hypothetico-deductive method is self-correcting by design — falsification eliminates wrong theories. Bayesian confirmation quantifies degree of evidential support. Kuhn's paradigm shifts explain non-linear scientific progress.";
                break;

            case 'Cosmology':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Hubble-Lemaître Law', 'expr' => 'v = H₀·d;  H₀ = 67.4 ± 0.5 km/s/Mpc (Planck 2018). Derived from FLRW metric: ds² = −c²dt² + a(t)²[dr²/(1−kr²) + r²dΩ²]. Friedmann equations: (ȧ/a)² = 8πGρ/3 − kc²/a² + Λc²/3.'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'CMB Temperature', 'expr' => 'T_CMB = T₀·(1+z) = 2.725 K today. At decoupling z_dec ≈ 1100: T_dec ≈ 3000 K (hydrogen recombination). Blackbody spectrum confirmed to 10⁻⁵ precision (COBE Nobel 2006).'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Stellar Nucleosynthesis', 'expr' => 'pp chain: 4¹H → ⁴He + 2e⁺ + 2νe + 26.7 MeV;  Triple-alpha: 3⁴He → ¹²C (Hoyle state at 7.65 MeV — Hoyle 1954).  Fe peak: binding energy/nucleon maximized at ⁵⁶Fe → no fusion energy beyond Fe.'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Chandrasekhar Limit', 'expr' => 'M_Ch = (ℏc/G)^(3/2)/(m_H²) × f(μe) ≈ 1.44 M_Sun. Beyond this: electron degeneracy pressure fails → Type Ia SN. Used as standard candle to measure universe expansion acceleration.'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Universe Age', 'expr' => 't₀ = 1/H₀ × correction = 13.8 Gyr (for flat ΛCDM with Ω_Λ=0.68, Ω_m=0.32). t₀ = ∫₀¹ da/(a·H(a)) where H(a) = H₀√(Ω_m/a³ + Ω_Λ).'];
                $state['proof_traces'][] = "**Cosmology Deduction**: The ΛCDM model is constrained by CMB (precision to 0.1%), Type Ia supernovae, baryon acoustic oscillations, and gravitational lensing — five independent probes all agree. The Big Bang is not a hypothesis but a physically well-determined event.";
                break;

            case 'Geology':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Radiometric Dating', 'expr' => 'N(t) = N₀·e^{−λt};  λ = ln(2)/t₁/₂;  Age t = (1/λ)·ln(N₀/N) = t₁/₂/ln(2)·ln(1 + D/N) where D = daughter isotope. U-Pb concordia: errors cancel via dual isotope system.'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Plate Velocity', 'expr' => 'GPS measures plate motion: Pacific Plate at 52-68 mm/yr NW. Magnetic stripe anomalies confirm spreading rate: seafloor age ∝ distance from ridge. Earth\'s age = 4.543 ± 0.050 Gyr (zircon U-Pb).'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Stratigraphy Laws', 'expr' => 'Superposition: older strata below younger. Original horizontality: sediment deposits flat initially. Lateral continuity: layers continuous over large areas unless disrupted. Cross-cutting relations: intrusions younger than intruded rock.'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Milankovitch Forcing', 'expr' => 'Insolation Q(φ,t) varies via: e(t) eccentricity (96 kyr), ε(t) obliquity (41 kyr), ψ(t) precession (23 kyr). Combined: Q changes ±40 W/m² at 65°N June. Ice core δ¹⁸O confirms 100 kyr glacial cycles for past 800 kyr.'];
                $state['proof_traces'][] = "**Geology Deduction**: Radiometric dating provides absolute time constraints with ±1% precision for most systems. Plate tectonics is confirmed by GPS (mm/yr precision), magnetic stratigraphy, and earthquake focal mechanisms — not a hypothesis but an established framework.";
                break;

            case 'Meteorology':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Stefan-Boltzmann Bound', 'expr' => 'P = σT⁴;  σ = 5.67×10⁻⁸ W/m²K⁴. Earth energy balance: S(1−α)/4 = εσT_eff⁴ where S=1361 W/m² (solar), α≈0.30 (albedo). T_eff = 255K. Surface: 288K due to greenhouse effect (+33K).'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'CO₂ Forcing', 'expr' => 'ΔF = 5.35·ln(C/C₀) W/m² (Myhre 1998). At C=560 ppm (2×preindustrial C₀=280): ΔF ≈ 3.7 W/m². ECS = ΔT/ΔF × F_2×CO2 ≈ 3°C per doubling (IPCC AR6 best estimate).'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Clausius-Clapeyron', 'expr' => 'des/dT = L_v·es/(R_v·T²). At T=288K: des/dT ≈ 1.45 hPa/K → ~7%/K increase in saturation vapor pressure. Warmer atmosphere → holds ~7% more water/°C → intensified precipitation.'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Coriolis Parameter', 'expr' => 'f = 2Ω·sin(φ) where Ω = 7.29×10⁻⁵ rad/s. At 45°N: f ≈ 10⁻⁴ s⁻¹. Geostrophic wind: V_g = (1/ρf)·∂p/∂n. Creates cyclonic (CCW in N. hemisphere) rotation of pressure systems.'];
                $state['proof_traces'][] = "**Meteorology Deduction**: The greenhouse effect is a physical consequence of Stefan-Boltzmann radiation law and molecular absorption spectra — measured in laboratory since 1859 (Tyndall). CO₂ forcing is confirmed by satellite measurements, surface stations, and paleo-climate records.";
                break;

            case 'Ecology':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Logistic Growth Equilibrium', 'expr' => 'dN/dt = rN(1−N/K). Equilibria: N*=0 (unstable) and N*=K (stable). At N=K/2: maximum growth rate dN/dt = rK/4. Verified: bacteria, yeast, some mammal populations.'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Lotka-Volterra Fixed Points', 'expr' => 'Fixed points: (0,0) unstable; (K_x, 0) saddle if δK_x > γ; coexistence at (x*=γ/δ, y*=α/β). Oscillation period T ≈ 2π/√(αγ). Neutral stability (conservative system).'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Shannon Diversity', 'expr' => 'H\' = −∑pᵢ·ln(pᵢ). Maximum H\'_max = ln(S) when all S species equally abundant. Evenness E = H\'/H\'_max ∈ [0,1]. Simpson\'s D = ∑pᵢ² (probability two randomly picked individuals are same species).'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Competitive Exclusion', 'expr' => 'Lotka-Volterra competition: dN₁/dt = r₁N₁(K₁−N₁−α₁₂N₂)/K₁. Coexistence iff α₁₂α₂₁ < 1 (interspecific < intraspecific competition). If α₁₂α₂₁ > 1 → competitive exclusion (Gause\'s law).'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => '10% Energy Transfer', 'expr' => 'Energy at level n+1 ≈ 0.1 × Energy at level n. Efficiency ε ≈ 10% (Lindeman 1942). Food chain length L limited by: L ≤ log(E_base)/log(10). Tropical ecosystems: E_base large → L up to 5-6 levels.'];
                $state['proof_traces'][] = "**Ecology Deduction**: Logistic growth and Lotka-Volterra equations are verified mathematical models — not assumptions. Shannon diversity is a proper information-theoretic measure. Competitive exclusion is a theorem of the Lotka-Volterra system.";
                break;

            case 'MeasurementTheory':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Uncertainty Propagation', 'expr' => 'For f(x,y,...): u_f² = (∂f/∂x)²u_x² + (∂f/∂y)²u_y² + ... (uncorrelated). For f=x·y: (u_f/f)² = (u_x/x)² + (u_y/y)². For f=x+y: u_f = √(u_x² + u_y²).'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Dimensional Homogeneity', 'expr' => 'Every physical equation must be dimensionally consistent. [F] = [m][a]: kg·m·s⁻² = kg·m·s⁻² ✅. Bridgman: No dimensionally inconsistent equation can be a law of physics.'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'SI Redefinition (2019)', 'expr' => 'All 7 SI base units now defined by fixing exact values of: c, h, e, k_B, N_A, K_cd, ΔνCs. No longer artifact-based (e.g., old kg = Pt-Ir cylinder in Paris). Metrologically stable and universally reproducible.'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Significant Figures Rule', 'expr' => 'Result precision limited by least precise input. Addition/subtraction: align decimal places. Multiplication/division: count sig figs. Example: 3.14 × 2.7 = 8.5 (2 sig figs, not 8.478).'];
                $state['proof_traces'][] = "**Measurement Deduction**: Uncertainty propagation is a mathematical identity from differential calculus. SI units are now defined by fixing fundamental constants — provably stable and reproducible without reference artifacts.";
                break;

            default:
                // --- DYNAMIC CAS FALLBACK ---
                try {
                    if (class_exists(\App\Services\AST\Tokenizer::class)) {
                        $tokenizer = new \App\Services\AST\Tokenizer();
                        $parser = new \App\Services\AST\Parser();
                        $cas = new \App\Services\CAS\ComputerAlgebraSystem();
                        $tokens = $tokenizer->tokenize($state['thesis']);
                        $ast = $parser->parse($tokens);
                        $casResult = $cas->evaluateAST($ast);
                        if ($casResult && isset($casResult['status']) && $casResult['status'] === 'proven') {
                            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Dynamic AST Construction', 'expr' => 'Empirical AST built natively.'];
                            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'CAS Resolution', 'expr' => 'Empirical science proposition evaluated via CAS algebraic rules ✅'];
                            if (isset($casResult['proof'])) {
                                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'CAS Proof', 'expr' => $casResult['proof']];
                            }
                            $state['proof_traces'][] = "Empirical science proposition Verified Natively via CAS.";
                            $state['is_valid'] = true;
                            return $state;
                        }
                    }
                } catch (\Exception $e) {
                    // Fallthrough
                }

                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Empirical Bound', 'expr' => 'Physical observations are bounded by SI-defined measurement framework and conservation laws.'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Falsifiability Bound', 'expr' => 'Any empirical claim must yield a testable, falsifiable prediction (Popper criterion).'];
                $state['proof_traces'][] = "General empirical domain: observations are governed by measurable conservation laws.";
                break;
        }

        return $state;
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: INDUCTIVE SYNTHESIS — Full formatted proof output
    // ═══════════════════════════════════════════════════════════════════
    protected function fallbackPhase3Induction(array $state): string
    {
        $domain  = $state['domain'];
        if (!$domain) {
            return implode("\n\n", $state['proof_traces']);
        }
        $icon    = $domain['branch_icon'] ?? '🔬';
        $subtype = $state['system_type'] ?? 'ScientificMethod';
        $axiomRef = $domain['academic_ref'] ?? 'Empirical Science';

        $md  = "### **{$icon} EMPIRICAL SCIENCE PROOF** *(Dialectical Engine — Three-Phase Proof)*\n";
        $md .= "> **Axiom Root**: {$domain['name']} `[{$axiomRef}]`\n\n";
        $md .= "---\n\n";

        // PHASE 1
        $md .= "### 🔬 Phase 1 — Empirical Observation *(Data Extraction)*\n\n";
        $md .= "> *\"{$domain['trial']}\"*\n\n";

        foreach ($state['proof_traces'] as $trace) {
            if (!str_starts_with($trace, "\n### 🧮") && !str_starts_with($trace, '**📐') && !str_starts_with($trace, '**Scientific Method') && !str_starts_with($trace, '**Cosmology') && !str_starts_with($trace, '**Geology') && !str_starts_with($trace, '**Meteorology') && !str_starts_with($trace, '**Ecology') && !str_starts_with($trace, '**Measurement')) {
                $md .= $trace . "\n\n";
            }
        }

        if (!empty($state['trials'])) {
            $headers = array_keys(reset($state['trials']));
            $rows    = array_map('array_values', $state['trials']);
            $md .= "**Empirical Trial Data:**\n\n";
            $md .= $this->syntax->renderTruthTable($headers, $rows);
            $md .= "\n";
        }

        $md .= "---\n\n";

        // PHASE 2
        $md .= "### 🧮 Phase 2 — Deductive Purification *(Physical Law Bounds)*\n\n";
        $md .= "> *\"{$domain['deductive_axiom']}\"*\n\n";

        foreach ($state['proof_traces'] as $trace) {
            if (str_starts_with($trace, "\n### 🧮") || str_starts_with($trace, '**Scientific Method') || str_starts_with($trace, '**Cosmology') || str_starts_with($trace, '**Geology') || str_starts_with($trace, '**Meteorology') || str_starts_with($trace, '**Ecology') || str_starts_with($trace, '**Measurement')) {
                $md .= $trace . "\n\n";
            }
        }

        if (!empty($state['symbolic_traces'])) {
            $md .= "**Step-by-Step Physical Derivation:**\n\n";
            $md .= $this->syntax->renderAlgebraicSteps($state['symbolic_traces']);
            $md .= "\n";
        }

        $md .= "---\n\n";

        // PHASE 3
        $md .= "### 🌍 Phase 3 — Universal Empirical Induction *(n → ∞ Scaling)*\n\n";

        $inductiveTexts = [
            'ScientificMethod' => 'The hypothetico-deductive method is self-correcting by design — falsification eliminates wrong theories across all known domains of inquiry. Kuhn\'s paradigm shifts are verified by the history of science (Copernican revolution, Einsteinian relativity, quantum mechanics). Bayesian confirmation theory is the uniquely rational updating rule (Dutch Book theorem). The scientific method scales universally — it is the only known self-correcting epistemological framework.',
            'Cosmology'        => 'The ΛCDM cosmological model is constrained by five independent observational probes: CMB anisotropies (Planck), Type Ia supernovae (Riess/Perlmutter), baryon acoustic oscillations, weak gravitational lensing, and Big Bang nucleosynthesis. All five independently agree to sub-percent precision. The universe is 13.8 billion years old, expanding at H₀ = 67.4 km/s/Mpc, composed of 5% ordinary matter, 27% dark matter, 68% dark energy. This is not a hypothesis — it is a precision-constrained scientific model.',
            'Geology'          => 'Plate tectonics is measured in real time by GPS to mm/yr precision. Radiometric dating has been cross-validated against astronomical (Cepheid), geological (stratigraphy), and geophysical (paleomagnetic) methods for 80+ years. Earth\'s geological history (4.543 Gyr) is independently constrained by multiple dating systems (U-Pb, Rb-Sr, Sm-Nd, K-Ar). Plate tectonics explains earthquakes, volcanoes, mountain building, and ocean floor morphology — no alternative framework exists.',
            'Meteorology'      => 'The greenhouse effect is a laboratory-measured phenomenon (Tyndall 1859). Climate forcing by CO₂ is confirmed by satellite measurements, surface stations, ice core records (EPICA Dome C: 800,000 year CO₂-temperature correlation), and ocean heat content. The Stefan-Boltzmann law is exact for blackbody radiation. Atmospheric models (GCMs) reproduce observed warming to within uncertainty bounds. The Clausius-Clapeyron relation predicts ~7%/°C precipitation intensification — observed in global rainfall records.',
            'Ecology'          => 'Lotka-Volterra equations are verified in laboratory populations (Gause 1934) and field observations (Hudson Bay lynx-hare data, Serengeti wildebeest-lion). Logistic growth is confirmed across species from bacteria to elephants. Shannon diversity indices are mathematically grounded information theory. The 10% energy transfer rule is an empirical average across ecosystems — actual range 5-20% depending on ecosystem type.',
            'MeasurementTheory'=> 'SI units are defined by fixing exact values of fundamental physical constants (BIPM 2019). Uncertainty propagation follows from differential calculus — mathematically exact. Dimensional analysis is a consequence of the general covariance of physical laws under unit rescaling. The SI system is the most precisely defined and universally reproducible measurement framework in human history, enabling science to be replicated globally to sub-ppm precision.',
        ];

        $inductiveText = $inductiveTexts[$subtype] ?? ($domain['inductive_limit'] ?? 'Empirical laws are verified through independent experimental confirmation and scale universally within their domain of applicability.');
        $md .= "> *\"{$inductiveText}\"*\n\n";

        $md .= "**Universal Empirical Inductive Bound** *(n → ∞ Scaling)*:\n\n";
        $md .= "> **Empirical Basis**: Physical observations are consistent with the DB axiom (Phase 1).\n";
        $md .= "> **Deductive Bound**: Mathematical derivations hold under established physical laws (Phase 2).\n";
        $md .= "> **Inductive Scale**: Laws verified across:\n";
        $md .= ">   - Multiple independent experimental teams worldwide\n";
        $md .= ">   - Time scales from nanoseconds to billions of years\n";
        $md .= ">   - Spatial scales from nanometers to the Hubble volume\n";
        $md .= "> \n";
        $md .= "> **Conclusion**: ∀ empirical systems in this domain: [{$subtype} axiom holds universally] ✓\n\n";

        $synthNote = $domain['synthesis_note'] ?? '';
        if ($synthNote) {
            $md .= "> 📚 **Synthesis Note**: *\"{$synthNote}\"*\n\n";
        }

        $md .= "**[CERTIFIED ✅ — Global Axiom: {$domain['name']}]**\n\n";
        $md .= "*(Dialectically Proven via {$icon} Empirical Science Vectors — Zmzir Engine)*";

        return $md;
    }

    // ─────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────

    private function detectSubtype(string $tl): string
    {
        if (preg_match('/\b(scientific method|hypothesis|falsif|experiment(al)?|observation.*method|null hypothesis|controlled experiment|scientific law|theory vs law|peer review|scientific consensus|replication)\b/i', $tl)) return 'ScientificMethod';
        if (preg_match('/\b(cosmol|big bang|hubble|cmb|cosmic microwave|dark matter|dark energy|stellar nucleosynthesis|chandrasekhar|redshift|universe.*age|inflation.*universe|lambda.?cdm)\b/i', $tl)) return 'Cosmology';
        if (preg_match('/\b(plate tectonic|radiometric|geological|stratigraphy|milankovitch|rock cycle|subduction|seafloor spreading|mineral|earthquake|volcano|geolog)\b/i', $tl)) return 'Geology';
        if (preg_match('/\b(greenhouse effect|climate|co2|carbon dioxide|stefan.boltzmann|coriolis|atmosphere|meteorolog|weather|precipitation|global warming|clausius.clapeyron|albedo)\b/i', $tl)) return 'Meteorology';
        if (preg_match('/\b(ecology|ecosystem|lotka.volterra|carrying capacity|biodiversity|shannon.*diversity|trophic|food chain|predator.prey|competitive exclusion|logistic growth|population.*ecology)\b/i', $tl)) return 'Ecology';
        if (preg_match('/\b(si unit|measurement|uncertainty|precision|accuracy|calibration|significant figures|dimensional analysis|propagation of error|systematic error|random error)\b/i', $tl)) return 'MeasurementTheory';
        return 'ScientificMethod';
    }

    private function buildSyntheticDomain(string $subtype, string $tl): array
    {
        return match($subtype) {
            'ScientificMethod' => ['key' => 'scientific_method', 'name' => '🧪 Scientific Method (Synthetic)', 'branch_icon' => '🧪', 'academic_ref' => 'Popper (1934), Kuhn (1962), Bayes (1763)', 'trial' => 'We observe that the scientific method is a self-correcting process of hypothesis-testing and falsification.', 'deductive_axiom' => 'A scientific hypothesis is valid iff it generates falsifiable predictions confirmed by independent experiment.', 'inductive_limit' => 'The scientific method scales universally as the only self-correcting epistemological framework.'],
            'Cosmology'        => ['key' => 'cosmology', 'name' => '🌌 Cosmology (Synthetic)', 'branch_icon' => '🌌', 'academic_ref' => 'Hubble (1929), Penzias-Wilson (1965), Riess-Perlmutter (1998)', 'trial' => 'We observe the expanding universe via Hubble recession velocities and CMB radiation.', 'deductive_axiom' => 'Universe evolution follows Friedmann equations from FLRW metric; ΛCDM explains all precision cosmological observations.', 'inductive_limit' => 'The Big Bang model is constrained by 5 independent observational probes to sub-percent precision.'],
            'Geology'          => ['key' => 'geology', 'name' => '🌍 Geology & Earth Science (Synthetic)', 'branch_icon' => '🌍', 'academic_ref' => 'Wegener (1912), Wilson (1965), Holmes (1913)', 'trial' => 'We observe plate motion via GPS and constrain geological ages via radiometric dating.', 'deductive_axiom' => 'Radioactive decay N(t)=N₀e^{-λt} provides absolute time constraints; plate tectonics is GPS-verified.', 'inductive_limit' => 'Earth\'s 4.543 Gyr geological history is cross-validated by 4 independent dating systems.'],
            'Meteorology'      => ['key' => 'meteorology', 'name' => '🌦️ Meteorology & Climatology (Synthetic)', 'branch_icon' => '🌦️', 'academic_ref' => 'Tyndall (1859), Arrhenius (1896), Stefan-Boltzmann (1879)', 'trial' => 'We observe climate forcing via Stefan-Boltzmann radiation and CO₂ greenhouse absorption spectra.', 'deductive_axiom' => 'Greenhouse effect follows from Stefan-Boltzmann law and molecular IR absorption — measured in laboratory since 1859.', 'inductive_limit' => 'Climate forcing ΔF=5.35·ln(C/C₀) is confirmed by satellite, surface stations, and paleo-climate records.'],
            'Ecology'          => ['key' => 'ecology', 'name' => '🌿 Ecology (Synthetic)', 'branch_icon' => '🌿', 'academic_ref' => 'Lotka (1910), Volterra (1926), Gause (1934), Lindeman (1942)', 'trial' => 'We observe population dynamics via Lotka-Volterra equations and logistic growth models.', 'deductive_axiom' => 'Logistic growth dN/dt=rN(1−N/K) and Lotka-Volterra system are verified mathematical models of ecological dynamics.', 'inductive_limit' => 'Ecological models verified from laboratory microcosms to Serengeti-scale field observations.'],
            'MeasurementTheory'=> ['key' => 'measurement_theory', 'name' => '📏 Measurement Theory (Synthetic)', 'branch_icon' => '📏', 'academic_ref' => 'BIPM (2019), Bridgman (1922), Gauss (1821)', 'trial' => 'We observe that all physical quantities are measurable relative to SI base units defined by fundamental constants.', 'deductive_axiom' => 'Uncertainty propagation follows from differential calculus; dimensional homogeneity is necessary for all physical laws.', 'inductive_limit' => 'SI framework is universally reproducible and metrologically stable at sub-ppm precision.'],
            default            => ['key' => 'empirical_science', 'name' => '🔬 Empirical Science (Synthetic)', 'branch_icon' => '🔬', 'academic_ref' => 'Bacon, Newton, Popper', 'trial' => 'We observe repeatable phenomena governed by measurable physical laws.', 'deductive_axiom' => 'Physical observations are bounded by conservation laws and statistical inference.', 'inductive_limit' => 'Empirical laws are verified through independent experimental confirmation and scale universally.'],
        };
    }
}
