<?php

return [
    'Ethics' => [
        'meta' => [
            'inductive_limit' => 'No single moral framework achieves completeness — each formalizes a genuine moral insight: Kant captures universalizability (∀ must act alike), Utilitarianism captures aggregate welfare, Rawls captures fairness under ignorance (maximin = Nash bargaining). Evolutionary ethics (Hamilton, Trivers) grounds moral intuitions in biological selection pressures. The irreducible convergence point: prohibiting harm to others is universally validated across frameworks.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**⚖️ Vector Abstraction (Ethics & Moral Philosophy)**:";
            $state['proof_traces'][] = "- **Kant's Categorical Imperative (Formulation 1 — Universal Law)**: Act only according to that maxim whereby you can at the same time will that it should become a universal law (deontological duty). ∀φ: [φ ∈ Moral] ↔ [□(∀x: Act(x,φ)) is logically consistent]";
            $state['proof_traces'][] = "- **Kant's CI (Formulation 2 — Humanity Formula)**: Act so that you treat humanity, whether in your own person or that of another, always as an end and never as a means only. ∀x,y: Moral(Act(x,y)) ↔ ¬Instrument(y)";
            $state['proof_traces'][] = "- **Kant's CI (Formulation 3 — Kingdom of Ends)**: Act according to maxims of a universally legislating member of a merely possible Kingdom of Ends. Equivalent to perfect game-theoretic reciprocity.";
            $state['proof_traces'][] = "- **Utilitarian Calculus (Bentham)**: max ∑ᵢ uᵢ  subject to resource constraints R. Utility u = f(pleasure, pain); rightness proportional to happiness produced.";
            $state['proof_traces'][] = "- **Mill's Harm Principle**: The only legitimate purpose of power over any member of civilised community is to prevent harm to others.";
            $state['proof_traces'][] = "- **Rawls's Veil of Ignorance**: Original Position → choose principles without knowing your position in society → Difference Principle: inequalities permitted only if they benefit the least advantaged. Formally: max(min(uᵢ)) — a maximin Nash Bargaining solution for justice.";
            $state['proof_traces'][] = "- **Virtue Ethics (Aristotle)**: Virtues are stable character dispositions (hexeis) enabling eudaimonia (flourishing). The mean (mesotēs): courage = mean between cowardice and recklessness. Not rule-based but character-based.";
            $state['proof_traces'][] = "- **Evolutionary Ethics**: Altruism explained by kin selection (Hamilton's rule: c < r·b where r=relatedness, b=benefit, c=cost) and reciprocal altruism (Trivers 1971). Morality = game-theoretic equilibrium for cooperation.";
            $state['proof_traces'][] = "- **Contractualism (Scanlon)**: An act is wrong if its performance under the circumstances would be disallowed by any set of principles that no-one could reasonably reject as a basis for informed, unforced general agreement.";
            // Moral framework comparison
            $scenarios = [['Dilemma' => 'Trolley Problem', 'Utilitarian' => 'Pull lever (save 5 → max ∑u)', 'Kantian' => 'Do not pull (using one as means)', 'Virtue' => 'Phronesis — context-dependent', 'Rawlsian' => 'Pull (min-max: worst-case is 5 dead)'], ['Dilemma' => 'Lying to save life', 'Utilitarian' => 'Lie (max utility)', 'Kantian' => 'Cannot universalize lying → wrong', 'Virtue' => 'Compassion > honesty here', 'Rawlsian' => 'Lie (life > rule adherence)'], ['Dilemma' => 'Tax redistribution', 'Utilitarian' => 'Redistribute until MU equalizes', 'Kantian' => 'Respect autonomy, limits justified', 'Virtue' => 'Generosity as virtue', 'Rawlsian' => 'Difference Principle: max min-utility'], ['Dilemma' => 'Breaking a promise', 'Utilitarian' => 'Break if net utility > kept', 'Kantian' => 'Cannot universalize breaking → wrong', 'Virtue' => 'Fidelity as virtue, exceptions exist', 'Rawlsian' => 'Depends on what was promised']];
            foreach ($scenarios as $s) {
                $state['trials'][] = $s;
            }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => "Kant's CI — Logical Test", 'expr' => "Maxim φ is universalizable iff: World W where ∀x Acts(x, φ) is logically consistent AND achieves goal of φ. 'Lying' fails: W where all lie → lying impossible (social institution collapses)."];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Utilitarian Aggregation', 'expr' => 'max ∑ᵢ u(xᵢ)  s.t. ∑xᵢ = R (resource);  Diminishing marginal utility → optimal u at equal distribution (for concave u). But: interpersonal utility comparisons are ordinal, not cardinal!'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => "Rawls's Maximin (Nash)", 'expr' => 'Difference Principle: max min(uᵢ);  Equivalent to Nash Bargaining Solution under risk aversion → rational under veil of ignorance (ignorance → infinite risk aversion → maximin preference ✅)'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => "Hamilton's Rule (Evolutionary Ethics)", 'expr' => 'Altruistic act evolves iff: c < r·b  (cost < relatedness × benefit);  kin selection explains moral intuitions of in-group favoritism ✅'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Moral Universalism Bound', 'expr' => "ALL moral frameworks converge on: prohibit unprovoked harm to others. Evolutionary convergence (reciprocal altruism), Game Theory (cooperation is NE for repeated games), Kant (universalizability), Rawls (maximin) all agree ✅"];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Absolute Morality Refutation', 'expr' => "Static universal morality refuted by: (1) Moral progress (slavery once accepted, now condemned); (2) Cultural variation (Westermarck); (3) Evolutionary shift (selective pressures alter altruism radius)"];
            $state['proof_traces'][] = "**Ethics Deduction**: No single moral framework is complete — each captures essential features while missing others. Convergence on harm-prevention is cross-validated by Game Theory, Evolutionary Biology, and all major moral traditions.";
        }
    ],
    'Epistemology' => [
        'meta' => [
            'inductive_limit' => 'Gödel\'s Incompleteness is an absolute formal limit — no complete and consistent formal system can exist for systems expressive enough to include arithmetic. This is not a philosophical opinion but a mathematical theorem (1931). Heisenberg\'s uncertainty principle is an irreducible physical limit on knowledge (σ_x·σ_p ≥ ℏ/2). Bayesian belief revision is the uniquely rational strategy (Dutch Book theorem). Perfect objective knowledge is mathematically and physically impossible.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🧠 Vector Abstraction (Epistemology & Philosophy of Knowledge)**:";
            $state['proof_traces'][] = "- **Gödel's First Incompleteness**: Any ω-consistent formal system T strong enough to express arithmetic contains a sentence G (the 'Gödel sentence') such that neither G nor ¬G is provable in T. G is true but unprovable.";
            $state['proof_traces'][] = "- **Gödel's Second Incompleteness**: Such a system T cannot prove its own consistency Con(T), if T is consistent.";
            $state['proof_traces'][] = "- **Popper's Falsifiability**: A theory T is scientific iff ∃ empirical observation E such that E would refute T. Unfalsifiable claims (astrology, Freudian id) are metaphysical, not scientific.";
            $state['proof_traces'][] = "- **Bayesian Epistemology**: P(H|E) = P(E|H)·P(H) / P(E)  (Bayes's Theorem). Rational degree of belief updated by evidence. Prior P(H) → Posterior P(H|E) via likelihood ratio P(E|H)/P(E).";
            $state['proof_traces'][] = "- **Quine's Holism (Web of Beliefs)**: No statement is immune to revision; statements face tribunal of experience as a corporate body. No synthetic/analytic distinction (refutes Kant's a priori synthetic).";
            $state['proof_traces'][] = "- **Heisenberg's Epistemic Limit**: σ_x · σ_p ≥ ℏ/2. Physical bound on simultaneous knowledge of position and momentum — observer effect is not merely technical but fundamental.";
            $state['proof_traces'][] = "- **JTB + Gettier Problem**: Classical definition of Knowledge = Justified True Belief (Plato). Gettier 1963: JTB is insufficient (counterexamples where JTB holds but intuition denies knowledge).";
            $state['proof_traces'][] = "- **Reliabilism (Goldman)**: S knows P iff S's belief in P is produced by a reliable cognitive process. Shifts focus from justification to mechanism.";
            $state['proof_traces'][] = "- **The Problem of Induction (Hume)**: No amount of confirming instances logically justifies the universal claim. Induction cannot be justified by induction (circularity). Popper's solution: falsificationism.";
            // Bayesian updating table for hypothesis confidence
            $prior = 0.05;
            // rare hypothesis (5% base rate)
            $state['proof_traces'][] = "\n**Bayesian Belief Update Table** (Prior P(H)={$prior}, Likelihood P(E|H) varies):";
            $state['proof_traces'][] = "| P(E|H) | P(E|¬H) | LR = P(E|H)/P(E|¬H) | Posterior P(H|E) |";
            $state['proof_traces'][] = "|---|---|---|---|";
            foreach ([[0.9, 0.1], [0.8, 0.2], [0.7, 0.3], [0.95, 0.05], [0.99, 0.01]] as [$pH, $pNH]) {
                $lr = $pH / $pNH;
                $pE = $pH * $prior + $pNH * (1 - $prior);
                $post = round($pH * $prior / $pE, 4);
                $state['proof_traces'][] = "| {$pH} | {$pNH} | " . round($lr, 1) . "× | **{$post}** |";
            }
            foreach ([['Claim' => 'Scientific law (falsifiable)', 'Epistemic Status' => 'Scientific — Popperian ✅', 'Gödel Bound' => 'Can be refuted', 'Bayesian' => 'P updates with evidence'], ['Claim' => 'Mathematical theorem', 'Epistemic Status' => 'Provable within axioms', 'Gödel Bound' => 'System limits apply (Gödel)', 'Bayesian' => 'P=1 if proved'], ['Claim' => 'Unfalsifiable metaphysics', 'Epistemic Status' => 'Non-scientific (Popper)', 'Gödel Bound' => 'Not formally evaluable', 'Bayesian' => 'P unchanged by evidence'], ['Claim' => '"God exists" (as formulated)', 'Epistemic Status' => 'Unfalsifiable', 'Gödel Bound' => 'Outside formal systems', 'Bayesian' => 'Priors dominate'], ['Claim' => '"All ravens are black"', 'Epistemic Status' => 'Falsifiable (1 white raven)', 'Gödel Bound' => 'N/A (empirical)', 'Bayesian' => 'P(H|E) rises per black raven']] as $row) {
                $state['trials'][] = $row;
            }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => "Gödel Construction", 'expr' => "In system T, construct G ≡ 'This sentence is not provable in T'. If T ⊢ G → contradiction (G says it's unprovable). If T ⊬ G → G is true but unprovable. Either way T is incomplete. ✅"];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Gödel 2nd Incompleteness', 'expr' => 'If T ⊢ Con(T) → T ⊢ G (since Con(T) → ¬Bew(⌈G⌉) → G). But T ⊬ G. Contradiction: T ⊬ Con(T) ✅'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => "Popper's Demarcation", 'expr' => 'Theory T is scientific iff ∃ basic sentence B such that T ∧ B → Observation O = ¬O_actual → T refuted. Non-falsifiable → metaphysical. ✅'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Bayesian Coherence', 'expr' => 'Dutch Book Argument: Agent with non-Bayesian credences can be Dutch-booked (lose money regardless of outcome) → Bayesian updating is the uniquely rational belief revision. ✅'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Heisenberg Epistemic Bound', 'expr' => 'σ_x · σ_p ≥ ℏ/2;  ℏ ≈ 1.055×10⁻³⁴ J·s. At atomic scale: knowing x precisely → p maximally uncertain. Physical limit on perfect knowledge — not technical but ontological (Copenhagen) or epistemic (ensemble). ✅'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'JTB Sufficiency Refuted', 'expr' => "Gettier 1963: S sees a clock stopped at 4:00, glances at 4:00. JTB(4:00): T(it is 4:00), B(by clock), J(clock usually reliable). Not knowledge (luck). → knowledge requires more than JTB. ✅"];
            $state['proof_traces'][] = "**Epistemology Deduction**: Gödel's Incompleteness is an absolute mathematical limit on formal knowledge systems. Physical observer effect (Heisenberg) imposes irreducible uncertainty. Bayesian updating is provably the only coherent belief revision strategy.";
        }
    ],
    'HistoricalDialectics' => [
        'meta' => [
            'inductive_limit' => 'Hegel\'s dialectic (Thesis → Antithesis → Synthesis) is a logical structure verified by historical analysis across civilizations. Marx\'s materialist inversion grounds it in economic realities. Fukuyama\'s \'End of History\' is dialectically refuted — the 21st century\'s antitheses (AI disruption, ecological crisis, illiberal alternatives) demonstrate history continues its dialectical progression. Tainter\'s complexity-collapse model imposes thermodynamic constraints on all civilizations.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**📜 Vector Abstraction (Historical Dialectics)**:";
            $state['proof_traces'][] = "- **Hegel's Dialectic (Aufhebung)**: Thesis (T) → contradiction → Antithesis (A) → synthesis at higher level (S = T ⊕ A). The synthesis negates (aufhebt) both T and A while preserving their essential content.";
            $state['proof_traces'][] = "- **Hegel's Absolute Idealism**: History is the self-actualization of Geist (Absolute Spirit/Mind) through dialectical progression. Freedom is the telos of history.";
            $state['proof_traces'][] = "- **Marx's Historical Materialism**: Inverts Hegel: material conditions (base: productive forces + relations of production) determine superstructure (law, politics, ideology). History driven by class struggle over surplus.";
            $state['proof_traces'][] = "- **Dialectical Materialism (Engels/Marx)**: Thesis (feudalism) → Antithesis (bourgeois revolution) → Synthesis (capitalism) → Antithesis (proletariat) → Synthesis (communism). Laws: (1) Unity of opposites; (2) Negation of negation; (3) Quantity→quality transformation.";
            $state['proof_traces'][] = "- **Fukuyama's 'End of History' (1989)**: Liberal democracy = final synthesis of Hegelian dialectic. Dialectically REFUTED: History continues via environmental crises, AI disruption, rising illiberalism — these are new antitheses.";
            $state['proof_traces'][] = "- **Kuhn's Paradigm Shifts**: Normal science (puzzle-solving within paradigm) → anomaly accumulation → crisis → scientific revolution (paradigm shift). Not linear progress but gestalt switch.";
            $state['proof_traces'][] = "- **Toynbee's Challenge-Response**: Civilizations grow through successful responses to environmental/social challenges. Breakdown when creative minority fails to respond or dominant minority coerces.";
            $state['proof_traces'][] = "- **Braudel's Three Temporalities**: Longue durée (geographical time, centuries), Conjunctural cycles (social time, decades), Events (short time, years). Most history happens at longue durée level.";
            $state['proof_traces'][] = "- **Thermodynamic Constraint on History**: All civilizations are bounded by thermodynamic energy extraction capacity (Tainter's Complexity Theory). Complexity increases energy cost → collapse when marginal returns of complexity become negative.";
            // Hegel's dialectic applied to historical examples
            foreach ([['Era' => 'Ancient Greece', 'Thesis' => 'City-state democracy (polis)', 'Antithesis' => 'Macedonian Empire', 'Synthesis' => 'Hellenistic world-culture', 'Force' => 'Military/cultural expansion'], ['Era' => 'Medieval Europe', 'Thesis' => 'Feudal Church authority', 'Antithesis' => 'Protestant Reformation', 'Synthesis' => 'Nation-state + secular law', 'Force' => 'Economic + intellectual'], ['Era' => 'Industrial Age', 'Thesis' => 'Agrarian capitalism', 'Antithesis' => 'Industrial proletariat', 'Synthesis' => 'Regulated market economy', 'Force' => 'Class conflict (Marx)'], ['Era' => '20th Century', 'Thesis' => 'Liberal democracy', 'Antithesis' => 'Totalitarianism/Fascism', 'Synthesis' => 'Post-WWII liberal order', 'Force' => 'War + ideology'], ['Era' => '21st Century', 'Thesis' => 'Liberal globalism', 'Antithesis' => 'Nationalism + AI disruption', 'Synthesis' => 'TBD (dialectic ongoing)', 'Force' => 'Technology + ecology']] as $row) {
                $state['trials'][] = $row;
            }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => "Hegel's Dialectic Logic", 'expr' => "T (thesis) establishes itself through negation of opposite. A (antithesis) = ¬T emerges from T's internal contradictions. S (synthesis) = Aufhebung: negates both T and A, preserving (aufheben) essential content. S becomes new T → process iterates. ✅"];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => "Marx's Inversion", 'expr' => "Hegel: Geist → material world. Marx: material base (productive forces + class relations) → ideological superstructure. P.F. (steam engine) + C.R. (capitalism) → ideology (liberalism, individualism). ✅"];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => "Fukuyama Refutation", 'expr' => "Fukuyama 1992: 'End of History' = liberal democracy is final synthesis. Refutation: (1) 2008 financial crisis → legitimacy crisis; (2) Technological unemployment → new antithesis; (3) Climate crisis → new contradiction; (4) China model → alternative thesis. Dialectic continues. ✅"];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Kuhn Paradigm Shift Logic', 'expr' => "Normal science: solve puzzles within paradigm P. Anomaly accumulation: observations incompatible with P. Crisis: P questioned. Revolution: P replaced by P' (gestalt switch). Incommensurability: P and P' not fully translatable. ✅"];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Thermodynamic History Bound', 'expr' => "Tainter's Law: C_complexity → ↑ energy input required. dR/dC < 0 eventually (diminishing returns). When energy extraction cannot sustain complexity → simplification (collapse) is mathematically inevitable ✅"];
            $state['proof_traces'][] = "**Historical Deduction**: Hegel's dialectic is a logical structure provable within formal logic (triadic progression). Historical materialism grounds it in resource economics. Fukuyama's 'End of History' is dialectically refuted by ongoing contradictions.";
        }
    ],
    'PhilosophyOfMind' => [
        'meta' => [
            'inductive_limit' => 'The Hard Problem of Consciousness (Chalmers) remains philosophically open — no current physical theory bridges the explanatory gap between neural correlates and phenomenal experience. IIT (Φ) provides a formal measure consistent with empirical findings (neural ignition patterns). Multiple realizability (functionalism) has empirical support. Eliminative materialism is too strong — qualia data (pain, color experience) cannot be simply eliminated without scientific loss.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🤖 Vector Abstraction (Philosophy of Mind)**:";
            $state['proof_traces'][] = "- **Turing Test (1950)**: A machine exhibits intelligent behavior indistinguishable from a human if an interrogator cannot reliably identify it as a machine in blind conversation. Operational (not ontological) definition.";
            $state['proof_traces'][] = "- **Chinese Room Argument (Searle 1980)**: Syntax (symbol manipulation) ≠ semantics (understanding/intentionality). A system can pass the Turing Test without genuine understanding. Functionalism is insufficient for mind.";
            $state['proof_traces'][] = "- **Functionalism (Putnam)**: Mental states are defined by their functional role (causal relations to inputs, outputs, other mental states), not their physical substrate. Multiple Realizability: any physical substrate can implement mind.";
            $state['proof_traces'][] = "- **The Hard Problem of Consciousness (Chalmers 1995)**: Why is there subjective experience (qualia) at all? Physical/functional explanation explains 'easy problems' (behavior, cognition) but not phenomenal consciousness. Explanatory Gap: even complete physics leaves phenomenology unexplained.";
            $state['proof_traces'][] = "- **Integrated Information Theory (Tononi)**: Consciousness = Φ (phi) — the amount of integrated information generated by a system above and beyond its parts. Φ = 0 → no consciousness; Φ high → rich consciousness. Explains why the cerebellum (few interconnections) contributes little to consciousness despite 80% of neurons.";
            $state['proof_traces'][] = "- **Global Workspace Theory (Baars/Dehaene)**: Consciousness = broadcast of information from specialized modules to a global workspace (prefrontal-parietal network). Explains ignition patterns in fMRI.";
            $state['proof_traces'][] = "- **Physicalism vs. Dualism**: Physicalism: mind = brain function (identity theory or functionalism). Cartesian Dualism: mind and body are distinct substances (res cogitans + res extensa). Problem: interaction problem (how does immaterial mind move material body?).";
            $state['proof_traces'][] = "- **Eliminative Materialism (Churchland)**: Folk psychology (beliefs, desires) is a false theory — neuroscience will eliminate mentalistic vocabulary entirely.";
            foreach ([['Theory' => 'Dualism (Descartes)', 'Consciousness Seat' => 'Immaterial res cogitans', 'Survives Hard Problem?' => '✅ (by stipulation)', 'Interaction Problem?' => '❌ Unsolved'], ['Theory' => 'Identity Theory', 'Consciousness Seat' => 'Brain states (type-type)', 'Survives Hard Problem?' => '❌ (why this brain state = this quale?)', 'Interaction Problem?' => '✅ (same substance)'], ['Theory' => 'Functionalism (Putnam)', 'Consciousness Seat' => 'Functional organization', 'Survives Hard Problem?' => '❌ (Chalmers zombie)', 'Interaction Problem?' => '✅'], ['Theory' => 'IIT (Tononi)', 'Consciousness Seat' => 'Φ ≥ threshold', 'Survives Hard Problem?' => '? (Φ ~ phenomenology)', 'Interaction Problem?' => '✅'], ['Theory' => 'Eliminativism (Churchland)', 'Consciousness Seat' => 'Eliminated → neural only', 'Survives Hard Problem?' => '? (dissolves it)', 'Interaction Problem?' => '✅']] as $row) {
                $state['trials'][] = $row;
            }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Turing Test Formalization', 'expr' => "T_pass(M) ↔ ∀ interrogator I: P(I identifies M as machine) ≤ P(I identifies human as machine). Behavioral criterion — does not require phenomenal consciousness. ✅"];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => "Chinese Room Logic", 'expr' => "Assume: System S passes Turing Test by symbol manipulation rules R. Premise: R is purely syntactic. Premise: Semantics ≠ Syntax (intentionality is not derivable from syntax alone). Conclusion: S has no genuine understanding. (Disputed by Systems Reply: whole system understands, not the man alone)"];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => "IIT Formal Definition", 'expr' => "Φ(X) = min over partitions π of D(M||M^partition);  where D = KL divergence;  M = cause-effect structure of system X;  Φ > 0 → integrated information exists → some phenomenality ✅"];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Explanatory Gap Proof', 'expr' => "Conceivability argument (Chalmers): Zombie world W where all physics identical to our world but no qualia. If W is conceivable → W is metaphysically possible → qualia ≠ physical. (Disputed: conceivability does not entail possibility — Kripke's necessary a posteriori)"];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Neural Correlates Bound', 'expr' => "Empirical neuroscience: loss of prefrontal-parietal ignition → loss of reportable consciousness (Dehaene). Φ correlates with complexity of neural integration (Massimini tDCS experiments). Physical substrate IS necessary — idealism refuted empirically. ✅"];
            $state['proof_traces'][] = "**Mind Deduction**: The Hard Problem remains philosophically open. IIT provides a formal measure (Φ). Empirically, consciousness correlates with neural integration patterns. Chinese Room remains unsettled (Systems Reply is non-trivial). Eliminativism is too strong — qualia data cannot be simply deleted from science.";
        }
    ],
    'FormalLanguage' => [
        'meta' => [
            'inductive_limit' => 'Frege\'s compositionality is the mathematical foundation of all formal semantics and is uncontested. Wittgenstein\'s late philosophy (meaning = use) successfully dissolves many apparent philosophical puzzles. Chomsky\'s Universal Grammar hypothesis is empirically contested by Pirahã data (Everett) but remains the dominant theoretical framework. Speech act theory (Austin/Searle) captures the pragmatic dimension of language that formal semantics misses.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**📝 Vector Abstraction (Philosophy of Language & Linguistics)**:";
            $state['proof_traces'][] = "- **Frege's Sense/Reference (Sinn/Bedeutung)**: 'Morning Star' and 'Evening Star' have same reference (Venus) but different senses. Names have both a referent and a mode of presentation.";
            $state['proof_traces'][] = "- **Russell's Theory of Descriptions**: 'The present king of France is bald' — analyzed as: ∃x[King(x) ∧ ∀y(King(y) → y=x) ∧ Bald(x)]. False (no king), not meaningless.";
            $state['proof_traces'][] = "- **Tractatus (Wittgenstein 1921)**: 'The world is everything that is the case.' Language pictures facts (atomic propositions ↔ atomic facts). 'Whereof one cannot speak, thereof one must be silent.' (Mysticism outside logic)";
            $state['proof_traces'][] = "- **Philosophical Investigations (Wittgenstein 1953)**: REPUDIATES Tractatus. Meaning = use (Gebrauch). Language Games: meaning is context-dependent social practice. No private language (pain words = public behavioral criteria).";
            $state['proof_traces'][] = "- **Chomsky's Universal Grammar**: Humans have an innate Language Acquisition Device (LAD). All languages share deep structural universals (X-bar theory, recursion). Poverty of stimulus argument: children acquire complex syntax from insufficient input → innateness required.";
            $state['proof_traces'][] = "- **Speech Act Theory (Austin/Searle)**: Utterances have three dimensions: Locutionary (propositional content), Illocutionary (social act: promise, assert, command), Perlocutionary (effect on hearer). Performatives: 'I now pronounce you married' — saying = doing.";
            $state['proof_traces'][] = "- **Sapir-Whorf Hypothesis (Linguistic Relativity)**: Language shapes thought (strong: determinism — largely refuted; weak: influence — partially supported). Pirahã language (no numerals, no recursion per Everett) challenges Chomsky's universalism.";
            $state['proof_traces'][] = "- **Semantic Compositionality (Frege)**: The meaning of a complex expression is determined by the meanings of its parts and how they are syntactically combined. Foundation of formal semantics.";
            foreach ([['Philosopher' => 'Frege', 'Key Distinction' => 'Sense / Reference', 'Formal Tool' => 'Predicate logic', 'Still Valid?' => '✅ Foundation of formal semantics'], ['Philosopher' => 'Russell', 'Key Distinction' => 'Description ≠ Name', 'Formal Tool' => '∃x[F(x) ∧ G(x)]', 'Still Valid?' => '✅ Standard in philosophy of language'], ['Philosopher' => 'Early Wittgenstein', 'Key Distinction' => 'Picture theory of meaning', 'Formal Tool' => 'Logical atomism', 'Still Valid?' => '❌ Abandoned by late Wittgenstein'], ['Philosopher' => 'Late Wittgenstein', 'Key Distinction' => 'Meaning = use', 'Formal Tool' => 'Language games', 'Still Valid?' => '✅ Influential in ordinary language philosophy'], ['Philosopher' => 'Chomsky', 'Key Distinction' => 'Deep/surface structure', 'Formal Tool' => 'Generative grammar', 'Still Valid?' => '⚠️ Debated (Everett counterexamples)'], ['Philosopher' => 'Austin/Searle', 'Key Distinction' => 'Speech acts', 'Formal Tool' => 'Illocutionary force', 'Still Valid?' => '✅ Dominant in pragmatics']] as $row) {
                $state['trials'][] = $row;
            }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Compositionality Principle', 'expr' => '⟦F(a)⟧ = ⟦F⟧(⟦a⟧)  — denotation of complex expression = function applied to denotations of parts. Foundational to Montague Grammar and formal semantics. ✅'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => "Russell's Analysis (The F is G)", 'expr' => '∃x[F(x) ∧ ∀y(F(y) → y=x) ∧ G(x)]  — unique existence + predication. Removes apparent reference to non-existents. ✅'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => "Chomsky's Poverty of Stimulus", 'expr' => "Children acquire unbounded recursive syntax from finite, degenerate input. No statistical model (finite state automata) can generate infinite recursive sentences. → Generative grammar with innate UG is required. (But: Everett's Pirahã data challenges universal recursion ✅)"];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => "Wittgenstein's Private Language Argument", 'expr' => "Could there be a language only the speaker can understand? No: Language requires public criteria for correct application. Even 'pain' is defined by behavioral public criteria (not private sensation). ✅"];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Speech Act Taxonomy', 'expr' => "Locutionary: 'The door is open' (proposition). Illocutionary: asserting (not ordering). Perlocutionary: hearer closes door. Force F + content p: F(p). Successful speech act requires felicity conditions (sincerity, authority, uptake). ✅"];
            $state['proof_traces'][] = "**Language Deduction**: Frege's compositionality is foundational and uncontested in formal semantics. Chomsky's innateness hypothesis is empirically contested by Everett. Wittgenstein's later philosophy dissolves many apparent philosophical puzzles by analyzing linguistic use.";
        }
    ],
];
