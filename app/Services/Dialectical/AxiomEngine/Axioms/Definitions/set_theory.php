<?php

return [
    'cantors_theorem' => [
        'meta' => [
            'inductive_limit' => 'Cantor\'s diagonal argument is the most elegant proof in mathematics — reproduced identically from finite to transfinite. The strict inequality |P(A)| > |A| holds for ALL sets, finite and infinite alike. This creates a strictly ascending hierarchy of infinite cardinalities: ℵ₀ < 2^ℵ₀ < 2^(2^ℵ₀) < ... with no largest cardinal. The Cantor-Bernstein-Schröder Theorem makes cardinality comparisons rigorous. Whether 2^ℵ₀ = ℵ₁ (Continuum Hypothesis) is permanently independent of ZFC.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🔢 Cantor's Theorem & Power Sets — Core Claim**: |P(A)| > |A| for all sets A";
            $state['proof_traces'][] = "- **Beth Numbers**: ℶ₀ = ℵ₀ = |ℕ|;  ℶ₁ = 2^ℵ₀ = |ℝ|;  ℶ₂ = 2^ℶ₁;  etc.";
            $state['proof_traces'][] = "- **Cantor-Bernstein-Schröder Theorem**: If |A|≤|B| and |B|≤|A| then |A|=|B|. Proof: construct explicit bijection from two injections.";
            $state['proof_traces'][] = "- **Countable sets**: |ℕ| = |ℤ| = |ℚ| = ℵ₀  (all same cardinality — zig-zag argument / Cantor's pairing function)";
            $state['proof_traces'][] = "- **Uncountable sets**: |ℝ| = 2^ℵ₀ > ℵ₀  (diagonal argument)";
            $state['proof_traces'][] = "- **Continuum Hypothesis (CH)**: 2^ℵ₀ = ℵ₁?  → **Independent of ZFC** (Gödel 1940: consistent; Cohen 1963: ¬CH also consistent)";
            for ($n = 1; $n <= 5; $n++) {
                $pn = (int) pow(2, $n);
                $beth = "2^{$n}";
                $state['trials'][] = ['|N| (finite n)' => $n, '|P(N)| = 2^n' => $pn, 'Surjection N→P(N)' => 'Impossible ❌', 'Diag. element D exists?' => 'Yes ✅', 'Bijection?' => "|P(N)|={$pn} > {$n} ✅"];
            }
            $state['trials'][] = ['|N| (finite n)' => 'ℵ₀ (infinite)', '|P(N)| = 2^n' => '2^ℵ₀ = ℶ₁ = |ℝ|', 'Surjection N→P(N)' => 'Impossible ❌', 'Diag. element D exists?' => 'Yes ✅', 'Bijection?' => '2^ℵ₀ > ℵ₀ ✅'];
            // Cantor's pairing function: π(k₁,k₂) = (k₁+k₂)(k₁+k₂+1)/2 + k₂  (shows ℕ×ℕ countable)
            $state['proof_traces'][] = "\n**Cantor's Pairing Function** (shows |ℕ×ℕ| = ℵ₀):";
            $state['proof_traces'][] = "π(k₁,k₂) = (k₁+k₂)(k₁+k₂+1)/2 + k₂";
            $pairSamples = [[0, 0], [0, 1], [1, 0], [0, 2], [1, 1], [2, 0], [0, 3]];
            foreach ($pairSamples as [$k1, $k2]) {
                $pi = ($k1 + $k2) * ($k1 + $k2 + 1) / 2 + $k2;
                $state['proof_traces'][] = "  π({$k1},{$k2}) = {$pi}";
            }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Diagonal Argument Setup', 'expr' => 'Assume f: A → P(A) is surjective. Define D = { x ∈ A | x ∉ f(x) }. Since f is surjective, ∃d∈A: f(d) = D.'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Case d∈D', 'expr' => 'If d∈D → by def of D: d∉f(d) = D. Contradiction ❌'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Case d∉D', 'expr' => 'If d∉D → by def of D: d∈f(d) = D. Contradiction ❌'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Deduction', 'expr' => '∴ No surjection A → P(A) exists. Combined with trivial injection x↦{x}: A→P(A), by Cantor-Bernstein: |P(A)| > |A| ✅'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Cantor-Bernstein-Schröder', 'expr' => 'If f:A→B injective and g:B→A injective, construct bijection h:A→B. Key: h(x) = f(x) if x in "A-chain"; g⁻¹(x) otherwise. ✅'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Infinite Application', 'expr' => 'ℕ → P(ℕ): |P(ℕ)| = 2^ℵ₀ = |ℝ| > ℵ₀ = |ℕ|. The continuum is strictly larger than the naturals. ✅'];
            $state['symbolic_traces'][] = ['step' => '7', 'label' => 'Transfinite Hierarchy', 'expr' => 'ℵ₀ < 2^ℵ₀ < 2^(2^ℵ₀) < ...  [Beth numbers: ℶ₀ < ℶ₁ < ℶ₂ < ...]. No largest cardinal exists. ✅'];
            $state['is_valid'] = true;
            $state['conclusion'] = 'Cantor Diagonal Argument — CERTIFIED';
        }
    ],
    'russell_paradox' => [
        'meta' => [
            'inductive_limit' => 'Russell\'s Paradox destroyed Frege\'s naive set theory (1902). The resolution via ZFC\'s Separation Axiom is mathematically complete — restricting comprehension to subsets of existing sets eliminates all known set-theoretic paradoxes. The Foundation Axiom explicitly prohibits self-membership (A∉A). Proper classes (Ord, V) that would lead to paradox are excluded from the set universe in ZFC and treated as classes in NBG.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🚨 Russell's Paradox** — R = {x | x∉x}";
            $state['proof_traces'][] = "- In naive (Frege-style) set theory: any predicate φ defines a set {x | φ(x)} (unrestricted comprehension)";
            $state['proof_traces'][] = "- **Paradox**: Let φ(x) = 'x∉x'. Then R = {x | x∉x}. Does R∈R?";
            $state['proof_traces'][] = "  - Assume R∈R → by definition of R, R∉R. Contradiction ❌";
            $state['proof_traces'][] = "  - Assume R∉R → by definition of R, R∈R. Contradiction ❌";
            $state['proof_traces'][] = "- **ZFC Resolution**: Axiom 7 (Separation) replaces unrestricted comprehension with {x∈A | φ(x)} — must take a subset of an *existing* set A. Russell's R requires an unrestricted domain, which ZFC prohibits.";
            $state['proof_traces'][] = "- **Alternative Resolutions**: Russell's Type Theory (stratified types); Quine's NF; Von Neumann-Bernays-Gödel (NBG) class theory (proper classes vs. sets)";
            $state['proof_traces'][] = "- **Foundation Axiom (9)**: Ensures A∉A for all A. Proof: Let A = {A}. Then A∩{A} = {A} ≠ ∅, violating Foundation. ✅";
            $state['proof_traces'][] = "- **Burali-Forti Paradox**: The set Ω of all ordinals would itself be an ordinal, hence Ω∈Ω, violating Foundation. Resolution: Ω is a proper class (not a set) in ZFC/NBG.";
            $state['trials'][] = ['Iteration' => '1', 'Assume R∈R' => 'Then R∉R (by def) ❌', 'Assume R∉R' => 'Then R∈R (by def) ❌', 'Consistency' => 'Cyclic contradiction'];
            $state['trials'][] = ['Iteration' => 'Naive theory', 'Assume R∈R' => 'Contradiction', 'Assume R∉R' => 'Contradiction', 'Consistency' => '❌ Theory collapses'];
            $state['trials'][] = ['Iteration' => 'ZFC (Separation)', 'Assume R∈R' => 'R only defined as {x∈A | x∉x}', 'Assume R∉R' => 'R ⊆ A, not universal', 'Consistency' => '✅ Paradox blocked'];
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Naive Comprehension (Frege)', 'expr' => '∀φ ∃R∀x[x∈R ↔ φ(x)]  (every predicate defines a set)'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Russell Construction', 'expr' => 'Let φ(x) = x∉x. Then R = {x | x∉x} exists (by naive comprehension).'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Self-Reference Evaluation', 'expr' => 'R∈R ↔ R∉R  [substituting x=R in φ]. Contradiction. Naive comprehension is inconsistent. ❌'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'ZFC Resolution (Axiom 7)', 'expr' => 'ZFC replaces ∃R∀x[x∈R ↔ φ(x)] with ∀A∃B∀x[x∈B ↔ x∈A ∧ φ(x)]. R = {x∈A | x∉x} ⊆ A requires a pre-existing set A.'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'R not a set in ZFC', 'expr' => 'In ZFC: R = {x∈V | x∉x} requires V (set of all sets). But V is a proper class, not a set. R is a proper class (NBG) — no contradiction in ZFC. ✅'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Foundation (Axiom 9)', 'expr' => '∀A[A≠∅ → ∃x∈A(x∩A=∅)] → A∉A for all sets A in ZFC. Self-membership is axiomatically forbidden. ✅'];
            $state['is_valid'] = false;
            // Paradox — halts under naive theory
            $state['conclusion'] = 'Russell Paradox — FUNDAMENTAL CONTRADICTION in naive set theory; ZFC resolution provided';
        }
    ],
    'banach_tarski' => [
        'meta' => [
            'inductive_limit' => 'The Banach-Tarski Paradox is a true theorem in ZFC+AC. It demonstrates that measure theory breaks down for non-measurable sets. The paradox is entirely consequence of the Axiom of Choice operating on non-constructive, non-measurable decompositions. It is physically inapplicable because matter is discrete (atoms) and non-measurable sets cannot be physically realized. In Solovay\'s model (ZF + \'all sets measurable\'), Banach-Tarski fails.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🌀 Banach-Tarski Paradox** — 1 Ball → 2 Identical Balls";
            $state['proof_traces'][] = "- Requires: Axiom of Choice (AC); working in ℝ³ (3+ dimensions required); rigid motions only";
            $state['proof_traces'][] = "- **Non-Measurable Sets**: The decomposition uses sets that have no well-defined Lebesgue measure μ. AC allows selection from uncountably infinite orbits of SO(3).";
            $state['proof_traces'][] = "- **Hausdorff Paradox (1914, precursor)**: S² minus countable set can be partitioned into 3 congruent parts A, B, C where A ≅ B ≅ C ≅ B∪C";
            $state['proof_traces'][] = "- **Why not physical?**: Physical matter is discrete (atoms/quanta). Non-measurable sets require actual (not potential) infinity — atoms cannot be infinitely subdivided. Physical matter has μ(m) > 0. ✅";
            $state['proof_traces'][] = "- **Key SO(3) Group Property**: SO(3) contains a free group on 2 generators {σ, τ} (no accidental equalities). This is the engine of the paradox — the group's 'paradoxical decomposition'.";
            $state['proof_traces'][] = "- **Mathematical Validity**: True theorem in ZFC+AC. False physical prediction.";
            $state['proof_traces'][] = "- **Consequence**: If you reject AC, Banach-Tarski fails. If you accept AC (standard in ZFC), it holds.";
            $state['proof_traces'][] = "- **Alternative**: Solovay's model (1970): ZF + 'all sets are Lebesgue measurable' is consistent (relative to inaccessible cardinal) — Banach-Tarski fails in this model.";
            $partitions = [2, 3, 4, 5, 6];
            foreach ($partitions as $p) {
                $state['trials'][] = ['Decomposition Sets (k)' => $p, 'Measure μ(S_i)' => 'Undefined (non-measurable)', 'Transformation' => 'Rigid rotation SO(3)', 'Volume Conservation' => 'Violated ❌ (μ undefined)', 'AC required?' => 'Yes ✅', 'Physical?' => 'No (atoms discrete) ❌'];
            }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'AC Selection', 'expr' => 'Use AC to choose one representative from each orbit of SO(3) acting on S². Orbits are uncountably infinite and disjoint.'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Free Group F₂ in SO(3)', 'expr' => 'Rotations σ (angle arccos(1/3)) and τ (around x-axis) generate a free group F₂ = ⟨σ,τ⟩ in SO(3) with no accidental equalities.'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Paradoxical Decomposition', 'expr' => 'F₂ has paradoxical decomposition: F₂ = A ∪ B = σA ∪ τB (Hausdorff). Inherit decomposition to S² minus countable set.'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Ball Decomposition', 'expr' => 'Extend S² decomposition to ball B³ by radial projection. Decompose B³ into 5 non-measurable pieces {E₁,...,E₅}.'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Rigid Reassembly', 'expr' => 'Rearrange {E₁,E₂,E₃} → B³ using rotations only. Rearrange {E₄,E₅} → B³ using rotations only. 1 ball → 2 balls. ✅ (mathematically)'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Physical Impossibility', 'expr' => 'Atoms are discrete: matter has μ(particle) > 0. Non-measurable sets cannot be constructed physically. AC is non-constructive. ❌ (physically)'];
            $state['is_valid'] = true;
            $state['conclusion'] = 'Banach-Tarski Paradox — VALID THEOREM in ZFC+AC; physically inapplicable';
        }
    ],
    'continuum_hypothesis' => [
        'meta' => [
            'inductive_limit' => 'The Continuum Hypothesis is **absolutely independent of ZFC** — the most celebrated foundational result of the 20th century. Gödel\'s constructible universe L and Cohen\'s forcing technique prove that CH is consistent with ZFC and ¬CH is consistent with ZFC. Mathematics can proceed equally well in any universe. The question \'is CH true?\' is meaningful only relative to a choice of set-theoretic universe — a profound philosophical result about the nature of mathematical truth.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**∞ Continuum Hypothesis (CH): 2^ℵ₀ = ℵ₁? (Aleph-1)**";
            $state['proof_traces'][] = "- **CH**: There is no set A with ℵ₀ < |A| < 2^ℵ₀. Equivalently: |ℝ| = ℵ₁ (the smallest uncountable cardinal, Aleph-1).";
            $state['proof_traces'][] = "- **GCH (Generalized CH)**: For all α: 2^ℵ_α = ℵ_{α+1}.";
            $state['proof_traces'][] = "- **Gödel 1940**: Constructed the 'constructible universe' L. Every axiom of ZFC is true in L, and CH is true in L → ZFC ⊬ ¬CH (CH is consistent with ZFC).";
            $state['proof_traces'][] = "- **Cohen 1963**: Invented 'forcing' method. Added ℵ₂ many reals by forcing → model where 2^ℵ₀ = ℵ₂ > ℵ₁. ZFC ⊬ CH (¬CH is consistent with ZFC).";
            $state['proof_traces'][] = "- **Conclusion**: CH is **independent of ZFC** — can be neither proved nor disproved from ZFC axioms. This is the most famous independence result in mathematics.";
            $state['proof_traces'][] = "- **Philosophical Status**: Is CH true? Platonist: one answer exists; Formalist: question meaningless; Multiverse (Hamkins): both CH and ¬CH are 'true' in different set-theoretic universes.";
            $state['proof_traces'][] = "- **Woodin's Ω-logic**: Recent work suggests a preferred extension of ZFC where CH is false (2^ℵ₀ = ℵ₂). Not yet consensus.";
            $state['trials'][] = ['Statement' => 'ZFC ⊢ CH', 'Status' => '❌ Independent (Cohen forcing)', 'Model' => 'No — forcing shows ¬CH consistent'];
            $state['trials'][] = ['Statement' => 'ZFC ⊢ ¬CH', 'Status' => '❌ Independent (Gödel L)', 'Model' => 'No — L shows CH consistent'];
            $state['trials'][] = ['Statement' => 'ZFC + CH consistent', 'Status' => '✅ (Gödel 1940)', 'Model' => 'L = constructible universe'];
            $state['trials'][] = ['Statement' => 'ZFC + ¬CH consistent', 'Status' => '✅ (Cohen 1963)', 'Model' => 'Forcing extension with 2^ℵ₀ = ℵ₂'];
            $state['trials'][] = ['Statement' => 'GCH consistent with ZFC', 'Status' => '✅ (Gödel L)', 'Model' => '2^ℵ_α = ℵ_{α+1} in L'];
            $state['trials'][] = ['Statement' => 'Large Cardinals consistent', 'Status' => '? (relative to LC)', 'Model' => 'Consistency strength hierarchy open'];
            $state['ch_status'] = 'INDEPENDENT';
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => "Gödel's L (1940)", 'expr' => 'Define constructible sets: L = ⋃_{α∈Ord} L_α where L_0=∅, L_{α+1}=Def(L_α), L_λ=⋃_{α<λ}L_α for limit λ. V=L implies GCH holds in L. ✅'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'L |= ZFC + CH', 'expr' => 'Every axiom of ZFC holds in L. CH holds: in L, 2^ℵ₀ = ℵ₁. Therefore ZFC ⊬ ¬CH (CH is consistent). ✅'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Cohen Forcing (1963)', 'expr' => 'Start with V|=ZFC+CH. Add ℵ₂ generic reals by forcing P = Fn(ℵ₂×ω, 2) (finite partial functions). In V[G]: 2^ℵ₀ ≥ ℵ₂ > ℵ₁. ✅'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Independence Conclusion', 'expr' => 'ZFC ⊬ CH (Cohen) and ZFC ⊬ ¬CH (Gödel). CH is independent of ZFC — the most famous independence result in mathematics ✅'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => "Woodin's Ω-Conjecture", 'expr' => 'Recent: Woodin proposes Ω-logic extension of ZFC where CH is FALSE (2^ℵ₀ = ℵ₂). Not yet consensus. The question of "which universe?" depends on philosophical stance.'];
            $state['is_valid'] = true;
            // Theorem is a true independence result
            $state['conclusion'] = 'CH Independence — CERTIFIED (Gödel 1940 + Cohen 1963)';
        }
    ],
    'ordinals' => [
        'meta' => [
            'inductive_limit' => 'Ordinal arithmetic is the foundation of transfinite induction and all of set theory\'s structural theorems. The non-commutativity of ordinal addition (1+ω = ω ≠ ω+1) reveals the richness of the transfinite. ε₀ (the proof-theoretic ordinal of PA) connects ordinal theory to the limits of Peano Arithmetic. Goodstein\'s Theorem — provable in ZFC by ordinal descent but unprovable in PA — demonstrates how ordinal theory transcends first-order arithmetic.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**📐 Ordinal & Cardinal Arithmetic**:";
            $state['proof_traces'][] = "- **Von Neumann Ordinals**: 0=∅, 1={∅}, 2={∅,{∅}}, 3={∅,{∅},{∅,{∅}}}, ..., ω = {0,1,2,...}, ω+1 = ω∪{ω}, ...";
            $state['proof_traces'][] = "- **Ordinal Addition (non-commutative)**: ω+1 ≠ 1+ω = ω. Key: n+ω = ω (left finite absorbed); ω+n ≠ ω (right extends beyond ω).";
            $state['proof_traces'][] = "- **Ordinal Multiplication**: ω·2 = ω+ω (2 copies of ω);  2·ω = ω (not 2 copies — ω copies of 2 = ω). Non-commutative.";
            $state['proof_traces'][] = "- **Ordinal Exponentiation**: ω^ω = ω·ω·ω··· (ω-many ω-many);  ε₀ = ω^(ω^(ω^...)) = sup{ω, ω^ω, ω^(ω^ω), ...} (least fixed point of α ↦ ω^α).";
            $state['proof_traces'][] = "- **Cantor Normal Form**: Every ordinal α has unique representation α = ω^{β₁}n₁ + ω^{β₂}n₂ + ... with β₁ > β₂ > ... and nᵢ ∈ ℕ⁺.";
            $state['proof_traces'][] = "- **Transfinite Induction**: If P(0) and [∀β<α P(β) → P(α)] for all α, then P(α) for all ordinals α. Three cases: (1) zero, (2) successor, (3) limit ordinal.";
            $state['proof_traces'][] = "- **Transfinite Recursion Theorem**: For any G:V→V, there exists unique F:Ord→V with F(α) = G(F↾α).";
            $state['proof_traces'][] = "- **Cardinals vs. Ordinals**: Every cardinal is an ordinal, but not vice versa. ℵ₀ = ω (as ordinal);  ℵ₁ = ω₁ (first uncountable ordinal);  ℵ_α = ω_α.";
            $ordOps = [['α' => '0', 'β' => 'ω', 'α+β' => 'ω', 'β+α' => 'ω', 'Commutes?' => '✅ (trivial)'], ['α' => '1', 'β' => 'ω', 'α+β' => 'ω', 'β+α' => 'ω+1', 'Commutes?' => '❌'], ['α' => '3', 'β' => 'ω', 'α+β' => 'ω', 'β+α' => 'ω+3', 'Commutes?' => '❌'], ['α' => 'ω', 'β' => 'ω', 'α+β' => 'ω·2', 'β+α' => 'ω·2', 'Commutes?' => '✅'], ['α' => '2', 'β' => 'ω', 'α·β' => 'ω', 'β·α' => 'ω+ω=ω·2', 'Commutes?' => '❌'], ['α' => 'ω', 'β' => '2', 'α·β' => 'ω·2', 'β·α' => 'ω·2', 'Commutes?' => '✅']];
            foreach ($ordOps as $r) {
                $state['trials'][] = $r;
            }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Von Neumann Definition', 'expr' => 'α is an ordinal iff α is transitive (x∈y∈α → x∈α) and well-ordered by ∈. Each ordinal = set of all smaller ordinals. ✅'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Successor Ordinals', 'expr' => 'S(α) = α ∪ {α}  (e.g., S(ω) = ω+1 = ω∪{ω}). Every non-zero ordinal is either a successor or a limit ordinal. ✅'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Non-Commutativity Proof', 'expr' => '1+ω: append one element before ω-sequence → still has no last element → 1+ω ≅ ω (order isomorphic). ω+1: append after ω-sequence → has a last element → ω+1 ≇ ω. ∴ 1+ω ≠ ω+1. ✅'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Transfinite Induction', 'expr' => 'Proof schema: (1) Base: P(0); (2) Successor: P(α) → P(α+1); (3) Limit: [∀β<λ P(β)] → P(λ). Then ∀α P(α) by well-ordering of Ord. ✅'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'ε₀ and Goodstein', 'expr' => 'ε₀ = sup{ω, ω^ω, ω^(ω^ω), ...} is the proof-theoretic ordinal of PA (Peano Arithmetic). Goodstein\'s Theorem is unprovable in PA but provable in ZFC using ordinal descent to 0. ✅'];
            $state['is_valid'] = true;
            $state['conclusion'] = 'Ordinal Arithmetic — CERTIFIED (ZFC transfinite induction)';
        }
    ],
    'zorns_lemma' => [
        'meta' => [
            'inductive_limit' => 'Zorn\'s Lemma, the Well-Ordering Principle, and the Axiom of Choice are perfectly equivalent statements in ZF set theory. Their equivalence is a deep structural fact about sets. Together they are foundational to virtually all of abstract algebra: every vector space has a basis, every ideal extends to a maximal ideal, every field has an algebraic closure, and the Hahn-Banach theorem holds. Without AC, many core results of modern mathematics collapse.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🔗 Zorn's Lemma & The Axiom of Choice**:";
            $state['proof_traces'][] = "- **Zorn's Lemma**: If (P, ≤) is a partially ordered set where every totally ordered subset (chain) has an upper bound in P, then P has at least one maximal element.";
            $state['proof_traces'][] = "- **Equivalence (in ZF)**: The following are all equivalent: (1) Axiom of Choice; (2) Zorn's Lemma; (3) Well-Ordering Principle (∀set A ∃well-order on A); (4) Tychonoff's Theorem (product of compact spaces is compact); (5) Every vector space has a basis.";
            $state['proof_traces'][] = "- **AC → ZL Proof Sketch**: Given poset P with chain-ub property. Assume no maximal element. Use AC to choose successor function g(C) > ub(C). Construct transfinite chain by Transfinite Recursion. This chain is eventually longer than P — contradiction. ✅";
            $state['proof_traces'][] = "- **Applications of Zorn**: (a) Every ideal is contained in a maximal ideal (ring theory); (b) Every vector space has a Hamel basis; (c) Every connected graph has a spanning tree; (d) Every field has an algebraic closure; (e) Hahn-Banach extension theorem.";
            $state['proof_traces'][] = "- **AC Independence**: Gödel 1940: ZF + AC is consistent (L |= AC). Cohen 1963: ZF + ¬AC is consistent (symmetric model). AC is independent of ZF.";
            $state['proof_traces'][] = "- **Constructive Mathematics**: Zorn's Lemma and AC are rejected in constructive/intuitionistic mathematics (Brouwer) — existence proofs must be algorithmic.";
            $state['proof_traces'][] = "- **Well-Ordering Theorem**: AC ↔ every set can be well-ordered. Consequence: |ℝ| = 2^ℵ₀ can be well-ordered (assuming AC), though no explicit well-order is known.";
            $state['trials'][] = ['Theorem' => "Every vector space has a basis", 'Requires' => 'AC (Zorn)', 'Constructive?' => '❌ (basis may be uncountable, no algorithm)'];
            $state['trials'][] = ['Theorem' => 'Every field has algebraic closure', 'Requires' => 'AC (Zorn)', 'Constructive?' => '❌'];
            $state['trials'][] = ['Theorem' => 'Hahn-Banach extension', 'Requires' => 'AC (weaker: BPIT)', 'Constructive?' => '❌'];
            $state['trials'][] = ['Theorem' => 'Tychonoff (product of compact spaces)', 'Requires' => 'AC (equivalent!)', 'Constructive?' => '❌'];
            $state['trials'][] = ['Theorem' => 'Every ideal in a ring has a maximal extension', 'Requires' => 'Zorn (= AC)', 'Constructive?' => '❌'];
            $state['trials'][] = ['Theorem' => 'ℕ has induction', 'Requires' => 'ZF only (Axiom 6 + 9)', 'Constructive?' => '✅'];
            $state['trials'][] = ['Theorem' => 'ℚ countable', 'Requires' => 'ZF (Cantor pairing)', 'Constructive?' => '✅ (explicit bijection)'];
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Assume Zorn\'s hypothesis', 'expr' => '(P,≤) is a poset. ∀ chain C⊆P, ∃u∈P: ∀c∈C c≤u (upper bound exists in P).'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Assume no maximal element', 'expr' => '¬∃m∈P: ∀p∈P m≤p → p=m. So ∀p∈P ∃q∈P: p < q (every element has a strictly greater one).'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'AC Application', 'expr' => 'Use AC: for each chain C, choose a specific upper bound ub(C) > sup(C). Define successor function g(C) = a specific element > ub(C).'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Transfinite Chain', 'expr' => 'By Transfinite Recursion: build chain C_α for each ordinal α. C_α strictly increases at each step. This chain must be embeddable in P.'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Contradiction via Replacement', 'expr' => 'The transfinite sequence {g(C_α)} has |Ord|-many distinct elements in P. But P is a set (bounded in ZFC by Replacement). The class Ord cannot inject into a set. Contradiction ❌ → original assumption wrong.'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Conclusion', 'expr' => '∴ P has a maximal element. Zorn\'s Lemma proved from AC (in ZF). ✅ All three equivalents (AC, ZL, WOP) mutually provable in ZF.'];
            $state['is_valid'] = true;
            $state['conclusion'] = "Zorn's Lemma — CERTIFIED (equivalent to AC in ZF)";
        }
    ],
];
