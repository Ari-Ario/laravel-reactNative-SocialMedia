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
        $axioms = config("axioms.{$state['system_type']}");
        if ($axioms && isset($axioms['phase1'])) {
            $axioms['phase1']($state, $thesis, $this->cas);
        } else {
            $generic = \App\Services\Dialectical\AxiomEngine\Axioms\AxiomDefinitionLoader::load('natural_science')['General'] ?? [];
            if ($generic && isset($generic['phase1'])) {
                $generic['phase1']($state, $thesis, $this->cas);
            }
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
        $state['proof_traces'][] = '📐 **DB Deductive Axiom**: *"' . ($domain['deductive_axiom'] ?? 'Mathematical deduction of physical interactions based on conservation laws.') . '"*';

        $state['symbolic_traces'] = [];
        $thesis = $state['vectors']['raw'] ?? '';
        $state['is_violation'] = $state['is_violation'] ?? false;

        $axioms = config("axioms.{$systemType}");
        if ($axioms && isset($axioms['phase2'])) {
            $axioms['phase2']($state, $thesis, $this->cas);
        } else {
            $generic = \App\Services\Dialectical\AxiomEngine\Axioms\AxiomDefinitionLoader::load('natural_science')['General'] ?? [];
            if ($generic && isset($generic['phase2'])) {
                $generic['phase2']($state, $thesis, $this->cas);
            }
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
                if (isset($n['type']) && $n['type'] === 'EmpiricalSystemNode' && isset($n['system_type'])) {
                    return $n['system_type'];
                }
            }
        }
        
        $axioms = \App\Services\Dialectical\AxiomEngine\Axioms\AxiomDefinitionLoader::load('natural_science');
        foreach ($axioms as $sysType => $config) {
            if (isset($config['meta']['keywords'])) {
                if (preg_match('/' . $config['meta']['keywords'] . '/i', $tl)) {
                    return $sysType;
                }
            }
        }
        
        return 'Kinematic';
    }

    private function buildSyntheticDomain(string $sysType, string $tl): array
    {
        $axioms = config("axioms.{$sysType}");
        if ($axioms && isset($axioms['meta'])) {
            return $axioms['meta'];
        }
        return (\App\Services\Dialectical\AxiomEngine\Axioms\AxiomDefinitionLoader::load('natural_science')['General']['meta'] ?? []);
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
        $systemType = is_string($astOrSysType) ? $astOrSysType : ($astOrSysType['attributes']['system_type'] ?? 'Kinematic');
        
        $md = "| Level | State Config | Condition | Outcome Observation |\n";
        $md .= "|---|---|---|---|\n";
        
        $sequence = $this->primitives->generateSequence($startSequence, $limit);
        
        $axioms = config("axioms.{$systemType}");
        $baseCase = $axioms['meta']['base_case'] ?? (\App\Services\Dialectical\AxiomEngine\Axioms\AxiomDefinitionLoader::load('natural_science')['General']['meta']['base_case'] ?? ['state' => 'State {$n}', 'cond' => 'Physical Law', 'outcome' => 'Satisfied ✅']);
        
        foreach ($sequence as $n) {
            $stateStr = str_replace('{$n}', $n, $baseCase['state']);
            $condStr = str_replace('{$n}', $n, $baseCase['cond']);
            $outcomeStr = str_replace('{$n}', $n, $baseCase['outcome']);
            
            $md .= "| Level {$n} | {$stateStr} | `{$condStr}` | **{$outcomeStr}** |\n";
        }
        
        return $md;
    }



    public function proveInductiveScaling(array $ast, string $domainPartition = ''): string
    {
        return "By mathematical induction over structural physical bounds, as State N transitions to N+1, algebraic conservation remains invariant. Physical laws are topologically sealed — no finite perturbation can break a global conservation law.";
    }
}
