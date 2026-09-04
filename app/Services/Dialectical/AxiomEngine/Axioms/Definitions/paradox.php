<?php

return [
    'russell' => [
        'meta' => [
        ],
        'phase2' => function(&$state, $solver) {
            $state['trace'] = ["**Step 1 — Frege's Axiom V**: Unrestricted comprehension: ∀P: ∃S: ∀x(x ∈ S ↔ P(x)).", "**Step 2 — Instantiation**: Let P(x) = (x ∉ x). Then ∃R: ∀x(x ∈ R ↔ x ∉ x).", "**Step 3 — Self-application**: Ask: R ∈ R?", "  → R ∈ R iff R ∉ R (by definition of R). This is R ∈ R ↔ ¬(R ∈ R). Contradiction ❌.", "**Step 4 — ZFC Resolution**: Replace Axiom V with Separation Schema:", "  ∀T∀P∃S∀x(x ∈ S ↔ x ∈ T ∧ P(x)). Formation of R = {x | x ∉ x} requires a pre-existing set T.", "  R = {x ∈ T | x ∉ x} exists, but R ∈ R → R ∈ T ∧ R ∉ R → R ∉ T. So R ∉ T, R is not a member of itself — no paradox.", "**Step 5 — Type Theory Resolution**: Russell (1908) stratifies objects by type (0=individuals, 1=classes of individuals, 2=classes of classes,...). Self-membership x ∈ x is syntactically ill-typed → forbidden.", "**Step 6 — NBG Resolution**: R = {x | x ∉ x} is a proper class (not a set). Proper classes cannot be members of anything — paradox dissolved."];
            $state['is_valid'] = false;
        }
    ],
    'sorites' => [
        'meta' => [
        ],
        'phase2' => function(&$state, $solver) {
            $state['trace'] = ["**Step 1 — Classical Formalization**: P = 'is a heap'; Premise 1: ¬P(1). Premise 2: ∀n: ¬P(n) → ¬P(n+1). By mathematical induction: ∀n: ¬P(n). Contradiction with P(1,000,000).", "**Step 2 — Why Induction Fails**: Premise 2 is false in classical logic for vague predicates — there exists a sharp cut-off n* such that ¬P(n*) ∧ P(n*+1). The sorites paradox shows classical logic forces a sharp boundary that semantically doesn't exist.", "**Step 3 — Fuzzy Logic (Zadeh 1965)**: Replace truth values {0,1} with [0,1]. μ_heap: ℕ → [0,1], μ_heap(n) = 1/(1+e^{-k(n-θ)}) (logistic). Premise 2 rewritten: μ_heap(n+1) ≥ μ_heap(n) (monotone, not discrete jump). Induction produces μ_heap(∞) = 1 — consistent.", "**Step 4 — Supervaluationism (Fine 1975)**: Fix all admissible precisifications (sharpenings): each assigns a sharp threshold t_i. P is supertrue iff P is true on all sharpenings. LEM (A∨¬A) is supertrue. But for borderline cases, neither A nor ¬A is supertrue — there is a truth-value gap.", "**Step 5 — Epistemic View (Williamson 1994)**: There IS a sharp boundary; we just cannot know it (bounded cognitive access). Vagueness is epistemic, not semantic. The paradox arises from our ignorance of the precise threshold.", "**Step 6 — Inductive Synthesis**: Classical binary logic is unsuitable for vague predicates. Fuzzy or supervaluationist extensions dissolve the paradox by admitting partial truth or truth-value gaps. The Sorites paradox is a lesson in the limits of bivalent logic."];
            $state['is_valid'] = false;
        }
    ],
    'self_referential' => [
        'meta' => [
        ],
        'phase2' => function(&$state, $solver) {
            $state['trace'] = ["**Step 1 — Classical Binary Evaluation**: S = 'S is false'. Assume bivalence: S ∈ {T, F}.", "**Step 2 — Case T**: S is true → S correctly describes itself → S is false. Contradiction.", "**Step 3 — Case F**: S is false → S's claim ('S is false') is false → S is true. Contradiction.", "**Step 4 — Infinite Loop**: T → F → T → F → ... No fixed point exists in classical logic.", "**Step 5 — Tarski Theorem (1936)**: No consistent formal system L (sufficiently expressive) can contain its own truth predicate. ¬∃T: T(⌈φ⌉) ↔ φ for all φ ∈ L. The Liar sentence would force T(⌈G⌉) ↔ ¬T(⌈G⌉) — contradiction.", "**Step 6 — Language Hierarchy**: Object language L₀ talks about objects. L₁ (metalanguage) talks about truth in L₀. L₂ talks about truth in L₁. Each 'this sentence is false' is always about a sentence in the next lower level — no true self-reference.", "**Step 7 — Paraconsistent Resolution**: Reject Ex Falso Quodlibet (⊥ ⊢ A). Contradictions are 'true' but contained — do not infect other propositions. The Liar is both true and false (dialethism, Priest 1987). Not universally accepted.", "**Step 8 — Revision Theory (Gupta-Belnap 1993)**: Truth is a revision process. Start with arbitrary valuation v₀. Apply Liar → revision sequence v₁, v₂, .... Stable truth = convergence of this sequence. Liar never stabilizes (paradoxical) — classified as pathological."];
            $state['is_valid'] = false;
        }
    ],
    'yablo' => [
        'meta' => [
        ],
        'phase2' => function(&$state, $solver) {
            $state['trace'] = ["**Step 1 — Assume some S_n is True**: S_n says all S_k for k > n are false → S_{n+1} is false.", "**Step 2 — S_{n+1} false**: S_{n+1} says all S_k for k > n+1 are false. S_{n+1} is false → ∃m > n+1: S_m is true.", "**Step 3 — Contradiction with Step 1**: S_n true → all k > n are false → S_m is false. But Step 2 says S_m is true. Contradiction. ❌", "**Step 4 — Assume ALL S_n are False**: ∀n: S_n is false → ∀n: ∃m > n: S_m is true (since S_n said 'all k>n false' but S_n is false). → Some S_m is true — contradicting assumption. ❌", "**Step 5 — Non-Self-Reference**: No S_n refers to itself — only to S_{n+k} for k ≥ 1. Yet contradiction is generated. Yablo's claim: self-reference is NOT the essential ingredient of semantic paradoxes.", "**Step 6 — Priest's Reply (1997)**: The sequence as a whole is self-referential via the predicate 'sentence in this sequence'. The paradox involves reference to the extension of a predicate that includes the referring sentence — implicit self-reference.", "**Step 7 — Non-Wellfounded Resolution**: Non-wellfounded set theory (AFA, Aczel 1988) allows circular set membership. Yablo's sentences can have a consistent model in AFA where the 'truth' predicate is defined via a greatest fixed-point construction."];
            $state['is_valid'] = false;
        }
    ],
    'epistemic' => [
        'meta' => [
        ],
        'phase2' => function(&$state, $solver) {
            $state['trace'] = ["**Step 1 — Fitch (if applicable)**: □(p → ◇Kp). Consider t = (p ∧ ¬Kp). By premise: ◇K(p ∧ ¬Kp). But K(A∧B) → KA∧KB → K(p)∧K(¬Kp) → Kp∧¬Kp → ⊥. So ¬◇K(p∧¬Kp). Combined with verificationism: ¬(p∧¬Kp) for all p → Kp. All truths are known. Contradiction with ordinary epistemic humility.", "**Step 2 — Gettier (if applicable)**: Classic JTB: S knows p iff (1) p is true, (2) S believes p, (3) S is justified in believing p. Gettier: all 3 hold but belief is accidentally true — no knowledge.", "**Step 3 — Causal Requirement**: Add: S knows p only if the fact that p causally explains why S believes p. Avoids Gettier. But: mathematical/modal knowledge has no causal chain to abstract objects.", "**Step 4 — Safety Requirement**: S knows p only if: in nearby possible worlds where S believes p with same method, p is true. Luck = unsafeness of the belief. Handles Gettier cases without causal requirement.", "**Step 5 — Meno Resolution**: Knowledge is not binary — there is tacit knowledge (knowing-how) and explicit knowledge (knowing-that). Recognizing a solution requires knowing the question domain, not the specific answer. Learning = transition from tacit/dispositional to explicit knowledge.", "**Step 6 — Deductive Conclusion**: JTB is necessary but insufficient. A fourth condition is required — causal, safety, virtue, or anti-luck. Fitch's paradox shows verificationism is incompatible with the existence of unknown truths."];
            $state['is_valid'] = false;
        }
    ],
    'decision' => [
        'meta' => [
        ],
        'phase2' => function(&$state, $solver) {
            $state['trace'] = ["**Step 1 — Problem Setup**: Box A = \$1,000 (always visible). Box B = \$1,000,000 (if P predicted one-box) or \$0 (if P predicted two-box). P is 99% accurate.", "**Step 2 — CDT Dominance Argument**: Two-box weakly dominates one-box. For any fixed content of B: two-box yields \$1,000 more. EU_CDT(two-box) > EU_CDT(one-box) regardless of B's content.", "**Step 3 — EDT Calculation**: EU_EDT(one-box) = 0.99×\$1,000,000 + 0.01×\$0 = \$990,000. EU_EDT(two-box) = 0.01×\$1,001,000 + 0.99×\$1,000 = \$10,010 + \$990 = \$11,000. EDT → one-box.", "**Step 4 — The Core Tension**: CDT says dominance is decisive regardless of correlation. EDT says correlation with outcomes matters even if there's no direct causation.", "**Step 5 — Functional DT (Yudkowsky-Soares)**: Ask 'What would a rational agent whose decision-algorithm outputs X cause to happen?' rather than 'What do I cause by choosing X?' FDT one-boxes because a rational one-boxer gets \$990,000 vs rational two-boxer gets \$1,000.", "**Step 6 — Causal Ratificationism (Skyrms 1982)**: An act is ratifiable if, conditional on performing it, it maximizes expected utility. Two-boxing is ratifiable (if you're going to two-box, the predictor predicted this — B is likely empty, \$1,000 > \$0). One-boxing is also ratifiable by the same logic. Stalemate.", "**Step 7 — Resolution**: No decision theory fully captures the intuition. Newcomb's paradox is a fundamental stress-test distinguishing evidential from causal conceptions of rational choice. The disagreement reflects deep ontological commitments about causation and rational agency."];
            $state['is_valid'] = false;
        }
    ],
    'supertask' => [
        'meta' => [
        ],
        'phase2' => function(&$state, $solver) {
            $state['trace'] = ["**Step 1 — Zeno Geometric Series**: Total distance = Σ(n=0..∞) d₀(v_T/v_A)^n = d₀ / (1 − v_T/v_A). For v_A = 2, v_T = 1, d₀ = 100: Total = 100/(1 − 0.5) = 200m. Achilles catches up at t = 200/2 = 100 seconds. ✅", "**Step 2 — Measure Theory**: Each Zeno step has duration t_n = (1/2)^n seconds. Total time = Σ t_n = 1 second. The union of infinitely many intervals has Lebesgue measure 1 — finite. ✅", "**Step 3 — Thomson's Lamp**: The sequence of states (on=1, off=0) at times t_n = 2 − 1/2^n: 1,0,1,0,... has no limit. lim_{n→∞} (-1)^n does not exist. The supertask completion requires assigning a definite state at the limit — but the mathematical model provides no such state.", "**Step 4 — Benacerraf (1962)**: Thomson's lamp description is physically incoherent — no physical process completes ω tasks in finite time with zero transition time. The paradox is an artifact of extending a finite physical model to a transfinite completion.", "**Step 5 — Ross-Littlewood**: With 'remove ball n at step n': ball k is removed at step k → all balls eventually removed → 0 balls at ω. With 'remove highest numbered': no ball is ever removed → ℵ₀ balls at ω. The paradox shows that cardinality at supertask completion depends on the removal ORDER — infinite limits are order-sensitive.", "**Step 6 — Physical Bound**: No physical supertask is realizable — quantum gravity (Planck time t_P ≈ 5.39×10⁻⁴⁴s) provides a minimum physical time interval, making transfinite sequences of physical events impossible.", "**Step 7 — Mathematical Resolution**: Supertasks are mathematically analyzed via transfinite ordinal arithmetic. The 'state at ω' must be specified as an additional axiom — it's not determined by the sequence of finite states. Different choices of limit state yield different, consistent mathematical theories."];
            $state['is_valid'] = false;
        }
    ],
];
