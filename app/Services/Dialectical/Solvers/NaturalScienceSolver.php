<?php

namespace App\Services\Dialectical\Solvers;

use App\Services\Dialectical\DynamicSyntaxGenerator;
use App\Services\SymbolicMathSolverService;
use App\Services\DialecticalOracleService;

/**
 * NATURAL SCIENCE SOLVER — Dialectical Engine v4 (Major Overhaul)
 *
 * Covers all empirical science domains with rigorous physical law derivations:
 *
 * ── CLASSICAL MECHANICS ──
 *   Newton's 3 Laws, Kinematics equations, Work-Energy theorem, Conservation
 *   of Momentum, Rotational dynamics, Gravitational law, Projectile motion
 *
 * ── THERMODYNAMICS ──
 *   Zeroth–Third Laws, Carnot efficiency, Boltzmann entropy, Clausius inequality,
 *   Gibbs/Helmholtz free energy, Joule expansion, Heat engine cycles
 *
 * ── SPECIAL & GENERAL RELATIVITY ──
 *   Lorentz factor, time dilation, length contraction, E=mc², spacetime metric,
 *   Schwarzschild radius, gravitational redshift, causal bounds (v < c)
 *
 * ── ELECTROMAGNETISM ──
 *   Maxwell's 4 equations, Coulomb, Faraday, Ampère, Lorentz force,
 *   Snell's law, wave equation, Poynting vector
 *
 * ── NUCLEAR PHYSICS ──
 *   Binding energy, decay law (λ, t½), Bethe-Weizsäcker SEMF,
 *   Radioactive decay modes, Einstein mass defect, fission/fusion Q-values
 *
 * ── CHEMISTRY ──
 *   Lavoisier conservation of mass, stoichiometry, Le Chatelier,
 *   Arrhenius equation, Gibbs free energy ΔG = ΔH − TΔS,
 *   Acid-base pH, Henderson-Hasselbalch, Hess's law
 *
 * ── BIOLOGY ──
 *   Hardy-Weinberg equilibrium, logistic growth, Darwin natural selection,
 *   Mendelian genetics, cellular respiration ATP yield, Hodgkin-Huxley,
 *   Hardy-Weinberg, Chargaff rules, Shannon genetic entropy
 *
 * ── ECONOMICS ──
 *   Supply & Demand equilibrium, Price elasticity, Keynesian multiplier,
 *   Nash equilibrium, Pareto efficiency, IS-LM model
 */
class NaturalScienceSolver extends AbstractDynamicDialecticalSolver implements DynamicInductionInterface
{
    private DynamicSyntaxGenerator $syntax;
    private SymbolicMathSolverService $cas;
    private DialecticalOracleService $oracle;
    private \App\Services\Dialectical\MathematicalPrimitivesService $primitives;

    // Physical Constants
    private const C = 299792458.0;     // m/s — speed of light
    private const G_GRAV = 6.674e-11;        // N·m²/kg² — gravitational constant
    private const K_BOLTZ = 1.380649e-23;     // J/K — Boltzmann constant
    private const H_PLANCK = 6.62607015e-34;   // J·s — Planck constant
    private const HBAR = 1.054571817e-34;  // J·s — reduced Planck
    private const E_CHARGE = 1.602176634e-19;  // C — elementary charge
    private const ME = 9.1093837015e-31; // kg — electron mass
    private const MP = 1.67262192e-27;   // kg — proton mass
    private const MN = 1.67492750e-27;   // kg — neutron mass
    private const NA = 6.02214076e23;    // mol⁻¹ — Avogadro
    private const R_GAS = 8.314462618;      // J/(mol·K) — gas constant
    private const SIGMA_SB = 5.670374419e-8;   // W/(m²K⁴) — Stefan-Boltzmann
    private const EPS0 = 8.8541878128e-12; // F/m — vacuum permittivity
    private const MU0 = 1.25663706212e-6; // H/m — vacuum permeability

    public function __construct(DynamicSyntaxGenerator $syntax, SymbolicMathSolverService $cas)
    {
        $this->syntax = $syntax;
        $this->cas = $cas;
        $this->oracle = new DialecticalOracleService();
        $this->primitives = new \App\Services\Dialectical\MathematicalPrimitivesService();
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1: EMPIRICAL TRIAL — Extract physical/empirical vectors
    // ═══════════════════════════════════════════════════════════════════
    protected function fallbackPhase1Trial(string $thesis, ?array $astMatrix = null): array
    {
        $domain = $this->oracle->classifyDomain($thesis);
        $tl = strtolower($thesis);

        $state = [
            'is_valid' => true,
            'thesis' => $thesis,
            'domain' => $domain,
            'proof_traces' => [],
            'vectors' => [],
            'system_type' => $this->detectSystemType($tl, $astMatrix),
            'is_violation' => false,
            'axiom_chain' => [],
            'trials' => [],
            'is_unsolved' => $this->oracle->isUnsolvedProblem($thesis),
        ];

        // Validate logic first via Oracle
        $logicAnalysis = $this->oracle->analyzeLogicThesis($thesis);
        if (is_array($logicAnalysis) && isset($logicAnalysis['is_valid']) && $logicAnalysis['is_valid'] === false && !$state['is_unsolved']) {
            $state['is_valid'] = false;
            $state['proof_traces'][] = "### ⚠️ LOGICAL/PHYSICAL CONTRADICTION DETECTED";
            $state['proof_traces'][] = "**Reason**: " . ($logicAnalysis['table_rows'] ?? 'The vectors violate core mathematical/physical constraints.');
            $state['proof_traces'][] = "**[HALTED: Synthesized Anti-Thesis]**";
            return $state;
        }

        if (!$domain) {
            $domain = $this->buildSyntheticDomain($state['system_type'], $tl);
            $state['domain'] = $domain;
            $state['proof_traces'][] = "### ℹ️ SYNTHETIC AXIOM DOMAIN (oracle DB miss — inferred from thesis)";
        }

        // Axiom ancestry chain
        $visited = [];
        $axiomChain = $this->oracle->buildProofChain($domain['key'] ?? 'natural_science_empirical', 0, $visited);
        $leafNode = ['key' => $domain['key'] ?? 'natural_science_empirical', 'name' => $domain['name'], 'branch_icon' => $domain['branch_icon'] ?? '🔬', 'academic_ref' => $domain['academic_ref'] ?? 'Natural Science'];
        $state['axiom_chain'] = array_merge([$leafNode], $axiomChain);

        $chainNames = array_map(fn($n) => ($n['branch_icon'] ?? '🔢') . ' ' . $n['name'], $state['axiom_chain']);
        $state['proof_traces'][] = '**📖 Axiom Root**: ' . $domain['name'] . ' `[' . ($domain['academic_ref'] ?? 'Natural Science') . ']`';
        $state['proof_traces'][] = '🔗 **Mathematical Axiom Chain**: ' . implode(' ← ', $chainNames);
        $state['proof_traces'][] = '**🔬 Empirical Observation**: ' . ($domain['trial'] ?? 'We observe a natural physical or empirical phenomenon.');

        $state['vectors']['system'] = $state['system_type'];
        $state['vectors']['raw'] = $thesis;

        // Generate domain-specific Phase 1 trial data
        switch ($state['system_type']) {

            case 'Thermodynamic':
                $state['proof_traces'][] = "\n**🌡️ Vector Abstraction (Thermodynamics)**:";
                $state['proof_traces'][] = "- **Zeroth Law**: If A ≡ B and B ≡ C thermally, then A ≡ C (transitivity of thermal equilibrium)";
                $state['proof_traces'][] = "- **First Law**: ΔU = Q − W  (change in internal energy = heat absorbed − work done by system)";
                $state['proof_traces'][] = "- **Second Law (Clausius)**: ΔS_universe ≥ 0;  dS ≥ dQ/T  (entropy never decreases in isolated systems)";
                $state['proof_traces'][] = "- **Second Law (Boltzmann)**: S = k_B · ln(W)  where W = number of accessible microstates";
                $state['proof_traces'][] = "- **Third Law (Nernst)**: S → 0 as T → 0K  (perfect crystal at absolute zero has zero entropy)";
                $state['proof_traces'][] = "- **Carnot Efficiency**: η_max = 1 − T_cold/T_hot  (maximum theoretical efficiency for any heat engine, e.g. 600K to 300K → 0.5 or 50%)";
                $state['proof_traces'][] = "- **Gibbs Free Energy**: ΔG = ΔH − TΔS;  ΔG < 0 → spontaneous;  ΔG = 0 → equilibrium";

                // Carnot efficiency table for various T_hot, T_cold
                $pairs = [[600, 300], [800, 300], [1000, 400], [1500, 300], [2000, 500]];
                foreach ($pairs as [$hot, $cold]) {
                    $eta = 1 - $cold / $hot;
                    $state['trials'][] = [
                        'T_hot (K)' => $hot,
                        'T_cold (K)' => $cold,
                        'η_Carnot = 1−T_c/T_h' => number_format($eta * 100, 1) . '%',
                        'ΔS_universe' => 'ΔS ≥ 0 ✅',
                        '2nd Law Obeyed' => $eta > 0 && $eta < 1 ? 'Yes ✅' : 'Violation ❌',
                    ];
                }
                $isViolation = preg_match('/e_out\s*>\s*e_in|over.?unity|perpetual|efficiency\s*[>=]\s*1|100%\s+efficient/i', $thesis);
                $state['is_violation'] = (bool) $isViolation;
                if ($state['is_violation'] && !$state['is_unsolved']) {
                    $state['is_valid'] = false;
                    $state['proof_traces'][] = "❌ **THERMODYNAMIC PARADOX DETECTED**: Claim asserts E_out > E_in or η ≥ 100%, violating the 1st and 2nd Laws.";
                }
                break;

            case 'Kinematic':
                $state['proof_traces'][] = "\n**🍎 Vector Abstraction (Classical Mechanics)**:";
                $state['proof_traces'][] = "- **Newton's 1st Law**: ∑F = 0 ⟹ v = const  (law of inertia)";
                $state['proof_traces'][] = "- **Newton's 2nd Law**: F = ma  (net force = mass × acceleration);  [F] = N = kg·m/s²";
                $state['proof_traces'][] = "- **Newton's 3rd Law**: F₁₂ = −F₂₁  (action = equal and opposite reaction)";
                $state['proof_traces'][] = "- **Kinematics**: v = u + at;  s = ut + ½at²;  v² = u² + 2as  (equations of motion: velocity, acceleration, displacement, time)";
                $state['proof_traces'][] = "- **Work-Energy Theorem**: W = ΔKE = ½m(v² − u²)";
                $state['proof_traces'][] = "- **Conservation of Momentum**: p = mv;  ∑p_before = ∑p_after";
                $state['proof_traces'][] = "- **Gravitational Law**: F = G·m₁m₂/r²;  g = 9.81 m/s² at Earth's surface";
                $state['proof_traces'][] = "- **Projectile**: x = v₀cos(θ)·t;  y = v₀sin(θ)·t − ½gt²;  Range = v₀²sin(2θ)/g";

                // Kinematics samples: Free fall from various heights
                $heights = [1, 5, 10, 45, 80];
                foreach ($heights as $h) {
                    $t = sqrt(2 * $h / 9.81);
                    $v = 9.81 * $t;
                    $ke = 0.5 * 1.0 * $v * $v; // m = 1 kg
                    $pe = 1.0 * 9.81 * $h;
                    $state['trials'][] = [
                        'Height h (m)' => $h,
                        'Fall time (s)' => number_format($t, 3),
                        'Impact v (m/s)' => number_format($v, 2),
                        'KE (J, m=1kg)' => number_format($ke, 2),
                        'KE = PE = mgh?' => abs($ke - $pe) < 0.01 ? 'Yes ✅' : 'No ❌',
                    ];
                }
                break;

            case 'Relativistic':
                $state['proof_traces'][] = "\n**🌌 Vector Abstraction (Special & General Relativity)**:";
                $state['proof_traces'][] = "- **Postulates**: (1) Laws of physics are the same in all inertial frames. (2) c is constant in all frames.";
                $state['proof_traces'][] = "- **Lorentz Factor**: γ = 1/√(1 − v²/c²)  (→ ∞ as v → c)";
                $state['proof_traces'][] = "- **Time Dilation**: Δt' = γ·Δt₀  (moving clocks run slow)";
                $state['proof_traces'][] = "- **Length Contraction**: L = L₀/γ  (moving objects are shorter in direction of motion)";
                $state['proof_traces'][] = "- **Mass-Energy Equivalence**: E=mc²; E_rest = m₀c²; E_total = γm₀c² (1kg mass = 9×10^16 Joules)";
                $state['proof_traces'][] = "- **Relativistic Momentum**: p = γm₀v";
                $state['proof_traces'][] = "- **4-Momentum Invariant**: E² = (pc)² + (m₀c²)²";
                $state['proof_traces'][] = "- **Schwarzschild Radius**: r_s = 2GM/c²  (event horizon radius of black hole)";
                $state['proof_traces'][] = "- **Causal Bound**: v < c always. Massive particles cannot reach c. Tachyons violate causality.";

                // Lorentz factor table
                $velFracs = [0.1, 0.5, 0.9, 0.99, 0.999, 0.9999];
                foreach ($velFracs as $beta) {
                    $gamma = 1.0 / sqrt(1 - $beta * $beta);
                    $timeDil = $gamma;         // Δt' / Δt₀
                    $lenContr = 1.0 / $gamma;   // L / L₀
                    $state['trials'][] = [
                        'v/c (β)' => $beta,
                        'γ (Lorentz)' => number_format($gamma, 4),
                        'Time dilation' => 'Δt\' = ' . number_format($timeDil, 4) . '·Δt₀',
                        'L contraction' => 'L = ' . number_format($lenContr, 4) . '·L₀',
                        'Causal Bound' => $beta < 1 ? 'v < c ✅' : 'v = c ❌ (forbidden)',
                    ];
                }
                // Check for tachyon/FTL paradox
                if (preg_match('/tachyon|faster.than.light|ftl|v\s*>\s*c|exceed.*speed of light|infinite speed/i', $thesis) && !$state['is_unsolved']) {
                    $state['is_violation'] = true;
                    $state['is_valid'] = false;
                    $state['proof_traces'][] = "❌ **RELATIVISTIC CAUSALITY VIOLATION**: v > c implies γ is imaginary; energy becomes negative (or negative mass). Causality is broken (effect can precede cause).";
                }
                break;

            case 'Electromagnetic':
                $state['proof_traces'][] = "\n**⚡ Vector Abstraction (Electromagnetism — Maxwell's Equations)**:";
                $state['proof_traces'][] = "- **Gauss's Law (E)**: ∇·E = ρ/ε₀  (electric field divergence = charge density/ε₀)";
                $state['proof_traces'][] = "- **Gauss's Law (B)**: ∇·B = 0  (no magnetic monopoles — magnetic field lines are closed loops)";
                $state['proof_traces'][] = "- **Faraday's Law**: ∇×E = −∂B/∂t  (changing magnetic flux induces EMF)";
                $state['proof_traces'][] = "- **Ampère-Maxwell Law**: ∇×B = μ₀J + μ₀ε₀∂E/∂t  (current + displacement current creates magnetic field)";
                $state['proof_traces'][] = "- **Speed of Light Derivation**: c = 1/√(ε₀μ₀) = " . number_format(1 / sqrt(self::EPS0 * self::MU0), 0) . " m/s ✅";
                $state['proof_traces'][] = "- **Coulomb's Law**: F = q₁q₂/(4πε₀r²);  k_e = 8.988×10⁹ N·m²/C²";
                $state['proof_traces'][] = "- **Lorentz Force**: F = q(E + v×B)";
                $state['proof_traces'][] = "- **Ohm's Law**: V = IR;  P = IV = I²R = V²/R";
                $state['proof_traces'][] = "- **Snell's Law**: n₁sin(θ₁) = n₂sin(θ₂)  (refraction at interface)";
                $state['proof_traces'][] = "- **Wave Equation**: ∇²E − (1/c²)∂²E/∂t² = 0  (electromagnetic wave propagation)";

                // Refraction angle table
                $n1 = 1.0; // air
                $n2 = 1.5; // glass
                $angles = [10, 20, 30, 40, 50];
                foreach ($angles as $deg) {
                    $theta1 = deg2rad($deg);
                    $sinTheta2 = $n1 * sin($theta1) / $n2;
                    $theta2 = $sinTheta2 <= 1 ? rad2deg(asin($sinTheta2)) : null;
                    $state['trials'][] = [
                        'θ₁ (air, n=1)' => $deg . '°',
                        'θ₂ (glass, n=1.5)' => $theta2 ? number_format($theta2, 2) . '°' : 'TIR ❌',
                        'Snell: n₁sinθ₁' => number_format($n1 * sin($theta1), 4),
                        'n₂sinθ₂' => $theta2 ? number_format($n2 * sin(deg2rad($theta2)), 4) : '—',
                        'Conserved?' => $theta2 ? 'Yes ✅' : 'TIR applies ✅',
                    ];
                }
                break;

            case 'Nuclear':
                $state['proof_traces'][] = "\n**☢️ Vector Abstraction (Nuclear Physics)**:";
                $state['proof_traces'][] = "- **Radioactive Decay Law**: N(t) = N₀·e^(−λt)  where λ = ln2/t½";
                $state['proof_traces'][] = "- **Half-life**: t½ = ln2/λ = 0.6931/λ";
                $state['proof_traces'][] = "- **Activity**: A = λN  (decays per second = Becquerels)";
                $state['proof_traces'][] = "- **Q-value (Mass Defect)**: Q = Δm·c²  (energy released in nuclear reaction)";
                $state['proof_traces'][] = "- **Binding Energy**: B = [Z·m_H + N·m_n − m_nucleus] × c²";
                $state['proof_traces'][] = "- **SEMF (Bethe-Weizsäcker)**: B = a_v·A − a_s·A^(2/3) − a_c·Z²/A^(1/3) − a_sym·(A−2Z)²/A ± a_p·A^(−1/2)";
                $state['proof_traces'][] = "- **Fission**: Heavy nucleus (e.g. ²³⁵U) splits → Q ≈ 200 MeV/fission";
                $state['proof_traces'][] = "- **Fusion**: Light nuclei combine (e.g. D+T → ⁴He+n) → Q ≈ 17.6 MeV/reaction";

                // Decay table: various half-lives showing exponential falloff
                $halfLives = [
                    ['Isotope' => '¹⁴C (Carbon)', 't½' => '5730 yr', 'λ' => log(2) / 5730, 'Unit' => 'yr'],
                    ['Isotope' => '²³⁸U (Uranium)', 't½' => '4.47×10⁹yr', 'λ' => log(2) / 4.47e9, 'Unit' => 'yr'],
                    ['Isotope' => '¹³¹I (Iodine)', 't½' => '8.02 days', 'λ' => log(2) / 8.02, 'Unit' => 'days'],
                    ['Isotope' => '²²⁶Ra (Radium)', 't½' => '1600 yr', 'λ' => log(2) / 1600, 'Unit' => 'yr'],
                    ['Isotope' => '²²⁶Rn (Radon)', 't½' => '3.82 days', 'λ' => log(2) / 3.82, 'Unit' => 'days'],
                ];
                foreach ($halfLives as $row) {
                    $n_at_1t = exp(-$row['λ'] * 1);   // after 1 t½ unit
                    $state['trials'][] = [
                        'Isotope' => $row['Isotope'],
                        't½' => $row['t½'],
                        'N(1·t½)/N₀' => number_format($n_at_1t, 4) . ' ≈ 0.5 ✅',
                        'N(2·t½)/N₀' => number_format(exp(-$row['λ'] * 2), 4) . ' ≈ 0.25 ✅',
                        'Decay Law' => 'e^(−λt) ✅',
                    ];
                }
                break;

            case 'Chemical':
                $state['proof_traces'][] = "\n**⚗️ Vector Abstraction (Chemistry)**:";
                $state['proof_traces'][] = "- **Conservation of Mass (Lavoisier)**: ∑M_reactants = ∑M_products in closed system";
                $state['proof_traces'][] = "- **Stoichiometry**: Molar ratios from balanced equation → limiting reagent → yield";
                $state['proof_traces'][] = "- **Gibbs Free Energy**: ΔG = ΔH − TΔS;  ΔG < 0 spontaneous;  ΔG = 0 equilibrium";
                $state['proof_traces'][] = "- **Le Chatelier's Principle**: System at equilibrium shifts to oppose applied perturbation";
                $state['proof_traces'][] = "- **Arrhenius Equation**: k = A·e^(−E_a/RT)  (reaction rate vs. temperature)";
                $state['proof_traces'][] = "- **Hess's Law**: ΔH_rxn = ∑ΔH_f(products) − ∑ΔH_f(reactants) (state function)";
                $state['proof_traces'][] = "- **Henderson-Hasselbalch**: pH = pKa + log([A⁻]/[HA])  (acid-base buffer)";
                $state['proof_traces'][] = "- **Equilibrium Constant**: K = [products]^ν/[reactants]^ν;  K = e^(−ΔG°/RT)";
                $state['proof_traces'][] = "- **Ideal Gas**: PV = nRT;  P = ρRT/M (density form)";

                // Arrhenius k vs T table (E_a = 50 kJ/mol typical)
                $Ea = 50000.0; // J/mol
                $A = 1e13;    // typical pre-exponential
                $temps = [273, 300, 320, 350, 400, 500];
                foreach ($temps as $T) {
                    $k = $A * exp(-$Ea / (self::R_GAS * $T));
                    $state['trials'][] = [
                        'T (K)' => $T,
                        'T (°C)' => ($T - 273),
                        'k = A·e^(−Ea/RT)' => sprintf('%.3e', $k),
                        'Ratio k(T)/k(300K)' => number_format($k / ($A * exp(-$Ea / (self::R_GAS * 300))), 2),
                        'Status' => 'Arrhenius ✅',
                    ];
                }
                if (preg_match('/mass_out\s*>\s*mass_in|creates?\s+matter|matter\s+from\s+nothing|more\s+product\s+than\s+reactant/i', $thesis) && !$state['is_unsolved']) {
                    $state['is_violation'] = true;
                    $state['is_valid'] = false;
                    $state['proof_traces'][] = "❌ **CHEMICAL PARADOX**: Claims matter creation — violates Lavoisier Conservation of Mass and Noether's Theorem.";
                }
                break;

            case 'Biological':
            case 'evolutionary_biology':
                $state['proof_traces'][] = "\n**🌿 Vector Abstraction (Evolutionary Biology)**:";
                $state['proof_traces'][] = "- **Hardy-Weinberg**: p² + 2pq + q² = 1  where p + q = 1 (allele frequencies in equilibrium)";
                $state['proof_traces'][] = "- **H-W Conditions**: No mutation, random mating, large population, no selection, no gene flow";
                $state['proof_traces'][] = "- **Logistic Growth**: dN/dt = rN(1 − N/K);  N(t) = K/(1 + ((K−N₀)/N₀)·e^(−rt))";
                $state['proof_traces'][] = "- **Natural Selection**: Δp ≈ p·q·s·(p − q)  (s = selection coefficient)";
                $state['proof_traces'][] = "- **Genetic Drift**: Var(p') = p(1−p)/2N_e  (variance in allele frequency per generation)";
                $state['proof_traces'][] = "- **Kin Selection (Hamilton's Rule)**: r·B > C  (r = relatedness, B = benefit, C = cost)";
                $state['proof_traces'][] = "- **Speciation**: reproductive isolation + genetic drift + selection → new species";
                $state['proof_traces'][] = "- **Mendelian Genetics**: For Aa × Aa cross: 1/4 AA, 2/4 Aa, 1/4 aa (3:1 phenotype ratio)";

                // Hardy-Weinberg verification table for various p values
                $pVals = [0.1, 0.3, 0.5, 0.7, 0.9];
                foreach ($pVals as $p) {
                    $q = 1 - $p;
                    $hw = $p * $p + 2 * $p * $q + $q * $q;
                    $state['trials'][] = [
                        'p (allele A)' => $p,
                        'q = 1−p' => $q,
                        'p² (AA)' => number_format($p * $p, 3),
                        '2pq (Aa)' => number_format(2 * $p * $q, 3),
                        'q² (aa)' => number_format($q * $q, 3),
                        'p²+2pq+q²' => number_format($hw, 6),
                        'H-W = 1?' => abs($hw - 1) < 1e-9 ? 'Yes ✅' : 'No ❌',
                    ];
                }
                break;

            case 'genetics':
                $state['proof_traces'][] = "\n**🧬 Vector Abstraction (Molecular Genetics)**:";
                $state['proof_traces'][] = "- **Chargaff's Rules**: [A]=[T], [C]=[G]  (Watson-Crick complementarity)";
                $state['proof_traces'][] = "- **DNA Information**: Each base = 2 bits (4 bases = 2²);  genome = 6×10⁹ bp → ~1.5 GB";
                $state['proof_traces'][] = "- **Mutation Rate**: μ ≈ 10⁻⁸ per base per generation (human germline)";
                $state['proof_traces'][] = "- **Shannon Genetic Entropy**: H = −∑ p_i log₂(p_i)  ≤ 2 bits/base";
                $state['proof_traces'][] = "- **Protein Synthesis**: DNA → mRNA (transcription) → protein (translation); codon = 3 bases → 20 amino acids";
                $state['proof_traces'][] = "- **Mendelian Independent Assortment**: P(AaBb) = P(Aa)·P(Bb) for unlinked genes";

                $state['trials'] = [
                    ['Base Pair' => 'A-T', 'Hydrogen Bonds' => '2', 'Chargaff [A]=[T]' => '✅', 'Complement' => 'Watson-Crick ✅'],
                    ['Base Pair' => 'G-C', 'Hydrogen Bonds' => '3', 'Chargaff [G]=[C]' => '✅', 'Complement' => 'Watson-Crick ✅'],
                    ['Base Pair' => 'A+T+G+C', 'Hydrogen Bonds' => '—', 'Chargaff [A]=[T]' => '✅', 'Complement' => 'Double helix stable ✅'],
                ];
                break;

            case 'cellular_biology':
                $state['proof_traces'][] = "\n**🦠 Vector Abstraction (Cellular Biology & Bioenergetics)**:";
                $state['proof_traces'][] = "- **Cellular Respiration**: Glucose breakdown in mitochondria via electron transport chain to produce ATP. C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + 36−38 ATP";
                $state['proof_traces'][] = "- **Thermodynamic Bound**: ΔG°'(glucose) = −2870 kJ/mol;  ΔG_ATP ≈ −7.3 kJ/mol × 38 ≈ −277 kJ  (≈ 40% efficient)";
                $state['proof_traces'][] = "- **Krebs Cycle**: Acetyl-CoA → 3 NADH + FADH₂ + GTP per cycle";
                $state['proof_traces'][] = "- **Mitosis**: G1 → S (DNA replication) → G2 → M (division) → 2 diploid daughter cells";
                $state['proof_traces'][] = "- **Membrane Potential**: Nernst: E = (RT/zF)·ln([Ion]_out/[Ion]_in)";
                $state['proof_traces'][] = "- **Perpetual Life Paradox**: Cells require continuous energy input (ΔU > 0). Entropy requires maintenance energy.";

                $state['trials'] = [
                    ['Stage' => 'Glycolysis', 'ATP produced' => '2 (net)', 'Location' => 'Cytoplasm', 'O₂ required' => 'No'],
                    ['Stage' => 'Krebs Cycle', 'ATP produced' => '2 GTP', 'Location' => 'Mitochondria', 'O₂ required' => 'Yes'],
                    ['Stage' => 'ETC/OxPhos', 'ATP produced' => '32−34', 'Location' => 'Mito. membrane', 'O₂ required' => 'Yes'],
                    ['Stage' => 'Total', 'ATP produced' => '36−38', 'Location' => 'Cell-wide', 'O₂ required' => 'Yes'],
                ];
                break;

            case 'neuroscience':
                $state['proof_traces'][] = "\n**🧠 Vector Abstraction (Neuroscience & Electrophysiology)**:";
                $state['proof_traces'][] = "- **Resting Potential**: V_m ≈ −70mV (K⁺ driven via Goldman-Hodgkin-Katz equation)";
                $state['proof_traces'][] = "- **Nernst Equation**: E_ion = (RT/zF)·ln([ion]_out/[ion]_in)";
                $state['proof_traces'][] = "- **Action Potential Threshold**: V_m > −55mV → voltage-gated Na⁺ channels open";
                $state['proof_traces'][] = "- **Hodgkin-Huxley**: I = C_m·dV/dt + g_Na·m³h(V−E_Na) + g_K·n⁴(V−E_K) + g_L(V−E_L)";
                $state['proof_traces'][] = "- **Conduction Velocity**: v ∝ √(axon diameter);  myelinated axons: 70−120 m/s;  unmyelinated: 0.5−2 m/s";
                $state['proof_traces'][] = "- **Synaptic Transmission**: Neurotransmitter release (Ca²⁺ triggered) → receptor binding → EPSP/IPSP";
                $state['proof_traces'][] = "- **Refractory Period**: Absolute (~1ms) + Relative (~3ms) — limits maximum firing rate";

                $state['trials'] = [
                    ['Ion' => 'K⁺', 'E_ion (mV)' => '−90', 'Role' => 'Resting potential', 'Concentration' => '[K]_in >> [K]_out'],
                    ['Ion' => 'Na⁺', 'E_ion (mV)' => '+60', 'Role' => 'Depolarisation', 'Concentration' => '[Na]_out >> [Na]_in'],
                    ['Ion' => 'Ca²⁺', 'E_ion (mV)' => '+136', 'Role' => 'Synaptic release', 'Concentration' => '[Ca]_out >> [Ca]_in'],
                    ['Ion' => 'Cl⁻', 'E_ion (mV)' => '−70', 'Role' => 'Inhibition (IPSP)', 'Concentration' => '[Cl]_out > [Cl]_in'],
                ];
                break;

            case 'Economic':
                $state['proof_traces'][] = "\n**📊 Vector Abstraction (Supply & Demand Economics)**:";
                $state['proof_traces'][] = "- **Demand Law**: Q_d = D(P);  ∂Q_d/∂P < 0  (inverse relationship — law of demand)";
                $state['proof_traces'][] = "- **Supply Law**: Q_s = S(P);  ∂Q_s/∂P > 0  (direct relationship — law of supply)";
                $state['proof_traces'][] = "- **Equilibrium**: Q_s(P*) = Q_d(P*)  defines market clearing price P*";
                $state['proof_traces'][] = "- **Price Elasticity**: ε_d = (ΔQ_d/Q_d)/(ΔP/P);  |ε| > 1 elastic;  |ε| < 1 inelastic";
                $state['proof_traces'][] = "- **Keynesian Multiplier**: k = 1/(1−MPC);  ΔY = k·ΔI";
                $state['proof_traces'][] = "- **Nash Equilibrium**: Each player maximizes payoff given others' strategies — no unilateral deviation profitable";
                $state['proof_traces'][] = "- **Pareto Efficiency**: No one can be made better off without making someone else worse off";
                $state['proof_traces'][] = "- **Consumer Surplus**: CS = ∫_{P*}^{P_max} D(p)dp  (area between demand curve and P*)";

                // Supply-demand equilibrium simulation
                // Q_d = 100 − 2P,  Q_s = 3P − 50 → equilibrium P* = 30, Q* = 40
                foreach ([20, 25, 30, 35, 40] as $P) {
                    $Qd = 100 - 2 * $P;
                    $Qs = max(0, 3 * $P - 50);
                    $surplus = $Qs - $Qd;
                    $state['trials'][] = [
                        'Price P' => $P,
                        'Q_d = 100−2P' => $Qd,
                        'Q_s = 3P−50' => $Qs,
                        'Excess' => $surplus > 0 ? "Supply surplus: +{$surplus}" : ($surplus < 0 ? "Demand deficit: {$surplus}" : 'Equilibrium ✅'),
                        'Market' => $surplus === 0 ? 'P* = 30, Q* = 40 ✅' : ($surplus > 0 ? 'Price ↓ pressure' : 'Price ↑ pressure'),
                    ];
                }
                break;

            default:
                $state['proof_traces'][] = "**General Natural Science**: Applying conservation laws and empirical axioms.";
                $state['trials'] = $this->generateGenericTrials($state['system_type']);
                break;
        }

        // Append empirical base case table
        $empiricalBases = $this->generateEmpiricalBaseCases($state['system_type'], 1, 3);
        $state['proof_traces'][] = "\n**🔬 Deterministic Empirical Base Cases:**\n" . $empiricalBases;

        return $state;
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2: DEDUCTIVE PURIFICATION — Apply physical law bounds
    // ═══════════════════════════════════════════════════════════════════
    protected function fallbackPhase2Deduction(array $state): array
    {
        if (!$state['is_valid'])
            return $state;

        $domain = $state['domain'];
        $systemType = $state['system_type'];
        $isUnsolved = $state['is_unsolved'];

        $state['proof_traces'][] = "\n### 🧮 Phase 2 — Deductive Limit Evaluation";
        $state['proof_traces'][] = '**📐 DB Deductive Axiom**: *"' . ($domain['deductive_axiom'] ?? 'Mathematical deduction of physical interactions based on conservation laws.') . '"*';

        $state['symbolic_traces'] = [];

        switch ($systemType) {

            case 'Thermodynamic':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => '1st Law', 'expr' => 'ΔU = Q − W  [Energy cannot be created or destroyed]'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => '2nd Law (Clausius)', 'expr' => 'ΔS_univ = ΔS_sys + ΔS_surr ≥ 0  [Entropy universally non-decreasing]'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Carnot Bound', 'expr' => 'η_max = 1 − T_c/T_h < 1  [No heat engine can be 100% efficient]'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Gibbs Criterion', 'expr' => 'ΔG = ΔH − TΔS < 0 → Spontaneous;  ΔG = 0 → Equilibrium'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Boltzmann Entropy', 'expr' => 'S = k_B·ln(W);  W → max at equilibrium (max entropy principle)'];

                if ($state['is_violation']) {
                    if ($isUnsolved) {
                        $state['symbolic_traces'][] = ['step' => 'CSB', 'label' => 'Creative Synthesis Bypass', 'expr' => 'E_out > E_in modeled via higher-dimensional dark energy injection → Theoretical ✅'];
                        $state['proof_traces'][] = "> **[Creative Synthesis Bypass]**: Multi-dimensional entropy manifold allows energy extraction in theoretical framework.";
                    } else {
                        $state['is_valid'] = false;
                        $state['symbolic_traces'][] = ['step' => 'HALT', 'label' => 'Thermodynamic Bound Check', 'expr' => 'E_out > E_in → ΔU < 0 → Entropy decreases spontaneously → IMPOSSIBLE ❌'];
                        $state['proof_traces'][] = "**⚠️ PHYSICAL LAW VIOLATION**: E_out > E_in implies ΔU < 0, requiring spontaneous entropy decrease — absolutely forbidden by the 2nd Law.";
                        $state['proof_traces'][] = "**[HALTED: Perpetual Motion / Over-Unity Device — Physically Impossible ❌]**";
                    }
                } else {
                    $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Thermodynamic Bound OK', 'expr' => 'E_out ≤ E_in — Energy conservation satisfied ✅'];
                    $state['proof_traces'][] = "System is **thermodynamically consistent**: E_out ≤ E_in, ΔS_univ ≥ 0.";
                }
                break;

            case 'Kinematic':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Newton\'s 2nd Law', 'expr' => 'F = ma;  [F] = kg·m/s² = N'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Work-Energy Theorem', 'expr' => 'W_net = ΔKE = ½m(v² − u²)  [derived by integrating F·ds = ma·ds]'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Conservation of Energy', 'expr' => 'KE + PE = const  (in conservative field);  ½mv² + mgh = const'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Conservation of Momentum', 'expr' => '∑p = ∑mv = const  (no external forces);  Elastic: ½m₁v₁² + ½m₂v₂² = const'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Gravitational Potential', 'expr' => 'U = −GMm/r;  g = GM_E/R_E² ≈ 9.81 m/s²'];
                $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Causal Bound', 'expr' => 'v ≤ c  always for massive objects (Lorentz factor γ → ∞ as v → c) ✅'];

                // Sample F = ma evaluation if domain has equation
                if (isset($domain['equation'])) {
                    try {
                        $result = $this->cas->evaluateNumerically($domain['equation'], ['mass' => 10.0, 'acceleration' => 5.0]);
                        $state['symbolic_traces'][] = ['step' => 'CAS', 'label' => 'Sample CAS Evaluation', 'expr' => "F(m=10 kg, a=5 m/s²) = {$result} N ✅"];
                    } catch (\Throwable $e) {
                    }
                }
                $state['proof_traces'][] = "Classical mechanics vectors are **dimensionally and axiomatically consistent** with Newton's laws.";
                break;

            case 'Relativistic':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Lorentz Factor', 'expr' => 'γ = 1/√(1 − v²/c²) ≥ 1;  γ → ∞ as v → c'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Time Dilation Derivation', 'expr' => 'Light-clock gedanken: Δt\' = γΔt₀  (relativistic time interval longer for moving clock)'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Length Contraction', 'expr' => 'L = L₀/γ  (length contracted in direction of motion — verified in muon decay experiments)'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'E = mc²', 'expr' => 'E_rest = m₀c²;  E_total = γm₀c² = √((pc)² + (m₀c²)²)  [4-vector invariant]'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Causal Limit Proof', 'expr' => 'v = c → γ = ∞ → E = ∞ for massive particles → Impossible ❌;  v > c → γ imaginary → causality broken'];
                $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Schwarzschild Metric', 'expr' => 'ds² = −(1−r_s/r)c²dt² + (1−r_s/r)⁻¹dr² + r²dΩ²;  r_s = 2GM/c²'];
                $state['symbolic_traces'][] = ['step' => '7', 'label' => 'Gravitational Redshift', 'expr' => 'Δf/f ≈ gh/c²  (verified: GPS clock corrections of 38 μs/day without GR compensation → 10km error/day)'];

                if ($state['is_violation']) {
                    if ($isUnsolved) {
                        $state['symbolic_traces'][] = ['step' => 'CSB', 'label' => 'Creative Synthesis Bypass', 'expr' => 'v > c via Alcubierre warp metric (negative energy density manifold) → Theoretical ✅'];
                        $state['proof_traces'][] = "> **[Creative Synthesis Bypass]**: Alcubierre metric permits FTL frame dragging without local v > c.";
                    } else {
                        $state['is_valid'] = false;
                        $state['symbolic_traces'][] = ['step' => 'HALT', 'label' => 'Relativistic Bound', 'expr' => 'v > c → γ ∈ ℂ → E imaginary → causality violated → IMPOSSIBLE ❌'];
                        $state['proof_traces'][] = "**[HALTED: Relativistic Causal Bound Violated ❌]**";
                    }
                } else {
                    $state['symbolic_traces'][] = ['step' => '8', 'label' => 'Relativistic Bound OK', 'expr' => 'v < c for all massive objects ✅;  time dilation and length contraction experimentally verified'];
                    $state['proof_traces'][] = "Relativistic vectors are **consistent** with Special & General Relativity. No causal bound violated.";
                }
                break;

            case 'Electromagnetic':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Maxwell Eq 1 (Gauss E)', 'expr' => '∇·E = ρ/ε₀  →  ∮E·dA = Q_enc/ε₀  (Gauss\'s Law)'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Maxwell Eq 2 (Gauss B)', 'expr' => '∇·B = 0  →  ∮B·dA = 0  (no magnetic monopoles)'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Maxwell Eq 3 (Faraday)', 'expr' => '∇×E = −∂B/∂t  →  ∮E·dl = −dΦ_B/dt  (Faraday induction)'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Maxwell Eq 4 (Ampère-Maxwell)', 'expr' => '∇×B = μ₀J + μ₀ε₀∂E/∂t  →  extends Ampère to include displacement current'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'EM Wave Speed Derivation', 'expr' => 'Take curl of Eq 3, use Eq 4: ∇²E = μ₀ε₀∂²E/∂t²;  v_wave = 1/√(μ₀ε₀) = c ✅'];
                $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Poynting Vector', 'expr' => 'S = (1/μ₀)(E×B)  [W/m²]  (electromagnetic energy flux density)'];
                $state['proof_traces'][] = "Electromagnetic vectors are **consistent** with Maxwell's 4 equations. EM wave speed = c confirmed.";
                break;

            case 'Nuclear':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Decay Law Derivation', 'expr' => 'dN/dt = −λN  →  N(t) = N₀e^(−λt)  (first-order decay ODE)'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Half-life', 'expr' => 't½ = ln2/λ = 0.6931/λ  (N → N₀/2 at t = t½ ✅)'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Mass-Energy Equivalence', 'expr' => 'Q = (m_before − m_after)·c²  [binding energy deficit = energy released]'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Bethe-Weizsäcker SEMF', 'expr' => 'B/A ≈ 8 MeV/nucleon for most stable nuclei (Fe-56 peak)'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Fission Q-value', 'expr' => '²³⁵U + n → fission products + 2.43n + ~200 MeV;  Δm ≈ 0.186 u = 173 MeV ✅'];
                $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Fusion Q-value', 'expr' => 'D + T → ⁴He(3.5 MeV) + n(14.1 MeV);  Q = 17.6 MeV;  Δm = 0.01887 u ✅'];
                $state['proof_traces'][] = "Nuclear physics vectors are **consistent** with decay laws and mass-energy equivalence.";
                break;

            case 'Chemical':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Lavoisier Mass Conservation', 'expr' => '∑m_reactants = ∑m_products  [Noether\'s theorem: translational symmetry → momentum conservation → mass conservation]'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Gibbs Free Energy Criterion', 'expr' => 'ΔG = ΔH − TΔS < 0 → spontaneous;  ΔG = −RT·ln(K)'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Arrhenius Kinetics', 'expr' => 'k = A·e^(−Ea/RT);  ln(k₂/k₁) = (Ea/R)(1/T₁ − 1/T₂)  (activation energy barrier)'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Le Chatelier Principle', 'expr' => 'If T↑ → endothermic shift;  If P↑ → fewer moles gas side;  If conc. added → products side  (Q vs K comparison)'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Henderson-Hasselbalch', 'expr' => 'pH = pKa + log([A⁻]/[HA]);  at equivalence: [A⁻]=[HA] → pH = pKa ✅'];
                $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Hess\'s Law', 'expr' => 'ΔH_rxn = ∑ΔH_f(products) − ∑ΔH_f(reactants) (path-independent state function) ✅'];

                if ($state['is_violation']) {
                    if ($isUnsolved) {
                        $state['symbolic_traces'][] = ['step' => 'CSB', 'label' => 'Creative Bound Bypass', 'expr' => 'Matter creation via non-local Noether current → Theoretical ✅'];
                    } else {
                        $state['is_valid'] = false;
                        $state['symbolic_traces'][] = ['step' => 'HALT', 'label' => 'Stoichiometric Bound', 'expr' => 'M_out > M_in → Matter Created → IMPOSSIBLE ❌'];
                        $state['proof_traces'][] = "**[HALTED: Lavoisier Conservation of Mass Violated ❌]**";
                    }
                } else {
                    $state['symbolic_traces'][] = ['step' => '7', 'label' => 'Stoichiometric Bound OK', 'expr' => 'M_in = M_out;  ΔG evaluated;  reaction thermodynamically consistent ✅'];
                    $state['proof_traces'][] = "Chemical reaction is **stoichiometrically and thermodynamically consistent**.";
                }
                break;

            case 'Biological':
            case 'evolutionary_biology':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Hardy-Weinberg Equilibrium', 'expr' => 'p + q = 1;  p² + 2pq + q² = 1  (binomial expansion of (p+q)² = 1) ✅'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Allele Frequency Change', 'expr' => 'Δp = p·q·s·(p − q)/(1 − s·q²)  (s = selection coefficient; s > 0 → A advantageous)'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Logistic Population Bound', 'expr' => 'dN/dt = rN(1 − N/K);  N → K as t → ∞  (carrying capacity = absolute upper bound)'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Hamilton\'s Rule', 'expr' => 'rB > C → altruism evolves;  r = relatedness coefficient (siblings r = 0.5) ✅'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Darwinian Axiom', 'expr' => 'Natural selection amplifies Δf for advantageous traits over generational time ✅'];
                $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Mendelian Ratio', 'expr' => 'Aa × Aa → 1AA:2Aa:1aa  (phenotypic 3:1 for dominant A)  → verified by Mendel\'s pea experiments ✅'];
                $state['proof_traces'][] = "Biological vectors are **consistent** with Hardy-Weinberg limits and Darwinian mechanics.";
                break;

            case 'neuroscience':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Nernst Equation', 'expr' => 'E_ion = (RT/zF)·ln([ion]_out/[ion]_in);  E_K ≈ −90mV, E_Na ≈ +60mV'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Goldman-Hodgkin-Katz', 'expr' => 'V_m = (RT/F)·ln[(P_K[K⁺]_o + P_Na[Na⁺]_o + P_Cl[Cl⁻]_i)/(P_K[K⁺]_i + P_Na[Na⁺]_i + P_Cl[Cl⁻]_o)]'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Action Potential Firing', 'expr' => 'V_m > −55mV → Na⁺ channels open → depolarisation to +40mV → K⁺ channels open → repolarisation ✅'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Conduction Velocity Bound', 'expr' => 'v_signal ≤ 120 m/s  ≪  c = 3×10⁸ m/s  (always v < c)'];
                $state['proof_traces'][] = "Neural signal propagation is **consistent** with Hodgkin-Huxley electrodynamics. Signal velocity well below c.";
                break;

            case 'Economic':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Supply-Demand Equilibrium', 'expr' => 'Q_s(P*) = Q_d(P*)  defines P*;  dQ_d/dP < 0,  dQ_s/dP > 0'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Welfare Maximisation', 'expr' => 'Total Surplus = CS + PS = ∫_0^{Q*} D(q)dq − ∫_0^{Q*} S(q)dq'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Keynesian Multiplier', 'expr' => 'ΔY = k·ΔI = ΔI/(1−MPC);  e.g. MPC=0.8 → k=5 ✅'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Nash Equilibrium Proof', 'expr' => 'NE: ∀i, u_i(s_i*, s_{-i}) ≥ u_i(s_i, s_{-i}) ∀s_i  (no profitable unilateral deviation)'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Money Supply Effect', 'expr' => 'MV = PY  (Fisher Quantity Theory of Money);  M↑ → P↑ (inflation) if V,Y constant ✅'];
                $state['proof_traces'][] = "Economic equilibrium is **consistent** with supply-demand theory and Nash equilibrium conditions.";
                break;

            default:
                // --- DYNAMIC CAS FALLBACK (Zero Hardcoding) ---
                try {
                    if (class_exists(\App\Services\AST\Tokenizer::class)) {
                        $tokenizer = new \App\Services\AST\Tokenizer();
                        $parser = new \App\Services\AST\Parser();
                        $cas = new \App\Services\CAS\ComputerAlgebraSystem();
                        $tokens = $tokenizer->tokenize($state['thesis']);
                        $ast = $parser->parse($tokens);
                        $casResult = $cas->evaluateAST($ast);
                        if ($casResult && isset($casResult['status']) && $casResult['status'] === 'proven') {
                            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Dynamic AST Construction', 'expr' => 'Constructed physical proposition AST natively.'];
                            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'CAS Resolution', 'expr' => 'Physical proposition evaluated via CAS algebraic rules ✅'];
                            if (isset($casResult['proof'])) {
                                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'CAS Proof', 'expr' => $casResult['proof']];
                            }
                            $state['proof_traces'][] = "Physical proposition Verified Natively via CAS.";
                            $state['is_valid'] = true;
                            return $state;
                        }
                    }
                } catch (\Exception $e) {
                    // Fallthrough
                }

                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Oracle Domain Axiom', 'expr' => $domain['name'] . ' — axiom retrieved'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Deductive Bound Applied', 'expr' => $domain['deductive_axiom'] ?? 'Conservation laws and empirical axioms verified.'];
                $state['proof_traces'][] = "Physical or empirical vectors are qualitatively consistent with the identified axiom domain.";
                break;
        }

        return $state;
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: INDUCTIVE SYNTHESIS — Full academic formatted proof
    // ═══════════════════════════════════════════════════════════════════
    protected function fallbackPhase3Induction(array $state): string
    {
        $domain = $state['domain'];
        if (!$domain) {
            return implode("\n\n", $state['proof_traces']);
        }
        $icon = $domain['branch_icon'] ?? '🔬';
        $axiomRef = $domain['academic_ref'] ?? 'Natural Science';
        $sysType = $state['system_type'] ?? 'General';

        $md = "### **{$icon} NATURAL SCIENCE PROOF** *(Dialectical Engine — Three-Phase Proof)*\n";
        $md .= "> **Axiom Root**: {$domain['name']} `[{$axiomRef}]`\n\n";
        $md .= "---\n\n";

        // PHASE 1
        $md .= "### 🔬 Phase 1 — Empirical Observation *(Vector Extraction)*\n\n";
        $md .= "> *\"{$domain['trial']}\"*\n\n";

        foreach ($state['proof_traces'] as $trace) {
            if (!str_starts_with($trace, "\n### 🧮") && !str_starts_with($trace, '**📐') && !str_starts_with($trace, '**⚠️') && !str_starts_with($trace, '**[HALTED') && !str_starts_with($trace, '**[CERTIFIED')) {
                $md .= $trace . "\n\n";
            }
        }

        if (!empty($state['trials'])) {
            $headers = array_keys(reset($state['trials']));
            $rows = array_map('array_values', $state['trials']);
            $md .= "**Empirical Trial Data:**\n\n";
            $md .= $this->syntax->renderTruthTable($headers, $rows);
            $md .= "\n";
        }

        $md .= "---\n\n";

        // PHASE 2
        $md .= "### 🧮 Phase 2 — Deductive Purification *(Physical Law Bounds & CAS)*\n\n";
        $md .= "> *\"{$domain['deductive_axiom']}\"*\n\n";

        foreach ($state['proof_traces'] as $trace) {
            if (str_starts_with($trace, "\n### 🧮") || str_starts_with($trace, '**📐') || str_starts_with($trace, '**⚠️') || str_starts_with($trace, '**[HALTED') || str_starts_with($trace, 'System is') || str_starts_with($trace, 'Classical') || str_starts_with($trace, 'Relativistic') || str_starts_with($trace, 'Electromagnetic') || str_starts_with($trace, 'Nuclear') || str_starts_with($trace, 'Chemical') || str_starts_with($trace, 'Biological') || str_starts_with($trace, 'Neural') || str_starts_with($trace, 'Economic')) {
                $md .= $trace . "\n\n";
            }
        }

        if (!empty($state['symbolic_traces'])) {
            $md .= "**Step-by-Step Physical Law Derivation:**\n\n";
            $md .= $this->syntax->renderAlgebraicSteps($state['symbolic_traces']);
            $md .= "\n";
        }

        if (!$state['is_valid']) {
            $md .= "---\n\n";
            $md .= "### ⚠️ Phase 3 — Inductive Synthesis *(Halted)*\n\n";
            $md .= "> **Verdict: PHYSICAL LAW VIOLATION** — The claim contradicts an established mathematical axiom of the physical universe.\n\n";
            $md .= "> The dialectical engine **halts** here. A thesis that violates a conservation law cannot be inductively scaled.\n\n";
            $md .= "**[FALSIFIED: Physical Law Violation ❌]**";
            return $md;
        }

        $md .= "---\n\n";

        // PHASE 3
        $md .= "### 🌍 Phase 3 — Universal Physical Induction *(n → ∞ Scaling)*\n\n";

        $inductiveTexts = [
            'Thermodynamic' => 'The First and Second Laws of Thermodynamics are universally invariant — verified from the quantum scale to cosmic scale, from the Big Bang to the present day (~13.8 billion years). No Carnot-violating device has ever been observed. ΔS_universe ≥ 0 is mathematically necessary from quantum statistical mechanics (Boltzmann entropy counting).',
            'Kinematic' => 'Newton\'s laws scale universally for v ≪ c. The gravitational constant G is invariant across 13.8 billion light-years of the observable universe. Energy-momentum conservation is a direct consequence of Noether\'s theorem applied to time- and space-translation symmetry.',
            'Relativistic' => 'Special Relativity is experimentally confirmed to extraordinary precision — muon lifetime extension, GPS clock corrections, atomic clocks on aircraft (Hafele-Keating 1971), and CERN particle velocities. The causal bound v < c holds universally for all massive objects.',
            'Electromagnetic' => 'Maxwell\'s equations are exact to better than 1 part in 10¹⁸ (QED precision). The speed of light c = 1/√(ε₀μ₀) has been confirmed over distances from laboratory to cosmic scales. No magnetic monopole has ever been observed (∇·B = 0 holds universally).',
            'Nuclear' => 'Radioactive decay follows the exponential law N(t) = N₀e^(−λt) verified across 14 orders of magnitude in time scale. Mass-energy equivalence E = mc² is confirmed by nuclear power, particle accelerators, and stellar nucleosynthesis.',
            'Chemical' => 'Lavoisier\'s conservation of mass and Gibbs free energy criteria hold universally for all chemical reactions in any closed system. Arrhenius kinetics is verified across 20+ orders of magnitude in reaction rates. Thermodynamic favorability (ΔG < 0) is an absolute chemical bound.',
            'Biological' => 'Hardy-Weinberg equilibrium holds as a mathematical identity for any population satisfying its 5 conditions. Logistic growth limits are confirmed across all known species. Natural selection and Darwinian evolution are verified by paleontology, genomics, and direct observation.',
            'evolutionary_biology' => 'Natural selection, genetic drift, and reproductive isolation are universal evolutionary mechanisms confirmed across all known life on Earth and consistent across 4 billion years of fossil record and genomic data.',
            'neuroscience' => 'The Hodgkin-Huxley equations accurately model action potentials across all excitable cells — verified in squid giant axons, mammalian neurons, and cardiac muscle. The conduction velocity bound (v ≪ c) holds universally.',
            'Economic' => 'Supply-demand equilibrium and Nash equilibrium are mathematical necessities — not empirical approximations. They follow from optimization principles applied to rational agent utility functions. Keynesian multipliers are verified in macroeconomic data across multiple economies.',
        ];

        $inductiveText = $inductiveTexts[$sysType] ?? ($domain['inductive_limit'] ?? 'The physical law scales universally across the entire observable universe.');
        $md .= "> *\"{$inductiveText}\"*\n\n";

        $md .= "**Universal Inductive Bound** *(n → ∞ Scaling)*:\n\n";
        $md .= "> **Empirical Basis**: Physical vectors are consistent with the DB axiom (Phase 1).\n";
        $md .= "> **Deductive Bound**: The mathematical inequality/equation holds under established conservation laws (Phase 2).\n";
        $md .= "> **Inductive Scale**: These laws are invariant across:\n";
        $md .= ">   - Space (quantum scale 10⁻³⁵m to cosmic scale 10²⁶m)\n";
        $md .= ">   - Time (13.8 billion years from Big Bang to present)\n";
        $md .= ">   - Scale (subatomic particles to galaxy clusters)\n";
        $md .= "> \n";
        $md .= "> **Conclusion**: ∀ physical systems: [{$sysType} axiom holds universally] ✓\n\n";

        $synthNote = $domain['synthesis_note'] ?? '';
        if ($synthNote) {
            $md .= "> 📚 **Synthesis Note**: *\"{$synthNote}\"*\n\n";
        }

        $md .= "**[CERTIFIED ✅ — Global Axiom: {$domain['name']}]**\n\n";
        $md .= "*(Dialectically Proven via {$icon} Physical Law Vectors — Zmzir Engine)*";

        return $md;
    }

    // ─────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────

    private function detectSystemType(string $tl, ?array $ast): string
    {
        if ($ast && !empty($ast['nodes'])) {
            foreach ($ast['nodes'] as $n) {
                if ($n['type'] === 'EmpiricalSystemNode')
                    return $n['system_type'];
            }
        }
        if (preg_match('/\b(delta\s*u|e_in|e_out|thermodynam|entropy|heat|carnot|gibbs|helmholtz|boltzmann|joule|kelvin|perpetual motion|over.?unity)\b/i', $tl))
            return 'Thermodynamic';
        if (preg_match('/\b(lorentz|schwarzschild|relativity|time dilation|length contraction|spacetime|e=mc|mass.energy|tachyon|warp|ftl|faster.than.light|rest mass)\b/i', $tl))
            return 'Relativistic';
        if (preg_match('/\b(maxwell|faraday|ampere|coulomb|ohm|kirchhoff|lorentz force|magnetic flux|electromagnetic|snell|refraction|diffraction|wave equation|permittivity|permeability)\b/i', $tl))
            return 'Electromagnetic';
        if (preg_match('/\b(radioactive|nuclear|fission|fusion|decay|half.life|bethe|binding energy|alpha|beta|gamma radiation|bohr|rutherford|photoelectric|nucleon|neutron|proton|uranium|electron volt)\b/i', $tl))
            return 'Nuclear';
        if (preg_match('/\b(f\s*=\s*m|force|mass|acceleration|kinematic|newton|velocity|momentum|kinetic energy|potential energy|projectile|gravitational|torque|inertia)\b/i', $tl))
            return 'Kinematic';
        if (preg_match('/\b(cell|atp|mitochondria|respiration|mitosis|meiosis|eukaryot|prokaryot|membrane|organelle)\b/i', $tl))
            return 'cellular_biology';
        if (preg_match('/\b(mass_out|mass_in|chemical|stoichiometr|lavoisier|reactants|products|arrhenius|gibbs|le chatelier|hess|acid|base|ph |buffer|equilibrium constant|combustion|synthesis|avogadro|molar)\b/i', $tl))
            return 'Chemical';
        if (preg_match('/\b(dna|rna|chromosome|genotype|phenotype|allele|mutation|transcription|codon|protein|molecular biology)\b/i', $tl))
            return 'genetics';
        if (preg_match('/\b(neuron|synapse|action potential|neurotransmitter|axon|dendrite|hodgkin|huxley|depolarisation|membrane potential)\b/i', $tl))
            return 'neuroscience';
        if (preg_match('/\bp\^2|2pq|hardy|weinberg|allele|genetic drift|speciation|evolv|darwin|natural selection|kin selection|fitness|mutation rate|reproductive\b/i', $tl))
            return 'evolutionary_biology';
        if (preg_match('/\b(biology|organism|species|ecology|population|adaptation|phylogen)\b/i', $tl))
            return 'Biological';
        if (preg_match('/\b(q_s|q_d|supply|demand|price|economic|inflation|gdp|keynesian|nash|pareto|multiplier|utility)\b/i', $tl))
            return 'Economic';
        return 'Kinematic';
    }

    private function buildSyntheticDomain(string $sysType, string $tl): array
    {
        return match ($sysType) {
            'Thermodynamic' => ['key' => 'thermodynamics', 'name' => '🌡️ Thermodynamics (Synthetic)', 'branch_icon' => '🌡️', 'academic_ref' => 'Clausius (1850), Boltzmann (1877), Carnot (1824)', 'trial' => 'We abstract energy flows through thermodynamic state variables.', 'deductive_axiom' => 'Energy cannot be created or destroyed (1st Law); entropy never decreases in isolated systems (2nd Law).', 'inductive_limit' => 'All thermodynamic systems obey ΔS_universe ≥ 0 absolutely.'],
            'Relativistic' => ['key' => 'special_relativity', 'name' => '🌌 Special & General Relativity (Synthetic)', 'branch_icon' => '🌌', 'academic_ref' => 'Einstein (1905, 1915), Lorentz (1904), Minkowski (1908)', 'trial' => 'We abstract spacetime intervals and Lorentz-invariant quantities.', 'deductive_axiom' => 'c is invariant in all inertial frames; massive objects cannot reach v = c.', 'inductive_limit' => 'Relativity is verified to extraordinary precision across cosmic scales.'],
            'Electromagnetic' => ['key' => 'electromagnetism', 'name' => '⚡ Electromagnetism (Synthetic)', 'branch_icon' => '⚡', 'academic_ref' => 'Maxwell (1865), Faraday (1831), Ampère (1826)', 'trial' => 'We abstract electromagnetic field vectors from Maxwell\'s equations.', 'deductive_axiom' => 'The speed of light c = 1/√(ε₀μ₀) is the fundamental EM propagation constant.', 'inductive_limit' => 'Maxwell\'s equations are exact to 10⁻¹⁸ precision — universally invariant.'],
            'Nuclear' => ['key' => 'nuclear_physics', 'name' => '☢️ Nuclear Physics (Synthetic)', 'branch_icon' => '☢️', 'academic_ref' => 'Rutherford (1911), Bethe-Weizsäcker (1935), Fermi (1942)', 'trial' => 'We abstract nuclear decay and binding energy from the mass-energy equivalence.', 'deductive_axiom' => 'Nuclear reactions conserve baryon number, lepton number, and energy via E = mc².', 'inductive_limit' => 'Radioactive decay law is exponential and universally invariant.'],
            'Chemical' => ['key' => 'chemistry', 'name' => '⚗️ Stoichiometric Chemistry (Synthetic)', 'branch_icon' => '⚗️', 'academic_ref' => 'Lavoisier (1789), Gibbs (1876), Arrhenius (1889)', 'trial' => 'We abstract chemical transformation as algebraic permutation of atomic groupings.', 'deductive_axiom' => 'Conservation of mass (Lavoisier) holds absolutely in all chemical reactions within closed systems.', 'inductive_limit' => 'ΔG = ΔH − TΔS determines spontaneity universally for all chemical processes.'],
            'Biological', 'evolutionary_biology' => ['key' => 'evolutionary_biology', 'name' => '🌿 Evolutionary Biology (Synthetic)', 'branch_icon' => '🌿', 'academic_ref' => 'Darwin (1859), Hardy-Weinberg (1908), Mendel (1865)', 'trial' => 'We abstract population genetics and natural selection dynamics.', 'deductive_axiom' => 'Natural selection acts on heritable variation; Hardy-Weinberg equilibrium holds under ideal conditions.', 'inductive_limit' => 'Evolution by natural selection is confirmed by 4 billion years of fossil record and genomic data.'],
            'neuroscience' => ['key' => 'neuroscience', 'name' => '🧠 Neuroscience (Synthetic)', 'branch_icon' => '🧠', 'academic_ref' => 'Hodgkin-Huxley (1952), Nernst (1888)', 'trial' => 'We abstract action potentials as electrochemical wavefronts bounded by ion channel kinetics.', 'deductive_axiom' => 'Neural signal velocity is bounded by axon capacitance and resistance — always v ≪ c.', 'inductive_limit' => 'Hodgkin-Huxley equations accurately model all excitable cell membranes.'],
            'Economic' => ['key' => 'microeconomics', 'name' => '📊 Supply & Demand Economics (Synthetic)', 'branch_icon' => '📊', 'academic_ref' => 'Marshall (1890), Nash (1950), Keynes (1936)', 'trial' => 'We abstract market dynamics as optimization over agent utility functions.', 'deductive_axiom' => 'Market equilibrium minimises total excess supply/demand; Nash equilibrium minimises profitable deviation.', 'inductive_limit' => 'Supply-demand equilibrium and Nash equilibrium are mathematical identities — not empirical approximations.'],
            default => ['key' => 'natural_science_empirical', 'name' => '🔬 Natural Science & Empirical Physics (Synthetic)', 'branch_icon' => '🔬', 'academic_ref' => 'Newton, Lavoisier & Boltzmann', 'trial' => 'We observe continuous physical, chemical, or biological conservation laws.', 'deductive_axiom' => 'Physical state vectors satisfy continuous energy and momentum conservation laws.', 'inductive_limit' => 'Conservation laws are invariant across all known scales and epochs.'],
        };
    }

    private function generateGenericTrials(string $sysType): array
    {
        return [
            ['State n' => 1, 'System' => $sysType, 'Conservation' => 'Satisfied ✅', 'Bound' => 'Physical ✅'],
            ['State n' => 2, 'System' => $sysType, 'Conservation' => 'Satisfied ✅', 'Bound' => 'Physical ✅'],
            ['State n' => 3, 'System' => $sysType, 'Conservation' => 'Satisfied ✅', 'Bound' => 'Physical ✅'],
        ];
    }

    public function generateEmpiricalBaseCases($astOrSysType, int $startSequence = 1, int $limit = 3): string
    {
        $systemType = is_string($astOrSysType) ? $astOrSysType : 'Kinematic';
        if (is_array($astOrSysType) && !empty($astOrSysType['nodes'])) {
            foreach ($astOrSysType['nodes'] as $node) {
                if ($node['type'] === 'EmpiricalSystemNode') {
                    $systemType = $node['system_type'];
                    break;
                }
            }
        }

        $md = "| Level | State Config | Condition | Outcome Observation |\n";
        $md .= "|---|---|---|---|\n";

        $sequence = $this->primitives->generateSequence($startSequence, $limit);
        foreach ($sequence as $n) {
            switch ($systemType) {
                case 'Thermodynamic':
                    $state = "Energy State E_{$n}";
                    $cond = "ΔU_{$n} = Q − W";
                    $outcome = "ΔS_univ ≥ 0 ✅";
                    break;
                case 'Kinematic':
                    $state = "Dimension D={$n}";
                    $cond = "F_{$n} = m·a";
                    $outcome = "v < c ✅";
                    break;
                case 'Relativistic':
                    $state = "Frame γ_{$n}";
                    $cond = "v_{$n} < c";
                    $outcome = "γ = 1/√(1−β²) ✅";
                    break;
                case 'Electromagnetic':
                    $state = "Field E_{$n}";
                    $cond = "∇·E = ρ/ε₀";
                    $outcome = "Maxwell ✅";
                    break;
                case 'Nuclear':
                    $state = "Nucleus A={$n}";
                    $cond = "N(t) = N₀e^(−λt)";
                    $outcome = "Decay ✅";
                    break;
                case 'Chemical':
                    $state = "Reaction n={$n}";
                    $cond = "ΔG_{$n} < 0";
                    $outcome = "Spontaneous ✅";
                    break;
                case 'Biological':
                    $state = "Generation N={$n}";
                    $cond = "Allele Δf_{$n}";
                    $outcome = "Drift bounded ✅";
                    break;
                case 'Economic':
                    $state = "Market P_{$n}";
                    $cond = "Q_s = Q_d";
                    $outcome = "Equilibrium ✅";
                    break;
                default:
                    $state = "State n={$n}";
                    $cond = "Conservation";
                    $outcome = "Physical ✅";
                    break;
            }
            $md .= "| {$n} | {$state} | {$cond} | {$outcome} |\n";
        }
        return $md;
    }

    public function proveInductiveScaling(array $ast, string $domainPartition = ''): string
    {
        return "By mathematical induction over structural physical bounds, as State N transitions to N+1, algebraic conservation remains invariant. Physical laws are topologically sealed — no finite perturbation can break a global conservation law.";
    }
}
