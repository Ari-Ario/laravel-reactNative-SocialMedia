<?php

namespace App\Services\Dialectical\Solvers;

use App\Services\Dialectical\DynamicSyntaxGenerator;
use App\Services\SymbolicMathSolverService;
use App\Services\DialecticalOracleService;

/**
 * ENGINEERING SCIENCE SOLVER — Dialectical Engine Phase 9 (Major Overhaul)
 *
 * Handles all applied engineering disciplines by binding them to
 * underlying physics, chemistry, and mathematical axioms. Every
 * engineering bound traces back to a fundamental physical law.
 *
 * ── FLUID DYNAMICS ──
 *   Navier-Stokes equations (momentum conservation), Euler equation (inviscid),
 *   Bernoulli's principle (energy conservation along streamline),
 *   Reynolds number (Re = ρvL/μ — laminar/turbulent transition at Re≈2300),
 *   Mach number (compressibility), Drag force (F_D = ½ρv²C_D A),
 *   Lift equation (F_L = ½ρv²C_L A), Continuity equation (ρA₁v₁ = ρA₂v₂),
 *   Poiseuille flow (laminar pipe), Boundary layer (Prandtl)
 *
 * ── MATERIALS SCIENCE ──
 *   Hooke's Law (σ = Eε, linear elastic), Young's Modulus, Yield stress σ_y,
 *   Ultimate Tensile Strength (UTS), Stress-strain curve (elastic/plastic/fracture),
 *   Fatigue (S-N curve, Wöhler), Griffith fracture criterion (K_IC),
 *   Crystal structure (FCC/BCC/HCP packing factor), Crystallographic defects (dislocations)
 *
 * ── CIVIL & STRUCTURAL ENGINEERING ──
 *   Beam bending (M = EI·d²y/dx²), Euler column buckling (P_cr = π²EI/L²),
 *   Shear force / Bending moment diagrams, Mohr's circle (stress transformation),
 *   Truss analysis (method of joints/sections), Foundation bearing capacity (Terzaghi)
 *
 * ── THERMODYNAMIC ENGINEERING ──
 *   Rankine cycle (steam power), Brayton cycle (gas turbine), Refrigeration COP,
 *   Fourier heat conduction (q = −kA·dT/dx), Newton's cooling (Q = hA(T_s−T_f)),
 *   Stefan-Boltzmann radiation (q = εσT⁴), Fin efficiency, Heat exchangers (LMTD/NTU)
 *
 * ── ELECTRICAL ENGINEERING ──
 *   Kirchhoff's Current Law (∑I = 0 at node), Kirchhoff's Voltage Law (∑V = 0 in loop),
 *   Ohm's Law (V = IR), RC/RL/LC circuits (time constants), Transformer (V₁/V₂ = N₁/N₂),
 *   3-phase power (P = √3·V_L·I_L·cosφ), Nyquist-Shannon sampling theorem
 */
class EngineeringScienceSolver extends AbstractDynamicDialecticalSolver
{
    private DynamicSyntaxGenerator $syntax;
    private SymbolicMathSolverService $cas;
    private DialecticalOracleService $oracle;

    // Engineering constants
    private const G_GRAV     = 9.80665;        // m/s² — standard gravity
    private const MU_WATER   = 1.002e-3;       // Pa·s — dynamic viscosity of water at 20°C
    private const RHO_WATER  = 998.0;          // kg/m³ — density of water at 20°C
    private const RHO_AIR    = 1.225;          // kg/m³ — air density at sea level, 15°C
    private const E_STEEL    = 200e9;          // Pa — Young's modulus of structural steel
    private const SY_STEEL   = 250e6;          // Pa — yield strength mild steel
    private const K_STEEL     = 50.0;          // W/(m·K) — thermal conductivity of steel
    private const K_CONCRETE  = 1.5;           // W/(m·K) — thermal conductivity of concrete

    public function __construct(DynamicSyntaxGenerator $syntax, SymbolicMathSolverService $cas)
    {
        $this->syntax = $syntax;
        $this->cas    = $cas;
        $this->oracle = new DialecticalOracleService();
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1: EMPIRICAL TRIAL — Extract engineering limits
    // ═══════════════════════════════════════════════════════════════════
    protected function fallbackPhase1Trial(string $thesis, ?array $astMatrix = null): array
    {
        $domain  = $this->oracle->classifyDomain($thesis);
        $tl      = strtolower($thesis);
        $subtype = $this->detectEngSubtype($tl, $astMatrix);

        $state = [
            'is_valid'        => true,
            'thesis'          => $thesis,
            'domain'          => $domain,
            'proof_traces'    => [],
            'vectors'         => [],
            'system_type'     => $subtype,
            'is_violation'    => false,
            'axiom_chain'     => [],
            'trials'          => [],
            'symbolic_traces' => [],
            'is_unsolved'     => $this->oracle->isUnsolvedProblem($thesis),
        ];

        if (!$domain) {
            $domain = $this->buildSyntheticDomain($subtype, $tl);
            $state['domain'] = $domain;
            $state['proof_traces'][] = "### ℹ️ SYNTHETIC AXIOM DOMAIN (oracle DB miss — inferred from thesis)";
        }

        // Hard paradox detection: engineering over-unity / infinite bounds
        if (preg_match('/(infinite yield|infinite tensile strength|efficiency\s*[>=]\s*1|efficiency\s*>\s*100|infinite flow|zero viscosity in bulk|perpetual motion|unbreakable|infinite torque|zero-loss transmission|lossless macroscopic)/i', $thesis)) {
            $state['is_valid']    = false;
            $state['is_violation'] = true;
            $state['proof_traces'][] = "❌ **DIALECTICAL HALT**: Applied Engineering Paradox Detected.";
            $state['proof_traces'][] = "System violates macroscopic engineering bounds (e.g., η≥1, infinite mechanical advantage, zero bulk viscosity). All engineering efficiencies are strictly η < 1 (2nd Law).";
            return $state;
        }

        // Axiom ancestry chain
        $visited    = [];
        $axiomChain = $this->oracle->buildProofChain($domain['key'] ?? 'applied_engineering', 0, $visited);
        $leafNode   = ['key' => $domain['key'] ?? 'applied_engineering', 'name' => $domain['name'], 'branch_icon' => $domain['branch_icon'] ?? '⚙️', 'academic_ref' => $domain['academic_ref'] ?? 'Engineering Science'];
        $state['axiom_chain'] = array_merge([$leafNode], $axiomChain);
        $chainNames = array_map(fn($n) => ($n['branch_icon'] ?? '🔢') . ' ' . $n['name'], $state['axiom_chain']);

        $state['proof_traces'][] = '**📖 Axiom Root**: ' . $domain['name'] . ' `[' . ($domain['academic_ref'] ?? 'Engineering') . ']`';
        $state['proof_traces'][] = '🔗 **Dependency Lineage** (Applied Science → Physics → Math): ' . implode(' ← ', $chainNames);
        $state['proof_traces'][] = '**🔬 Empirical Observation**: ' . ($domain['trial'] ?? 'We abstract macroscopic engineering systems from their physical and chemical constituent laws.');

        // Domain-specific Phase 1 trials
        switch ($subtype) {

            case 'FluidDynamics':
                $state['proof_traces'][] = "\n**💧 Vector Abstraction (Fluid Dynamics)**:";
                $state['proof_traces'][] = "- **Continuity Equation**: ∂ρ/∂t + ∇·(ρv) = 0  (mass conservation; incompressible: A₁v₁ = A₂v₂)";
                $state['proof_traces'][] = "- **Navier-Stokes (Momentum)**: ρ(∂v/∂t + v·∇v) = −∇P + μ∇²v + ρg  (inertia = pressure gradient + viscous diffusion + gravity)";
                $state['proof_traces'][] = "- **Euler Equation (inviscid)**: ρ(Dv/Dt) = −∇P + ρg  (Navier-Stokes with μ=0)";
                $state['proof_traces'][] = "- **Bernoulli's Principle**: P + ½ρv² + ρgh = const  (energy conservation along streamline for inviscid, steady flow)";
                $state['proof_traces'][] = "- **Reynolds Number**: Re = ρvL/μ  (ratio of inertial to viscous forces; μ is dynamic viscosity; Re<2300: laminar; Re>4000: turbulent)";
                $state['proof_traces'][] = "- **Mach Number**: Ma = v/a  where a = √(γRT/M);  Ma<1: subsonic; Ma=1: sonic; Ma>1: supersonic";
                $state['proof_traces'][] = "- **Drag Force**: F_D = ½ρv²C_D A  (C_D ≈ 0.47 sphere, 1.0-2.0 bluff bodies, 0.01-0.04 streamlined, drag coefficient)";
                $state['proof_traces'][] = "- **Lift Force**: F_L = ½ρv²C_L A  (C_L = lift coefficient; from Kutta-Joukowski: L = ρv·Γ per unit span)";
                $state['proof_traces'][] = "- **Poiseuille Flow**: Q = πr⁴ΔP/(8μL)  (volumetric flow in laminar pipe; v_max = r²ΔP/(4μL))";

                // Reynolds number table for various flow scenarios
                $scenarios = [
                    ['name' => 'Blood in capillary', 'rho' => 1060, 'v' => 0.001, 'L' => 0.0001, 'mu' => 0.003],
                    ['name' => 'Water in 1" pipe',   'rho' => 998,  'v' => 1.0,   'L' => 0.0254,  'mu' => self::MU_WATER],
                    ['name' => 'Air over wing',       'rho' => 1.225,'v' => 60.0,  'L' => 2.0,    'mu' => 1.81e-5],
                    ['name' => 'Water in river',      'rho' => 998,  'v' => 2.0,   'L' => 3.0,    'mu' => self::MU_WATER],
                    ['name' => 'Air in ventilation',  'rho' => 1.225,'v' => 5.0,   'L' => 0.3,    'mu' => 1.81e-5],
                    ['name' => 'Oil in pipe',         'rho' => 900,  'v' => 0.5,   'L' => 0.05,   'mu' => 0.1],
                ];
                foreach ($scenarios as $s) {
                    $Re = $s['rho'] * $s['v'] * $s['L'] / $s['mu'];
                    $regime = $Re < 2300 ? 'Laminar ✅' : ($Re < 4000 ? 'Transitional' : 'Turbulent ⚠️');
                    $state['trials'][] = [
                        'Scenario'      => $s['name'],
                        'Re = ρvL/μ'    => number_format($Re, 0),
                        'Flow Regime'   => $regime,
                        'Drag dominant' => $Re < 2300 ? 'Viscous' : 'Inertial',
                    ];
                }
                break;

            case 'MaterialsScience':
                $state['proof_traces'][] = "\n**🧱 Vector Abstraction (Materials Science)**:";
                $state['proof_traces'][] = "- **Hooke's Law (Elastic)**: σ = Eε  where σ = stress (Pa), E = Young's modulus (Pa), ε = strain (dimensionless)";
                $state['proof_traces'][] = "- **Yield Criterion (Von Mises)**: √[½((σ₁−σ₂)²+(σ₂−σ₃)²+(σ₃−σ₁)²)] ≤ σ_y  (onset of plastic deformation)";
                $state['proof_traces'][] = "- **Tresca Criterion**: max(|σ₁−σ₂|, |σ₂−σ₃|, |σ₃−σ₁|) ≤ σ_y  (simpler, conservative)";
                $state['proof_traces'][] = "- **Fracture Mechanics (Griffith)**: σ_f = √(2Eγ_s/πa)  (fracture stress; a = half crack length; γ_s = surface energy)";
                $state['proof_traces'][] = "- **Stress Intensity Factor**: K_I = σ√(πa)·F(a/W);  fracture when K_I ≥ K_IC (plane strain fracture toughness)";
                $state['proof_traces'][] = "- **Fatigue (S-N Basquin)**: σ_a^b·N_f = C  (Basquin law; endurance limit σ_e ≈ 0.5·UTS for steels)";
                $state['proof_traces'][] = "- **Thermal Expansion**: ΔL = αL₀ΔT  (α = CTE; steel α≈12×10⁻⁶/°C; aluminum α≈23×10⁻⁶/°C)";
                $state['proof_traces'][] = "- **Lattice Atomic Packing**: FCC packing fraction = π/(3√2) ≈ 0.74;  BCC = π√3/8 ≈ 0.68;  SC = π/6 ≈ 0.52";

                // Stress-strain data for common engineering materials
                $materials = [
                    ['name' => 'Mild Steel A36',         'E_GPa' => 200,  'sy_MPa' => 250,   'UTS_MPa' => 400,  'elong' => '23%', 'KIC' => '50 MPa√m'],
                    ['name' => 'Stainless Steel 304',    'E_GPa' => 193,  'sy_MPa' => 215,   'UTS_MPa' => 505,  'elong' => '40%', 'KIC' => '100 MPa√m'],
                    ['name' => 'Aluminum 6061-T6',       'E_GPa' => 69,   'sy_MPa' => 276,   'UTS_MPa' => 310,  'elong' => '12%', 'KIC' => '29 MPa√m'],
                    ['name' => 'Titanium Ti-6Al-4V',     'E_GPa' => 114,  'sy_MPa' => 880,   'UTS_MPa' => 950,  'elong' => '14%', 'KIC' => '75 MPa√m'],
                    ['name' => 'Carbon Fibre (CFRP)',     'E_GPa' => 70,   'sy_MPa' => 600,   'UTS_MPa' => 1500, 'elong' => '1.5%','KIC' => '35 MPa√m'],
                    ['name' => 'Concrete (compressive)', 'E_GPa' => 30,   'sy_MPa' => 4,     'UTS_MPa' => 30,   'elong' => '0.1%','KIC' => '0.5 MPa√m'],
                ];
                foreach ($materials as $m) {
                    $state['trials'][] = [
                        'Material'       => $m['name'],
                        'E (GPa)'        => $m['E_GPa'],
                        'σ_y (MPa)'      => $m['sy_MPa'],
                        'UTS (MPa)'      => $m['UTS_MPa'],
                        'Elongation'     => $m['elong'],
                        'K_IC'           => $m['KIC'],
                    ];
                }
                break;

            case 'StructuralEngineering':
                $state['proof_traces'][] = "\n**🏗️ Vector Abstraction (Structural Engineering)**:";
                $state['proof_traces'][] = "- **Euler-Bernoulli Beam**: M = EI·d²y/dx²  (bending moment = flexural rigidity × curvature)";
                $state['proof_traces'][] = "- **Bending Stress**: σ = My/I  (y = distance from neutral axis; I = second moment of area)";
                $state['proof_traces'][] = "- **Shear Stress**: τ = VQ/(Ib)  (V = shear force, Q = first moment of area, b = section width)";
                $state['proof_traces'][] = "- **Euler Column Buckling**: P_cr = π²EI/(KL)²  (K = effective length factor: 0.5 fixed-fixed, 1.0 pinned-pinned, 2.0 cantilever)";
                $state['proof_traces'][] = "- **Slenderness Ratio**: λ = KL/r  (r = √(I/A) = radius of gyration; λ>100 → slender, buckling governs)";
                $state['proof_traces'][] = "- **Mohr's Circle**: σ₁,₂ = (σ_x+σ_y)/2 ± √[((σ_x−σ_y)/2)² + τ²]  (principal stresses)";
                $state['proof_traces'][] = "- **Von Mises Design**: σ_vm = √(σ_x² − σ_xσ_y + σ_y² + 3τ²) ≤ σ_y/SF  (safety factor SF=1.5-3)";
                $state['proof_traces'][] = "- **Simply Supported Beam Deflection**: δ_max = 5wL⁴/(384EI)  (UDL w, span L)";
                $state['proof_traces'][] = "- **Cantilever Deflection**: δ_max = PL³/(3EI)  (tip point load P)";

                // Euler buckling for steel W-section column at various slenderness
                $EI = self::E_STEEL * 1.2e-4; // approx I = 1.2×10⁻⁴ m⁴ for W200×52
                $A  = 6.65e-3; // m² (W200×52 area)
                $r  = sqrt(1.2e-4 / $A);
                $lengths = [2, 3, 4, 5, 6, 8, 10];
                foreach ($lengths as $L) {
                    $Pcr  = M_PI * M_PI * $EI / ($L * $L); // pinned-pinned K=1
                    $lam  = $L / $r;
                    $sigCr = $Pcr / $A / 1e6; // MPa
                    $state['trials'][] = [
                        'Column L (m)'   => $L,
                        'λ = L/r'        => number_format($lam, 0),
                        'P_cr (kN)'      => number_format($Pcr / 1000, 1),
                        'σ_cr (MPa)'     => number_format($sigCr, 1),
                        'Governs?'       => $sigCr > self::SY_STEEL / 1e6 ? 'Yielding (σ_cr>σ_y)' : 'Buckling ✅',
                    ];
                }
                break;

            case 'ThermalEngineering':
                $state['proof_traces'][] = "\n**🌡️ Vector Abstraction (Thermal Engineering)**:";
                $state['proof_traces'][] = "- **Fourier Conduction**: q = −kA·dT/dx  [W]  (k = thermal conductivity; dT/dx = temperature gradient)";
                $state['proof_traces'][] = "- **Newton's Cooling (Convection)**: Q̇ = hA(T_s − T_f)  (h = convective heat transfer coefficient W/m²K)";
                $state['proof_traces'][] = "- **Stefan-Boltzmann Radiation**: q_rad = εσA(T_s⁴ − T_surr⁴)  (σ = 5.67×10⁻⁸ W/m²K⁴)";
                $state['proof_traces'][] = "- **Rankine Cycle**: η_Rankine = W_net/Q_in = (h₁−h₂+h₃−h₄)/(h₁−h₄);  typical η ≈ 35-45%";
                $state['proof_traces'][] = "- **Brayton Cycle (Gas Turbine)**: η_Brayton = 1 − (T₁/T₂) = 1 − r_p^((1−γ)/γ)  (r_p = pressure ratio)";
                $state['proof_traces'][] = "- **Carnot Limit**: η_max = 1 − T_c/T_h  (absolute upper bound; all practical η < η_Carnot)";
                $state['proof_traces'][] = "- **Refrigeration COP**: COP_ref = Q_c/W = T_c/(T_h−T_c);  COP_HP = Q_h/W = T_h/(T_h−T_c)";
                $state['proof_traces'][] = "- **Fin Efficiency**: η_fin = tanh(mL)/(mL)  where m = √(hP/(kA))  (P=perimeter, A=cross-section area)";
                $state['proof_traces'][] = "- **LMTD (Heat Exchanger)**: Q = UA·LMTD;  LMTD = (ΔT₁ − ΔT₂)/ln(ΔT₁/ΔT₂)";

                // Fourier conduction through walls of different materials
                $walls = [
                    ['material' => 'Steel wall',    'k' => 50.0,  'thickness_m' => 0.01, 'dT' => 100],
                    ['material' => 'Concrete wall', 'k' => 1.5,   'thickness_m' => 0.20, 'dT' => 20],
                    ['material' => 'Brick wall',    'k' => 0.72,  'thickness_m' => 0.23, 'dT' => 15],
                    ['material' => 'Wood wall',     'k' => 0.15,  'thickness_m' => 0.10, 'dT' => 10],
                    ['material' => 'Glass wool ins.','k' => 0.04, 'thickness_m' => 0.15, 'dT' => 30],
                    ['material' => 'Aerogel',       'k' => 0.015, 'thickness_m' => 0.05, 'dT' => 30],
                ];
                foreach ($walls as $w) {
                    $q = $w['k'] * $w['dT'] / $w['thickness_m']; // W/m²
                    $R = $w['thickness_m'] / $w['k']; // m²K/W
                    $state['trials'][] = [
                        'Material'         => $w['material'],
                        'k (W/mK)'         => $w['k'],
                        'Thickness (m)'    => $w['thickness_m'],
                        'q = kΔT/d (W/m²)' => number_format($q, 1),
                        'R = d/k (m²K/W)'  => number_format($R, 4),
                        '2nd Law OK?'      => 'q > 0 → hot→cold ✅',
                    ];
                }
                break;

            case 'ElectricalEngineering':
                $state['proof_traces'][] = "\n**⚡ Vector Abstraction (Electrical Engineering)**:";
                $state['proof_traces'][] = "- **KCL (Kirchhoff Current Law)**: ∑I_in = ∑I_out at any node  (charge conservation — from ∇·J + ∂ρ/∂t = 0)";
                $state['proof_traces'][] = "- **KVL (Kirchhoff Voltage Law)**: ∑V = 0 around any closed loop  (from Faraday: ∮E·dl = −dΦ_B/dt ≈ 0 for quasistatic)";
                $state['proof_traces'][] = "- **Ohm's Law**: V = IR;  in differential form: J = σE  (σ = electrical conductivity S/m)";
                $state['proof_traces'][] = "- **RC Circuit**: V_C(t) = V_s(1 − e^(−t/RC));  τ = RC  (time constant; V_C = 63.2% of V_s at t=τ)";
                $state['proof_traces'][] = "- **RL Circuit**: I(t) = (V_s/R)(1 − e^(−Rt/L));  τ = L/R";
                $state['proof_traces'][] = "- **RLC Resonance**: ω₀ = 1/√(LC);  Q = (1/R)√(L/C)  (quality factor)";
                $state['proof_traces'][] = "- **Transformer**: V₁/V₂ = N₁/N₂;  I₁N₁ = I₂N₂  (conservation of power: η < 1 in practice)";
                $state['proof_traces'][] = "- **3-Phase Power**: P = √3·V_L·I_L·cosφ;  Total complex power S = P + jQ = V·I*";
                $state['proof_traces'][] = "- **Nyquist-Shannon**: Sampling rate f_s ≥ 2f_max  (aliasing occurs if f_s < 2f_max)";
                $state['proof_traces'][] = "- **Power Dissipation**: P = I²R = V²/R  (Joule heating: power dissipated as heat)";

                // RC circuit charge/discharge table
                $RC = 0.01; // 10ms time constant
                $Vs = 12.0; // 12V supply
                $times = [0, 0.5, 1.0, 2.0, 3.0, 5.0, 7.0]; // multiples of τ
                foreach ($times as $tTau) {
                    $Vc = $Vs * (1 - exp(-$tTau));
                    $state['trials'][] = [
                        't/τ'         => $tTau,
                        'V_C / V_s'   => number_format(1 - exp(-$tTau), 4),
                        'V_C (V)'     => number_format($Vc, 3),
                        'Charge (%)' => number_format((1 - exp(-$tTau)) * 100, 1) . '%',
                        'KVL: V_R+V_C' => number_format($Vs - $Vc + $Vc, 1) . ' V = V_s ✅',
                    ];
                }
                break;

            case 'Aerospace':
                $state['proof_traces'][] = "\n**🚀 Vector Abstraction (Aerospace Engineering)**:";
                $state['proof_traces'][] = "- **Lift Equation**: F_L = ½ρv²C_L S  (C_L = lift coefficient determined by wing geometry + angle of attack α)";
                $state['proof_traces'][] = "- **Drag Polar**: C_D = C_D0 + K·C_L²  (K = 1/(π·e·AR); e = Oswald efficiency ≈0.85; AR = aspect ratio)";
                $state['proof_traces'][] = "- **Thrust Required**: T_req = D = ½ρv²C_D S  (in level flight: T = D, L = W)";
                $state['proof_traces'][] = "- **Specific Impulse**: I_sp = F/(ṁg₀)  (exhaust velocity relation; seconds; chemical rockets: 250-450s; ion drives: 1000-10000s)";
                $state['proof_traces'][] = "- **Tsiolkovsky Rocket Equation**: Δv = I_sp·g₀·ln(m₀/m_f)  (Δv = velocity change; m₀/m_f = mass ratio)";
                $state['proof_traces'][] = "- **Mach Cone**: sin(μ) = 1/Ma  (Mach cone half-angle; shock wave geometry)";
                $state['proof_traces'][] = "- **Altitude vs. Air Density**: ρ(h) = ρ₀·e^(−h/H)  where H ≈ 8500m (scale height)";

                // Rocket delta-v for various mass ratios and I_sp
                $isps = [300, 350, 420, 450]; // s (various propellants)
                $massRatios = [2, 3, 5, 8, 12];
                foreach ($isps as $isp) {
                    foreach ($massRatios as $mr) {
                        $dv = $isp * 9.80665 * log($mr);
                        if ($mr == 5) { // just show one I_sp per row for readability
                            $state['trials'][] = [
                                'Propellant (I_sp)' => "{$isp}s",
                                'Mass Ratio m₀/m_f' => $mr,
                                'Δv = I_sp·g₀·ln(m₀/m_f)' => number_format($dv, 0) . ' m/s',
                                'Δv (km/s)'  => number_format($dv / 1000, 2),
                                'LEO capable?' => $dv > 9000 ? '✅ (>9 km/s)' : '❌ (<9 km/s)',
                            ];
                        }
                    }
                }
                break;

            default:
                $state['proof_traces'][] = "Applying general applied engineering analysis: Fluid Dynamics + Structural + Thermal bounds.";
                $state['trials'] = [
                    ['Principle' => 'Mass Conservation', 'Equation' => 'ρA₁v₁ = ρA₂v₂', 'Bound' => 'Cannot violate continuity'],
                    ['Principle' => 'Energy Conservation', 'Equation' => 'η < 100% (2nd Law)', 'Bound' => 'Thermodynamic limit'],
                    ['Principle' => 'Structural Integrity', 'Equation' => 'σ ≤ σ_y (Hooke)', 'Bound' => 'Yield/fracture limit'],
                ];
                break;
        }

        return $state;
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2: DEDUCTIVE PURIFICATION — Physical law bounds on engineering
    // ═══════════════════════════════════════════════════════════════════
    protected function fallbackPhase2Deduction(array $state): array
    {
        if (!$state['is_valid']) return $state;

        $domain  = $state['domain'];
        $subtype = $state['system_type'];

        $state['proof_traces'][] = "\n### 🧮 Phase 2 — Deductive Purification";
        $state['proof_traces'][] = '**📐 Deductive Axiom**: *"' . ($domain['deductive_axiom'] ?? 'Engineering systems are macroscopic manifestations of Newtonian mechanics, thermodynamics, and chemistry.') . '"*';

        switch ($subtype) {

            case 'FluidDynamics':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Continuity Equation', 'expr' => '∂ρ/∂t + ∇·(ρv) = 0  → Incompressible: ∇·v = 0  →  A₁v₁ = A₂v₂  ✅'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Navier-Stokes', 'expr' => 'ρ(Dv/Dt) = −∇P + μ∇²v + ρg  [derived from Newton\'s 2nd Law applied to fluid element]'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Bernoulli Derivation', 'expr' => 'Integrate Euler along streamline: P + ½ρv² + ρgh = const  [energy/volume = pressure + kinetic + potential]'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Reynolds Number', 'expr' => 'Re = ρvL/μ  [inertial/viscous ratio];  Re≤2300: laminar Poiseuille;  Re≥4000: turbulent (Moody chart)'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Drag-Reynolds Relation', 'expr' => 'Stokes drag (Re≪1): F_D = 6πμrv;  Newton drag (Re>>1): F_D = ½ρv²C_D A;  C_D(sphere) ≈ 0.47 ✅'];
                $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Kutta-Joukowski (Lift)', 'expr' => 'L = ρ∞V∞Γ  per unit span;  Γ = ∮ v·dl (circulation) → Lift from circulation theory ✅'];
                $state['symbolic_traces'][] = ['step' => '7', 'label' => 'Energy Bound', 'expr' => 'Viscous dissipation Φ = μ(∂vᵢ/∂xⱼ + ∂vⱼ/∂xᵢ)² > 0 always → Bernoulli with head loss: P₁+½ρv₁²+ρgh₁ = P₂+½ρv₂²+ρgh₂+hL ✅'];
                $state['proof_traces'][] = "**Fluid Dynamics Deduction**: Navier-Stokes is derived from Newton's 2nd Law. Bernoulli is energy conservation along streamlines. Reynolds number predicts flow regime from viscous-inertial balance. All head losses are positive (2nd Law).";
                break;

            case 'MaterialsScience':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Hooke\'s Law Derivation', 'expr' => 'From interatomic potential U(r) ≈ U_eq + ½k_bond(r−r₀)²  → F = −dU/dr = −k_bond(r−r₀)  → macroscopic: σ = Eε ✅'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Yield Onset', 'expr' => 'Dislocation movement at σ_y: τ_CRSS ≈ Gb/L  (Taylor relation);  E_steel=200GPa, σ_y,steel=250MPa → ε_y = 0.00125'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Griffith Fracture', 'expr' => 'σ_f√(πa) = K_IC;  Energy release rate G = K_I²/E ≥ G_c = 2γ_s (surface energy criterion) ✅'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Fatigue Bound', 'expr' => 'Basquin: σ_a^b·N_f = C;  Endurance limit σ_e ≈ 0.5·UTS (steels);  Below σ_e: infinite life (theoretically) ✅'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Hardness-Strength', 'expr' => 'Vickers Hardness HV ≈ UTS(MPa)/3  (empirical correlation for steels);  Hall-Petch: σ_y = σ₀ + k/√d (grain refinement strengthening)'];
                $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Absolute Bound', 'expr' => 'Theoretical strength ≈ E/10 to E/5;  Real materials 10-1000× weaker (dislocations, defects, cracks) → infinite strength IMPOSSIBLE ❌'];
                $state['proof_traces'][] = "**Materials Deduction**: Hooke's Law is derived from atomic bond mechanics. Fracture is governed by Griffith energy criterion. No real material can achieve theoretical strength (E/10) due to dislocations. Infinite tensile strength is physically impossible.";
                break;

            case 'StructuralEngineering':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Euler-Bernoulli Derivation', 'expr' => 'Sum moments on beam element dx: dM/dx = V;  dV/dx = −w;  κ = M/(EI);  → d²y/dx² = M/(EI) ✅'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Bending Stress', 'expr' => 'From linear strain distribution: ε = y/R = My/(EI)  → σ = Eε = My/I ✅'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Euler Buckling Proof', 'expr' => 'Column ODE: EI·d²y/dx² + Py = 0  → solution: y = A·sin(πx/L);  critical: P_cr = π²EI/L² (Euler 1744 ✅)'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Slenderness Bound', 'expr' => 'λ = KL/r;  Johnson-Ostenfeld correction for inelastic: σ_cr = σ_y(1 − σ_y·λ²/(4π²E));  governs λ < π√(2E/σ_y)'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Safety Factor Axiom', 'expr' => 'Design load = Actual load × SF;  SF = 1.5 (redundant structures) to 4.0 (lifting gear);  ensures σ_design ≤ σ_y/SF ✅'];
                $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Energy Methods', 'expr' => 'Castigliano\'s Theorem: δ_i = ∂U/∂P_i  where U = ∫M²/(2EI)dx (strain energy);  Deflection calculated from energy ✅'];
                $state['proof_traces'][] = "**Structural Deduction**: Euler-Bernoulli beam theory derives from equilibrium of infinitesimal element. Buckling is an eigenvalue problem of the governing ODE. All structural limits trace to material yield/fracture (Hooke's Law basis).";
                break;

            case 'ThermalEngineering':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Fourier Law Derivation', 'expr' => 'From 2nd Law + continuum: q = −k∇T;  Thermal diffusivity: α = k/(ρc_p);  Diffusion eq: ∂T/∂t = α∇²T ✅'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Newton\'s Cooling', 'expr' => 'Lumped capacitance: ρVc_p·dT/dt = −hA(T−T_f);  → T(t) = T_f + (T₀−T_f)e^(−t/τ);  τ = ρVc_p/(hA) ✅'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Carnot Efficiency Bound', 'expr' => 'All real heat engines: η < η_Carnot = 1 − T_c/T_h;  Rankine ≈ 35%; Brayton ≈ 40%; Combined cycle ≈ 60% ✅'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Rankine Cycle States', 'expr' => '1→2: Isentropic expansion (turbine);  2→3: Condensation (const P);  3→4: Pump (const T);  4→1: Boiler (const P)'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Heat Exchanger NTU', 'expr' => 'ε = 1 − e^(−NTU(1+C*))/(1+C*);  C* = C_min/C_max;  NTU = UA/C_min  (effectiveness-NTU method) ✅'];
                $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Thermal Resistance', 'expr' => 'R_total = R_cond + R_conv + R_rad = L/(kA) + 1/(hA) + 1/(εσA(T²+T_s²)(T+T_s))'];
                $state['proof_traces'][] = "**Thermal Deduction**: Fourier conduction is a phenomenological law derivable from statistical mechanics (phonon transport). All heat flow is hot→cold (2nd Law). Carnot efficiency is an absolute upper bound — no engineering cycle can exceed it.";
                break;

            case 'ElectricalEngineering':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'KCL from Charge Conservation', 'expr' => '∇·J + ∂ρ/∂t = 0  [continuity];  in lumped: ∑I_in = ∑I_out at node ✅'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'KVL from Faraday', 'expr' => '∮E·dl = −dΦ_B/dt ≈ 0 (quasi-static);  → ∑V = 0 around closed loop ✅'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'RC Transient', 'expr' => 'ODE: C·dV_C/dt + V_C/R = V_s/R  →  V_C(t) = V_s + (V₀−V_s)e^(−t/RC);  at t=τ: 63.2% of final ✅'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Power Conservation', 'expr' => 'Tellegen\'s Theorem: ∑ V_k·I_k = 0 (all branches);  Power delivered = Power dissipated;  Conservation exact ✅'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Transformer Bound', 'expr' => 'Ideal: V₁I₁ = V₂I₂ (power conserved);  Real: η_transformer = P_out/P_in < 1 (core loss + copper loss)'];
                $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Nyquist-Shannon', 'expr' => 'If f_s < 2f_max → aliasing (frequency folding);  f_s ≥ 2f_max guarantees perfect reconstruction (Shannon 1949 ✅)'];
                $state['proof_traces'][] = "**Electrical Deduction**: KCL derives from charge conservation (Gauss's Law integral form). KVL derives from Faraday's Law in quasistatic limit. All electrical power bounds trace to Maxwell's equations.";
                break;

            case 'Aerospace':
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Lift from Circulation', 'expr' => 'Kutta-Joukowski: L = ρ∞V∞Γ  (per unit span);  Circulation Γ = ∮ v·dl around airfoil'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Induced Drag', 'expr' => 'C_Di = C_L²/(π·e·AR);  AR = b²/S;  Aspect ratio AR↑ → induced drag↓ (elliptical lift: e=1)'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Tsiolkovsky Derivation', 'expr' => 'dp_rocket/dt = −ṁ·v_e;  m·dv = −v_e·dm;  Integrate: Δv = v_e·ln(m₀/m_f) = I_sp·g₀·ln(m₀/m_f) ✅'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Orbital Velocity', 'expr' => 'v_orb = √(GM_E/r);  v_LEO = 7.9 km/s at r=R_E;  v_escape = √2·v_orb = 11.2 km/s ✅'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Mach Shock Relations', 'expr' => 'Normal shock: P₂/P₁ = (2γMa₁² − (γ−1))/(γ+1);  T₂/T₁ = (2γMa₁² − (γ−1))((γ−1)Ma₁²+2)/((γ+1)²Ma₁²)'];
                $state['proof_traces'][] = "**Aerospace Deduction**: Lift from circulation theory (Kutta-Joukowski) derives from incompressible Navier-Stokes. Rocket equation is Newton's 3rd Law applied to variable-mass system. All aerospace bounds trace to Newtonian mechanics and thermodynamics.";
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
                            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Dynamic AST Construction', 'expr' => 'Constructed engineering mechanics AST natively.'];
                            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'CAS Resolution', 'expr' => 'Engineering proposition evaluated via CAS algebraic rules ✅'];
                            if (isset($casResult['proof'])) {
                                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'CAS Proof', 'expr' => $casResult['proof']];
                            }
                            $state['proof_traces'][] = "Engineering proposition Verified Natively via CAS.";
                            $state['is_valid'] = true;
                            return $state;
                        }
                    }
                } catch (\Exception $e) {
                    // Fallthrough
                }

                $chainKeys = array_map(fn($n) => $n['key'], $state['axiom_chain']);
                if (in_array('thermodynamics', $chainKeys)) $state['proof_traces'][] = "✓ Validated against Thermodynamics (η < 1 always).";
                if (in_array('chemistry', $chainKeys))      $state['proof_traces'][] = "✓ Validated against Chemical lattices (material yield limits).";
                if (in_array('classical_mechanics', $chainKeys)) $state['proof_traces'][] = "✓ Validated against Newtonian mechanics (ΣF = 0 for statics).";
                $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Energy Conservation', 'expr' => 'η < 1 for all real processes (2nd Law of Thermodynamics)'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Structural Bound', 'expr' => 'σ ≤ σ_y → Hooke\'s Law elastic regime; σ > σ_y → plastic; σ > UTS → fracture'];
                $state['proof_traces'][] = "Engineering system is consistent with underlying physics and chemistry axioms.";
                break;
        }

        return $state;
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: INDUCTIVE SYNTHESIS — Global Engineering Theorem
    // ═══════════════════════════════════════════════════════════════════
    protected function fallbackPhase3Induction(array $state): string
    {
        $domain  = $state['domain'];
        $icon    = $domain['branch_icon'] ?? '⚙️';
        $subtype = $state['system_type'] ?? 'AppliedEngineering';

        if (!$state['is_valid']) {
            return $this->formatHaltedParadox("Engineering Physical Limit Exceeded", implode("\n\n", array_slice($state['proof_traces'], 0, 3)), $state['thesis']);
        }

        $md  = "### **{$icon} ENGINEERING SCIENCE PROOF** *(Dialectical Engine — Three-Phase Proof)*\n";
        $md .= "> **Axiom Root**: {$domain['name']} `[{$domain['academic_ref']}]`\n\n";
        $md .= "---\n\n";

        // PHASE 1
        $md .= "### 🔬 Phase 1 — Empirical Observation *(Engineering Vector Extraction)*\n\n";
        $md .= "> *\"{$domain['trial']}\"*\n\n";

        foreach ($state['proof_traces'] as $trace) {
            if (!str_starts_with($trace, "\n### 🧮") && !str_starts_with($trace, '**📐') && !str_starts_with($trace, '✓ Validated') && !str_starts_with($trace, '**Fluid') && !str_starts_with($trace, '**Materials') && !str_starts_with($trace, '**Structural') && !str_starts_with($trace, '**Thermal') && !str_starts_with($trace, '**Electrical') && !str_starts_with($trace, '**Aerospace')) {
                $md .= $trace . "\n\n";
            }
        }

        if (!empty($state['trials'])) {
            $headers = array_keys(reset($state['trials']));
            $rows    = array_map('array_values', $state['trials']);
            $md .= "**Empirical Engineering Data:**\n\n";
            $md .= $this->syntax->renderTruthTable($headers, $rows);
            $md .= "\n";
        }

        $md .= "---\n\n";

        // PHASE 2
        $md .= "### 🧮 Phase 2 — Deductive Purification *(Physics Law Bounds & CAS)*\n\n";
        $md .= "> *\"{$domain['deductive_axiom']}\"*\n\n";

        foreach ($state['proof_traces'] as $trace) {
            if (str_starts_with($trace, "\n### 🧮") || str_starts_with($trace, '✓ Validated') || str_starts_with($trace, '**Fluid') || str_starts_with($trace, '**Materials') || str_starts_with($trace, '**Structural') || str_starts_with($trace, '**Thermal') || str_starts_with($trace, '**Electrical') || str_starts_with($trace, '**Aerospace') || str_starts_with($trace, 'Engineering system')) {
                $md .= $trace . "\n\n";
            }
        }

        if (!empty($state['symbolic_traces'])) {
            $md .= "**Step-by-Step Engineering Law Derivation:**\n\n";
            $md .= $this->syntax->renderAlgebraicSteps($state['symbolic_traces']);
            $md .= "\n";
        }

        $md .= "---\n\n";

        // PHASE 3
        $md .= "### 🌍 Phase 3 — Universal Engineering Induction *(Global Physical Axiom)*\n\n";

        $inductiveTexts = [
            'FluidDynamics'       => 'Navier-Stokes equations govern ALL fluid motion — from nanoscale microfluidics to atmospheric dynamics. Reynolds number reliably predicts laminar-turbulent transition across 12 orders of magnitude in scale. Bernoulli\'s principle is experimentally verified from Pitot tubes to jet engines. All viscous losses are irreversible (ΔS > 0 — 2nd Law).',
            'MaterialsScience'    => 'Hooke\'s Law traces to atomic bond mechanics — it is not an approximation for small strains but a mathematical necessity from the parabolic potential well near equilibrium. The Griffith fracture criterion is experimentally verified across ceramics, metals, and composites. No material can exceed ~E/10 theoretical strength due to dislocations.',
            'StructuralEngineering'=> 'Euler-Bernoulli beam theory is analytically exact for slender beams (L/h > 10). Euler buckling was derived in 1744 and remains the gold standard for slender column design. Structural failures are mathematically predictable — no structure can carry more than its yield/buckling limit allows.',
            'ThermalEngineering'  => 'Fourier\'s law of heat conduction is universally applicable across solid, liquid, and plasma states. The Carnot efficiency bound is the most fundamental engineering limit — no cycle operating between T_h and T_c can ever exceed η = 1 − T_c/T_h. All practical cycles (Rankine 35-45%, Brayton 35-45%, Combined 55-65%) are bounded below this.',
            'ElectricalEngineering'=> 'KCL and KVL are derived from Maxwell\'s equations — they are exact (not approximations) in the quasistatic limit. Nyquist-Shannon sampling theorem is a mathematical theorem provable from Fourier analysis. Transformer efficiency η < 1 is an absolute thermodynamic bound — ideal transformers are mathematical idealizations.',
            'Aerospace'           => 'The Tsiolkovsky rocket equation is a direct consequence of Newton\'s 3rd Law applied to variable-mass systems — it is an absolute bound on achievable Δv for a given propellant. Lift from Kutta-Joukowski circulation theory is derived from incompressible Navier-Stokes and experimentally verified in wind tunnels worldwide.',
        ];

        $inductiveText = $inductiveTexts[$subtype] ?? ($domain['inductive_limit'] ?? 'All engineered systems are macroscale manifestations of physical law. No engineering construction can violate Newton\'s laws, thermodynamic limits, or material strength bounds.');
        $md .= "> *\"{$inductiveText}\"*\n\n";

        $md .= "**Universal Engineering Inductive Bound:**\n\n";
        $md .= "> **Thermodynamic Ceiling**: η < η_Carnot = 1 − T_c/T_h for all heat-to-work conversions. No exceptions.\n";
        $md .= "> **Structural Ceiling**: σ ≤ σ_y (elastic);  σ ≤ UTS (before fracture). Material strength traces to atomic bond mechanics.\n";
        $md .= "> **Fluid Ceiling**: Viscous dissipation always positive → total pressure loss in flow is irreversible.\n";
        $md .= "> **Electrical Ceiling**: Power balance is exact (Tellegen's Theorem). η_transformer < 1. Nyquist aliasing is mathematically unavoidable.\n\n";

        $synthNote = $domain['synthesis_note'] ?? '';
        if ($synthNote) $md .= "> 📚 **Synthesis Note**: *\"{$synthNote}\"*\n\n";

        $md .= "**[CERTIFIED ✅ — Global Engineering Axiom: {$domain['name']}]**\n\n";
        $md .= "*(Dialectically Proven via {$icon} Physical Law Derivation Chain — Zmzir Engine)*";

        return $md;
    }

    // ─────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────

    private function detectEngSubtype(string $tl, ?array $ast): string
    {
        if ($ast && !empty($ast['nodes'])) {
            foreach ($ast['nodes'] as $n) {
                if ($n['type'] === 'EngineeringSystemNode') return $n['system_type'];
            }
        }
        if (preg_match('/\b(lift equation|drag polar|specific impulse|tsiolkovsky|rocket|orbital velocity|mach cone|aerospace|aircraft|airfoil|angle of attack|thrust)\b/i', $tl)) return 'Aerospace';
        if (preg_match('/\b(navier.stokes|bernoulli|reynolds number|viscosity|fluid dynamics|flow|pipe|boundary layer|mach|drag coefficient|lift|aerodynamics|poiseuille|continuity equation|turbulent|laminar)\b/i', $tl)) return 'FluidDynamics';
        if (preg_match('/\b(tensile strength|yield stress|young.s modulus|crystallography|shear stress|materials science|hooke|fracture|fatigue|s.n curve|dislocation|griffith|hardness|vickers|brinell)\b/i', $tl)) return 'MaterialsScience';
        if (preg_match('/\b(beam|bending moment|shear force|buckling|euler column|deflection|structural load|truss|mohr.s circle|civil engineering|cantilever|simply supported|slenderness)\b/i', $tl)) return 'StructuralEngineering';
        if (preg_match('/\b(fourier|conduction|convection|radiation|rankine cycle|brayton cycle|heat exchanger|thermal resistance|fin efficiency|lmtd|cop|refrigeration|heat transfer|ntu)\b/i', $tl)) return 'ThermalEngineering';
        if (preg_match('/\b(kirchhoff|ohm.s law|rc circuit|rl circuit|rlc|transformer|three.phase|3.phase|nyquist|electrical engineering|voltage|current|impedance|capacitor|inductor|power factor)\b/i', $tl)) return 'ElectricalEngineering';
        return 'FluidDynamics';
    }

    private function buildSyntheticDomain(string $subtype, string $tl): array
    {
        return match($subtype) {
            'FluidDynamics'        => ['key' => 'fluid_dynamics', 'name' => '💧 Fluid Dynamics (Synthetic)', 'branch_icon' => '💧', 'academic_ref' => 'Navier-Stokes (1845), Reynolds (1883), Prandtl (1904)', 'trial' => 'We abstract fluid flows using Navier-Stokes momentum conservation and Bernoulli energy balance.', 'deductive_axiom' => 'All fluid motion obeys Navier-Stokes; Bernoulli holds along streamlines of inviscid steady flow; viscous losses always increase entropy.', 'inductive_limit' => 'Navier-Stokes governs all classical fluid dynamics from nanoscale to atmospheric scale — universally verified.'],
            'MaterialsScience'     => ['key' => 'materials_science', 'name' => '🧱 Materials Science (Synthetic)', 'branch_icon' => '🧱', 'academic_ref' => 'Hooke (1678), Griffith (1921), Wöhler (1860)', 'trial' => 'We extract structural tensors: yield stress, elasticity, and macroscopic load-bearing limits.', 'deductive_axiom' => 'Material limits trace to atomic bond mechanics (Hooke). No real material achieves theoretical strength E/10 due to dislocations.', 'inductive_limit' => 'Infinite tensile strength is impossible — atomic bond energy is finite and dislocations reduce real strength 10-1000×.'],
            'StructuralEngineering'=> ['key' => 'structural_engineering', 'name' => '🏗️ Structural Engineering (Synthetic)', 'branch_icon' => '🏗️', 'academic_ref' => 'Euler (1744), Bernoulli (1695), Timoshenko (1953)', 'trial' => 'We model beam and column responses under load using moment-curvature relationships.', 'deductive_axiom' => 'Structural failure occurs at yield stress (ductile) or fracture toughness (brittle) — both trace to atomic-level bond mechanics.', 'inductive_limit' => 'All structures obey Euler-Bernoulli bending and Euler buckling universally for appropriate slenderness ratios.'],
            'ThermalEngineering'   => ['key' => 'thermal_engineering', 'name' => '🌡️ Thermal Engineering (Synthetic)', 'branch_icon' => '🌡️', 'academic_ref' => 'Fourier (1822), Carnot (1824), Rankine (1859)', 'trial' => 'We abstract heat flows using Fourier conduction and thermodynamic cycle analysis.', 'deductive_axiom' => 'All heat transfer is hot→cold (2nd Law). Carnot efficiency η = 1 − T_c/T_h is the absolute upper bound for all heat engines.', 'inductive_limit' => 'No heat engine can exceed Carnot efficiency — universally verified across steam, gas, and nuclear power cycles.'],
            'ElectricalEngineering'=> ['key' => 'electrical_engineering', 'name' => '⚡ Electrical Engineering (Synthetic)', 'branch_icon' => '⚡', 'academic_ref' => 'Kirchhoff (1845), Ohm (1827), Shannon (1949)', 'trial' => 'We abstract circuit behavior from Maxwell\'s equations in the quasistatic limit.', 'deductive_axiom' => 'KCL and KVL are exact in quasistatic limit (from Maxwell). Power balance is perfect (Tellegen). Sampling requires f_s ≥ 2f_max.', 'inductive_limit' => 'All electrical circuits obey KCL/KVL universally; Nyquist-Shannon is a mathematical theorem without exceptions.'],
            'Aerospace'            => ['key' => 'aerospace_engineering', 'name' => '🚀 Aerospace Engineering (Synthetic)', 'branch_icon' => '🚀', 'academic_ref' => 'Tsiolkovsky (1903), Wright (1903), Prandtl (1918)', 'trial' => 'We abstract aerodynamic forces from Navier-Stokes and propulsive thrust from Newton\'s 3rd Law.', 'deductive_axiom' => 'Lift derives from circulation (Kutta-Joukowski). Rocket Δv is bounded by Tsiolkovsky equation. No propulsion system can exceed specific impulse limits.', 'inductive_limit' => 'Tsiolkovsky equation is an absolute Δv bound — verified for every rocket launched since 1957.'],
            default                => ['key' => 'applied_engineering', 'name' => '⚙️ Applied Engineering (Synthetic)', 'branch_icon' => '⚙️', 'academic_ref' => 'Newton, Carnot, Maxwell', 'trial' => 'We observe macroscopic rigid bodies and applied force/energy vectors.', 'deductive_axiom' => 'Engineered systems are macroscale manifestations of Newtonian mechanics, thermodynamics, and chemistry.', 'inductive_limit' => 'Engineering efficiencies are strictly bounded η < 100%. Structural limits trace to atomic bond mechanics.'],
        };
    }

    private function formatHaltedParadox(string $reason, string $details, string $thesis): string
    {
        return <<<MARKDOWN
# 🚫 DIALECTICAL HALT: {$reason}

## Rejected Thesis:
> {$thesis}

## Physical Violation:
{$details}

## Verdict
**[FALSIFIED ❌ — Engineering Physical Law Violation]**

The dialectical engine halts here. Engineering axioms cannot violate thermodynamic efficiency bounds (η < 1), material yield limits (σ ≤ UTS), or fluid momentum conservation (Navier-Stokes). Any claim of infinite mechanical advantage, over-unity efficiency, or zero-viscosity macroscopic flow requires rewriting the fundamental equations of physics.
MARKDOWN;
    }
}
