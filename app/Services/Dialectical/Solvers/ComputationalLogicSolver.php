<?php

namespace App\Services\Dialectical\Solvers;

use App\Services\Dialectical\DynamicSyntaxGenerator;

/**
 * COMPUTATIONAL LOGIC SOLVER — Dialectical Engine Phase 8
 *
 * Handles all Computer Science, Information Theory & Cryptography proofs:
 *  - P vs NP (Cook-Levin theorem, NP-completeness hierarchy)
 *  - Halting Problem (Turing diagonalization proof)
 *  - Time/Space Complexity (Big-O, Ω, Θ, asymptotic hierarchy)
 *  - Shannon Entropy & Kolmogorov Complexity bounds
 *  - Compression limits (Pigeonhole, Lempel-Ziv)
 *  - Cryptographic security (RSA, AES, Landauer energy bounds)
 *  - Church-Turing Thesis & Hypercomputation
 *  - Algorithm-specific bounds (sorting, FFT, matrix multiply)
 *  - Network/Graph complexity (MST, shortest path, coloring)
 *  - Hash collision bounds (Birthday paradox)
 *
 * Proof flow: Phase 1 (Vector Abstraction) → Phase 2 (Constraint Deduction) → Phase 3 (Universal Scaling)
 */
class ComputationalLogicSolver extends AbstractDynamicDialecticalSolver
{
    public DynamicSyntaxGenerator $syntax;
    public \App\Services\DialecticalOracleService $oracle;

    // Physical & mathematical constants
    public const K_BOLTZ   = 1.380649e-23;   // J/K (Boltzmann constant)
    public const TEMP_300K = 300.0;           // Room temperature (K)
    public const E_BITS_UNIVERSE = 1e92;      // Landauer energy bound on universe computations
    public const ATOMS_UNIVERSE  = 1e80;      // Estimated atoms in observable universe

    public function __construct(DynamicSyntaxGenerator $syntax)
    {
        $this->syntax = $syntax;
        $this->oracle = new \App\Services\DialecticalOracleService();
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1: VECTOR ABSTRACTION — domain detection & trial generation
    // ═══════════════════════════════════════════════════════════════════
    protected function fallbackPhase1Trial(string $thesis, ?array $astMatrix = null): array
    {
        $state = [
            'nodes'          => [],
            'vectors'        => [],
            'proof_traces'   => [],
            'symbolic_traces'=> [],
            'domain'         => [],
            'axiom_chain'    => [],
            'cs_type'        => null,
            'trials'         => [],
            'is_valid'       => true,
        ];

        // Oracle domain classification
        $domain = $this->oracle->classifyDomain($thesis);
        $tl = strtolower($thesis);

        // Detect CS sub-type FIRST (for accurate synthetic domain construction)
        $csType = $this->detectCSType($tl);
        $state['cs_type'] = $csType;

        if (!$domain) {
            $domain = $this->buildSyntheticDomain($csType, $tl);
            $state['proof_traces'][] = "### ℹ️ SYNTHETIC AXIOM DOMAIN (oracle DB miss — inferred from thesis text)";
        }

        $state['domain'] = $domain;

        // Axiom ancestry chain
        $visited = [];
        $axiomChain = $this->oracle->buildProofChain($state['domain']['key'] ?? 'computer_science', 0, $visited);
        $leafNode = [
            'key'          => $state['domain']['key'] ?? 'computer_science',
            'name'         => $state['domain']['name'],
            'branch_icon'  => $state['domain']['branch_icon'] ?? '💻',
            'academic_ref' => $state['domain']['academic_ref'] ?? 'Computer Science',
        ];
        $state['axiom_chain'] = array_merge([$leafNode], $axiomChain);

        $chainNames = array_map(fn($n) => ($n['branch_icon'] ?? '🔢') . ' ' . $n['name'], $state['axiom_chain']);
        $state['proof_traces'][] = '**📖 Axiom Root**: ' . $domain['name'] . ' `[' . ($domain['academic_ref'] ?? 'CS') . ']`';
        $state['proof_traces'][] = '🔗 **Mathematical Axiom Chain**: ' . implode(' ← ', $chainNames);
        $state['proof_traces'][] = '**💻 CS Observation**: ' . ($domain['trial'] ?? 'We abstract computational states and bound functions.');

        // Extract computational bounds from thesis text
        preg_match_all('/\b(O\([^)]+\)|\d+(?:\.\d+)?(?:ms|s|hz|GHz|MB|GB|TB)|P\s*=\s*NP|infinite loop|all programs|lossless|100% compression|2\^256|2\^\d+)\b/i', $thesis, $matches);
        if (!empty($matches[0])) {
            foreach ($matches[0] as $match) {
                $state['nodes'][] = ['type' => 'computational_bound', 'claim' => $match];
            }
        } else {
            $state['nodes'][] = ['type' => 'computational_bound', 'claim' => $thesis];
        }

        $state['vectors']['bound_test'] = $thesis;
        $state['proof_traces'][] = "\n**💻 Computational Vector Abstraction**: extracted bounds `[" . implode(", ", array_column($state['nodes'], 'claim')) . "]`";

        // Generate sub-type specific trial table
        $state['trials'] = $this->generateTrials($csType, $tl);

        return $state;
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2: CONSTRAINT DEDUCTION — validate computational bounds
    // ═══════════════════════════════════════════════════════════════════
    protected function fallbackPhase2Deduction(array $state): array
    {
        if (!$state['is_valid']) return $state;
        
        $domain    = $state['domain'] ?? [];
        $csType    = $state['cs_type'] ?? '';

        $axioms = \App\Services\Dialectical\AxiomEngine\Axioms\AxiomDefinitionLoader::load('computational_logic');
        if (isset($axioms[$csType]) && isset($axioms[$csType]['phase2'])) {
            $axioms[$csType]['phase2']($state, $this);
        }

        return $state;
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: UNIVERSAL COMPUTATIONAL INDUCTION
    // ═══════════════════════════════════════════════════════════════════
    protected function fallbackPhase3Induction(array $state): string
    {
        $domain  = $state['domain'] ?? [];
        $csType  = $state['cs_type'] ?? '';
        $icon    = $domain['branch_icon'] ?? '💻';
        $refText = $domain['academic_ref'] ?? 'Computer Science & Information Theory';

        $md  = "### **{$icon} COMPUTATIONAL LOGIC PROOF** *(Dialectical Engine — Three-Phase Proof)*\n";
        $md .= "> **Axiom Root**: {$domain['name']} `[{$refText}]`\n\n";
        $md .= "---\n\n";

        // PHASE 1
        $md .= "### 🔬 Phase 1 — Computational Vector Abstraction\n\n";
        $md .= "> *\"{$domain['trial']}\"*\n\n";
        foreach ($state['proof_traces'] as $t) {
            $md .= $t . "\n\n";
        }

        if (!empty($state['trials'])) {
            $headers = array_keys(reset($state['trials']));
            $rows    = array_map('array_values', $state['trials']);
            $md .= "**Computational Trial Data:**\n\n";
            $md .= $this->syntax->renderTruthTable($headers, $rows);
            $md .= "\n";
        }

        $md .= "---\n\n";

        if (isset($state['is_valid']) && !$state['is_valid']) {
            $md .= "### 🛑 Phase 3 — Synthesis Halted\n\n";
            $md .= "> The computational constraints **strictly falsify** the thesis.\n\n";
            $md .= "**[FALSIFIED: Computational Axiom Violated ❌]**";
            return $md;
        }

        // PHASE 2
        $md .= "### 🧮 Phase 2 — Deductive Computational Bound\n\n";
        $md .= "> *\"{$domain['deductive_axiom']}\"*\n\n";

        if (!empty($state['symbolic_traces'])) {
            $md .= "**Step-by-Step CS Derivation:**\n\n";
            $md .= $this->syntax->renderAlgebraicSteps($state['symbolic_traces']);
            $md .= "\n";
        }

        $md .= "---\n\n";

        // PHASE 3
        $md .= "### 🌍 Phase 3 — Universal Computational Induction\n\n";

        $inductiveLimits = [
            'p_vs_np'             => 'The P vs NP question (Millennium Prize Problem, Clay 2000) remains unsolved. Every NP-complete problem is polynomial-time reducible to every other, forming an equivalence class under Karp reductions. Unless a polynomial-time SAT algorithm is found, the complexity hierarchy P ⊊ NP ⊊ PSPACE is the accepted bound for all practical algorithms.',
            'halting'             => 'Turing\'s halting undecidability result (1936) scales universally: no algorithm can decide termination for all possible programs. This is uncomputably hard — it extends to Rice\'s theorem: any non-trivial semantic property of programs is undecidable.',
            'information_theory'  => 'Shannon\'s source coding theorem is absolute: no lossless code can achieve expected length below the entropy H(X). This universal limit applies to all data representations, all alphabets, all compressors.',
            'cryptography'        => 'RSA cryptography uses prime factorization as a one-way function: the public key (n,e) is shared openly while the private key (n,d) stays secret. Breaking RSA requires factoring n=p·q — computationally infeasible for large primes. Landauer\'s Principle and combinatorial keyspace bounds ensure that brute-forcing keys ≥128 bits exceeds the observable universe energy budget.',
            'byzantine'           => 'The Byzantine Generals Problem (Lamport-Shostak-Pease 1982) proves that distributed consensus under Byzantine fault-tolerant conditions requires n ≥ 3f+1 nodes for f malicious nodes. This fundamental threshold governs all distributed systems, blockchain protocols, and multi-party computation. FLP impossibility (1985) further shows deterministic consensus is impossible in asynchronous networks with even one crash fault.',
            'turing_simulation'   => 'A Universal Turing Machine (UTM) can simulate any other Turing machine with O(T·log T) overhead. Self-simulation invokes the Recursion Theorem and touches the Halting Problem\'s undecidability boundary — no TM can determine in general whether its own simulation terminates.',
            'complexity'          => 'The computational complexity hierarchy O(1) ⊊ O(log n) ⊊ O(n) ⊊ O(n log n) ⊊ O(n²) ⊊ O(2ⁿ) scales universally for all algorithmic problems — proven via decision-tree lower bounds and information-theoretic arguments.',
            'hash_collision'      => 'Birthday paradox probability bounds scale universally: for any n-bit hash, collision probability reaches 50% after ~2^(n/2) queries — mathematical consequence of the pigeonhole principle.',
        ];

        $inductive = $inductiveLimits[$csType] ?? ($domain['inductive_limit'] ?? 'The computational limit holds universally ∀ machines complying with the Church-Turing thesis.');
        $md .= "> *\"{$inductive}\"*\n\n";

        $md .= "**[CERTIFIED ✅ — Global Axiom: {$domain['name']}]**\n\n";
        $md .= "*(Dialectically Proven via {$icon} Computational Complexity Hierarchy — Zmzir Engine)*";

        return $md;
    }

    // ─────────────────────────────────────────────────────────────────
    // SYMBOLIC STEP BUILDERS
    // ─────────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────

    private function detectCSType(string $tl): string
    {
        if (preg_match('/\b(p\s*=\s*np|p\s*vs\s*np|np-complete|np-hard|tsp|3-sat|boolean sat|subset sum)\b/i', $tl)) return 'p_vs_np';
        // Byzantine Generals must come before generic halting (both mention 'turing machine' in some contexts)
        if (preg_match('/\b(byzantine|consensus|fault.toleran|distributed.*agreement|generals.*problem|generals.*algorithm)\b/i', $tl)) return 'byzantine';
        // Turing machine simulating itself — before generic halting
        if (preg_match('/\b(turing machine.*simulat|simulat.*turing machine|universal turing|self.referential.*turing|utm|time complexity.*turing)\b/i', $tl)) return 'turing_simulation';
        if (preg_match('/\b(halting problem|turing machine|computability|church.turing|rice.s theorem|diagonali[sz]ation)\b/i', $tl)) return 'halting';
        if (preg_match('/\b(shannon entropy|kolmogorov complexity|compression|channel capacity|lossless|source coding)\b/i', $tl)) return 'information_theory';
        if (preg_match('/\b(cryptograph|landauer|brute force|rsa|aes|encryption|one.time pad|diffie.hellman|ecdsa|elliptic curve|prime factori)\b/i', $tl)) return 'cryptography';
        if (preg_match('/\b(big.o|time complexity|space complexity|o\([^)]+\)|sorting|searching|asymptotic|master theorem)\b/i', $tl)) return 'complexity';
        if (preg_match('/\b(hash collision|birthday paradox|birthday attack|sha|md5|preimage|collision resist)\b/i', $tl)) return 'hash_collision';
        return 'general_cs';
    }

    private function buildSyntheticDomain(string $csType, string $tl): array
    {
        return match($csType) {
            'byzantine' => [
                'key'             => 'byzantine',
                'name'           => '🔗 Byzantine Fault Tolerance & Distributed Consensus',
                'branch_icon'    => '🔗',
                'academic_ref'   => 'Lamport-Shostak-Pease (1982), PBFT Castro-Liskov (1999), FLP Fischer-Lynch-Paterson (1985)',
                'trial'          => 'We model n generals (distributed nodes) where f may be Byzantine (faulty/malicious) and determine under what conditions consensus is achievable.',
                'deductive_axiom'=> 'Byzantine fault tolerance requires n ≥ 3f+1 nodes to tolerate f Byzantine traitors. Below this threshold, consensus on a binary decision is mathematically impossible.',
                'inductive_limit'=> 'The Byzantine Generals Problem bounds all distributed consensus protocols — from PBFT to blockchain. The CAP theorem and FLP impossibility define absolute limits of distributed systems.',
                'unsolved'       => false,
            ],
            'turing_simulation' => [
                'key'             => 'turing_simulation',
                'name'           => '🖥️ Universal Turing Machine & Self-Simulation',
                'branch_icon'    => '🖥️',
                'academic_ref'   => 'Turing (1936), Hennie-Stearns (1966), Kleene Recursion Theorem (1938)',
                'trial'          => 'We model a Universal Turing Machine (UTM) simulating an arbitrary TM M, analyzing the time complexity overhead and self-referential computation bounds.',
                'deductive_axiom'=> 'A UTM simulating TM M on input w requires O(T(n)·log T(n)) time, where T(n) is M\'s runtime. Self-simulation encounters undecidability at the Halting Problem boundary.',
                'inductive_limit'=> 'Self-simulation of a Turing machine is universally bounded: O(T²·log T) in the worst case. The Time Hierarchy Theorem prevents simulation from collapsing complexity classes.',
                'unsolved'       => false,
            ],
            'p_vs_np' => [
                'key'          => 'p_vs_np',
                'name'         => '💻 P vs NP Complexity Class',
                'branch_icon'  => '💻',
                'academic_ref' => 'Cook-Levin (1971), Karp (1972), Baker-Gill-Solovay (1975)',
                'trial'        => 'We abstract deterministic vs non-deterministic Turing machine execution states and reduction mappings.',
                'deductive_axiom' => 'A problem is NP-Complete if and only if every NP problem is polynomial-time many-one reducible to it.',
                'inductive_limit' => 'The complexity hierarchy P ⊆ NP ⊆ PSPACE ⊆ EXPTIME is unconditionally proven; P vs NP remains open.',
                'unsolved'     => true,
            ],
            'halting' => [
                'key'          => 'computability',
                'name'         => '🖥️ Turing Computability & Halting Problem',
                'branch_icon'  => '🖥️',
                'academic_ref' => 'Turing (1936), Rice (1953), Church-Turing Thesis',
                'trial'        => 'We abstract universal computation and self-referential execution boundaries via diagonalization.',
                'deductive_axiom' => 'By Turing diagonalization, no Turing machine can decide the halting state of all arbitrary Turing machines.',
                'inductive_limit' => 'The undecidability of the Halting Problem extends to all non-trivial semantic properties of TMs (Rice\'s Theorem).',
                'unsolved'     => false,
            ],
            'information_theory' => [
                'key'          => 'information_theory',
                'name'         => '📡 Information Theory & Data Compression',
                'branch_icon'  => '📡',
                'academic_ref' => 'Shannon (1948), Kolmogorov (1965), Lempel-Ziv (1977)',
                'trial'        => 'We abstract data as probabilistic entropy streams subject to the Shannon channel capacity.',
                'deductive_axiom' => 'The minimum expected code length for lossless compression equals the Shannon entropy H(X).',
                'inductive_limit' => 'No lossless compressor can compress uniformly random data. H(X) is the absolute lower bound universally.',
                'unsolved'     => false,
            ],
            'cryptography' => [
                'key'          => 'cryptography',
                'name'         => '🔐 Cryptographic Complexity & Landauer Bounds',
                'branch_icon'  => '🔐',
                'academic_ref' => 'Landauer (1961), Diffie-Hellman (1976), RSA (1977), AES (2001)',
                'trial'        => 'We abstract bit-flip state changes against thermodynamic energy and computational feasibility bounds.',
                'deductive_axiom' => 'Erasing a bit of information at temperature T requires minimum energy k_B·T·ln2 (Landauer\'s Principle).',
                'inductive_limit' => 'Brute-forcing modern cryptographic keyspaces (≥128 bits) exceeds the total energy budget of the observable universe.',
                'unsolved'     => false,
            ],
            'complexity' => [
                'key'          => 'time_complexity',
                'name'         => '⏱️ Algorithmic Time Complexity',
                'branch_icon'  => '⏱️',
                'academic_ref' => 'Bachmann-Landau (1894), Cook (1971), Knuth (1968)',
                'trial'        => 'We abstract algorithm execution steps against asymptotic bound functions O(f(n)).',
                'deductive_axiom' => 'Comparison-based sorting requires Ω(n log n) comparisons in the worst case (decision-tree lower bound).',
                'inductive_limit' => 'The computational complexity hierarchy is absolute — no algorithm can violate proven Ω lower bounds.',
                'unsolved'     => false,
            ],
            'hash_collision' => [
                'key'          => 'hash_collision',
                'name'         => '🔏 Hash Functions & Birthday Paradox',
                'branch_icon'  => '🔏',
                'academic_ref' => 'Merkle (1979), SHA-2 (NIST 2001), SHAttered (Google 2017)',
                'trial'        => 'We abstract hash collision probability as a birthday problem over the output space of size 2ⁿ.',
                'deductive_axiom' => 'A collision in an n-bit hash requires approximately 2^(n/2) queries with 50% probability (Birthday Paradox).',
                'inductive_limit' => 'SHA-256 and SHA-3 remain collision-resistant at 2^128 operations — computationally infeasible.',
                'unsolved'     => false,
            ],
            default => [
                'key'          => 'time_complexity',
                'name'         => '⏱️ Computational Logic & Algorithm Analysis',
                'branch_icon'  => '⏱️',
                'academic_ref' => 'Church-Turing Thesis, Bachmann-Landau Notation (1894)',
                'trial'        => 'We abstract algorithm execution states and bound functions over asymptotic input size.',
                'deductive_axiom' => 'Algorithm scaling is strictly bounded by combinatorial permutations, recursive depths, and the Church-Turing thesis.',
                'inductive_limit' => 'Computational work cannot bypass the absolute minimum asymptotic step count proven by lower bound arguments.',
                'unsolved'     => false,
            ],
        };
    }

    private function generateTrials(string $csType, string $tl): array
    {
        return match($csType) {
            'complexity' => [
                ['n'     => '10',        'O(log n)'  => '3.32',  'O(n)'   => '10',        'O(n log n)' => '33.2',      'O(n²)' => '100',       'O(2ⁿ)' => '1024'],
                ['n'     => '100',       'O(log n)'  => '6.64',  'O(n)'   => '100',       'O(n log n)' => '664',       'O(n²)' => '10,000',    'O(2ⁿ)' => '~10³⁰'],
                ['n'     => '1,000',     'O(log n)'  => '9.97',  'O(n)'   => '1,000',     'O(n log n)' => '9,966',     'O(n²)' => '1,000,000', 'O(2ⁿ)' => '~10³⁰¹'],
                ['n'     => '1,000,000', 'O(log n)'  => '19.93', 'O(n)'   => '1,000,000', 'O(n log n)' => '19,931,568','O(n²)' => '10¹²',      'O(2ⁿ)' => '~10³⁰⁰⁰⁰⁰'],
            ],
            default => [],
        };
    }

    private function hashExample(int $n): string
    {
        return match(true) {
            $n <= 128 => 'MD5 (broken ❌)',
            $n <= 160 => 'SHA-1 (deprecated ⚠️)',
            $n <= 256 => 'SHA-256 ✅',
            $n <= 384 => 'SHA-384 ✅',
            default   => 'SHA-512 ✅',
        };
    }
}
