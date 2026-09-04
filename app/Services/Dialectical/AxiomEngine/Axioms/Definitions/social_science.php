<?php

return [
    'GameTheory' => [
        'meta' => [
            'inductive_limit' => 'Nash Equilibria are mathematically guaranteed to exist in every finite game (Brouwer Fixed Point, Nash 1951). The tragedy of the commons and Prisoner\'s Dilemma are permanent features of rational self-interest without binding enforcement — proven repeatedly in experimental economics, international relations, and evolutionary biology.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🎮 Vector Abstraction (Game Theory)**:";
                $state['proof_traces'][] = "- **Nash Equilibrium (NE)**: A strategy profile (s₁*, s₂*, ..., sₙ*) where ∀i: uᵢ(sᵢ*, s₋ᵢ*) ≥ uᵢ(sᵢ, s₋ᵢ*) ∀sᵢ";
                $state['proof_traces'][] = "- **Nash Existence**: Every finite game with mixed strategies has ≥1 Nash Equilibrium (Brouwer Fixed Point Theorem, Nash 1951)";
                $state['proof_traces'][] = "- **Pareto Efficiency**: Allocation A is Pareto-dominant over B if uᵢ(A) ≥ uᵢ(B) ∀i and ∃j: uⱼ(A) > uⱼ(B) (maximizing social welfare)";
                $state['proof_traces'][] = "- **Dominant Strategy**: sᵢ* dominates sᵢ if uᵢ(sᵢ*, s₋ᵢ) > uᵢ(sᵢ, s₋ᵢ) for ALL s₋ᵢ";
                $state['proof_traces'][] = "- **Minimax Theorem (von Neumann 1928)**: For zero-sum games: max_{s₁} min_{s₂} u(s₁,s₂) = min_{s₂} max_{s₁} u(s₁,s₂) = v* (game value)";
                $state['proof_traces'][] = "- **Folk Theorem**: In infinitely repeated games, any payoff above minmax can be sustained as NE if δ (discount factor) is high enough";
                $state['proof_traces'][] = "- **Backward Induction**: In finite perfect-information games, unique subgame-perfect NE found by rolling back from terminal nodes";

                // Prisoner's Dilemma payoff matrix
                $state['trials'][] = ['Player 1 \\ Player 2' => 'Cooperate', 'Cooperate' => '(3, 3) — Pareto Optimal', 'Defect' => '(0, 5) — P2 best'];
                $state['trials'][] = ['Player 1 \\ Player 2' => 'Defect',    'Cooperate' => '(5, 0) — P1 best',       'Defect' => '(1, 1) — Nash Equilibrium ✅'];
                $state['proof_traces'][] = "**🔑 Prisoner's Dilemma (PD) Analysis**: NE = (Defect, Defect) → Pareto inefficient (1,1) despite Pareto optimum existing at (3,3). This is the core tragedy of rational self-interest.";

                // Mixed strategy NE: Battle of the Sexes
                $state['proof_traces'][] = "**Battle of the Sexes Mixed Strategy NE**: P1 plays Opera with p* = 2/3; P2 plays Opera with q* = 1/3. Expected payoffs: EU₁ = EU₂ = 2/3.";
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Nash Existence (Brouwer)', 'expr' => 'The mixed strategy set Σᵢ = Δ(Sᵢ) is compact and convex; best-response BR(σ) is upper-hemicontinuous and convex-valued'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Fixed Point Applied', 'expr' => 'By Brouwer Fixed Point Theorem: ∃σ* such that σ* ∈ BR(σ*) → Nash Equilibrium exists in every finite game ✅'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => "Prisoner's Dilemma NE", 'expr' => 'Dominant strategy: u(Defect, Coop) = 5 > u(Coop, Coop) = 3;  u(Defect, Defect) = 1 > u(Coop, Defect) = 0  → (Defect, Defect) = NE ✅'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Pareto Efficiency Test', 'expr' => '(Coop, Coop) = (3,3) Pareto-dominates NE (Defect, Defect) = (1,1). PD is Pareto-inefficient at NE → Social cost = 4 units/player'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Minimax Bound (Zero-Sum)', 'expr' => 'For zero-sum: max_p min_q u(p,q) = min_q max_p u(p,q) = v*  (von Neumann 1928 — proved via linear programming duality)'];
                $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Folk Theorem Condition', 'expr' => 'Cooperation sustained iff δ ≥ (T−R)/(T−P) where T=temptation, R=reward, P=punishment; for PD: δ ≥ (5−3)/(5−1) = 0.5 ✅'];
                $state['proof_traces'][] = "**Game Theory Deduction**: Nash Equilibrium existence is mathematically guaranteed. Pareto inefficiency in PD is provably unavoidable under simultaneous rational choice without binding commitment mechanism.";
        }
    ],
    'Macroeconomics' => [
        'meta' => [
            'inductive_limit' => 'IS-LM equilibrium is a mathematical identity of goods and money market clearing. The Phillips Curve short-run tradeoff holds empirically but breaks down long-run (Friedman-Phelps hypothesis confirmed by 1970s stagflation). Solow convergence is mathematically verified but requires human capital augmentation (Mankiw-Romer-Weil extension).',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**📊 Vector Abstraction (Macroeconomics)**:";
                $state['proof_traces'][] = "- **IS Curve**: Y = C(Y−T) + I(r) + G + NX  (goods market equilibrium: output = aggregate demand)";
                $state['proof_traces'][] = "- **LM Curve**: M/P = L(Y, r)  (money market equilibrium: real money supply = liquidity demand)";
                $state['proof_traces'][] = "- **IS-LM Intersection**: Determines equilibrium (Y*, r*) simultaneously clearing both markets";
                $state['proof_traces'][] = "- **AS-AD Model**: AD = C + I + G + NX;  SRAS: P = Pᵉ + (1/α)(Y − Ȳ);  LRAS: Y = Ȳ (vertical at potential)";
                $state['proof_traces'][] = "- **Keynesian Multiplier**: k = 1/(1−MPC(1−t)) where MPC = marginal propensity to consume, t = tax rate";
                $state['proof_traces'][] = "- **Phillips Curve (Friedman-Phelps)**: π = πᵉ − ε(u − u_n) + v  (short-run: inflation-unemployment tradeoff; long-run: vertical at u_n)";
                $state['proof_traces'][] = "- **Okun's Law**: ΔY/Ȳ ≈ −2Δu  (1% rise in unemployment ≈ 2% loss in GDP relative to potential)";
                $state['proof_traces'][] = "- **Fisher Equation**: MV = PY → Quantity Theory of Money (V,Y constant → M↑ causes P↑ proportionally)";
                $state['proof_traces'][] = "- **Solow Growth Model**: Y = K^α(AL)^(1−α); Steady state: sf(k*) = (n+g+δ)k*  (s=savings rate, n=pop. growth, g=tech. growth, δ=depreciation)";

                // IS-LM simulation
                // IS: Y = 1000 − 50r;  LM: Y = 500 + 100r (for M/P=500)
                $eqR = (1000 - 500) / (50 + 100); // (IS_intercept - LM_intercept) / (IS_slope + LM_slope)
                $eqY = 1000 - 50 * $eqR;
                foreach ([2, 4, 6, 8, 10] as $r) {
                    $yIS = 1000 - 50 * $r;
                    $yLM = 500 + 100 * $r;
                    $state['trials'][] = [
                        'Interest Rate r (%)' => $r,
                        'IS: Y = 1000−50r'    => $yIS,
                        'LM: Y = 500+100r'    => $yLM,
                        'Equilibrium?'         => abs($yIS - $yLM) < 1 ? 'Yes ✅' : ($yIS > $yLM ? 'Excess Supply (IS>LM)' : 'Excess Demand (LM>IS)'),
                    ];
                }
                $state['proof_traces'][] = sprintf("**IS-LM Equilibrium**: r* = %.2f%%, Y* = %.0f (from intersection of IS: Y=1000−50r and LM: Y=500+100r)", $eqR, $eqY);

                // Keynesian multiplier table
                $state['proof_traces'][] = "\n**Keynesian Multiplier k = 1/(1−MPC) with various MPC values:**";
                $state['proof_traces'][] = "| MPC | Multiplier k | ΔY for ΔG=100 |";
                $state['proof_traces'][] = "|---|---|---|";
                foreach ([0.5, 0.6, 0.7, 0.75, 0.8, 0.9] as $mpc) {
                    $k  = 1 / (1 - $mpc);
                    $dy = $k * 100;
                    $state['proof_traces'][] = "| {$mpc} | " . number_format($k, 2) . " | " . number_format($dy, 0) . " |";
                }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'IS Curve Derivation', 'expr' => 'Goods market: Y = C + I + G;  C = a + b(Y−T);  I = I₀ − dr;  → Y(1−b) = a − bT + I₀ − dr + G  → IS: r = [a−bT+I₀+G − (1−b)Y] / d'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'LM Curve Derivation', 'expr' => 'Money market: M/P = kY − hr  → LM: r = (kY − M/P)/h  (higher Y → higher L → higher r to restore equilibrium)'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'IS-LM Equilibrium', 'expr' => 'Set IS = LM: Y* = [h(a−bT+I₀+G)/d + M/P] / [h(1−b)/d + k]  (fiscal multiplier = h/d/(h(1-b)/d + k))'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Phillips Curve (SR)', 'expr' => 'π = πᵉ − ε(u − uₙ);  if u < uₙ → π > πᵉ (boom → inflation above expectations)  [Friedman-Phelps 1968 ✅]'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'LRPC (Vertical)', 'expr' => 'Long run: πᵉ = π → u = uₙ always (Friedman natural rate hypothesis). Sustained low u requires ever-accelerating inflation ✅'];
                $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Solow Steady State', 'expr' => 'sf(k*) = (n+g+δ)k*;  k* = [s/(n+g+δ)]^(1/(1−α));  Capital per effective worker converges to k* ✅'];
                $state['symbolic_traces'][] = ['step' => '7', 'label' => 'Ricardian Equivalence', 'expr' => 'Tax vs. debt financing neutral if agents perfectly foresee future taxes (Barro 1974). Violated under bounded rationality.'];
                $state['proof_traces'][] = "**Macroeconomic Deduction**: IS-LM equilibrium is mathematically unique. Phillips Curve short-run tradeoff is empirically verified but long-run vertical (Friedman-Phelps). All economic aggregates bounded by physical resource limits.";
        }
    ],
    'Microeconomics' => [
        'meta' => [
            'inductive_limit' => 'Competitive equilibrium maximizes total welfare (First Welfare Theorem). Market failures (externalities, public goods, asymmetric information, monopoly) are provably welfare-reducing by mathematical comparison to social optimum. These are not empirical conjectures — they are mathematical theorems.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**📈 Vector Abstraction (Microeconomics)**:";
                $state['proof_traces'][] = "- **Utility Maximization**: max U(x₁,x₂) s.t. p₁x₁ + p₂x₂ = I  → Lagrangian: L = U − λ(p₁x₁+p₂x₂−I)";
                $state['proof_traces'][] = "- **Demand Law**: ∂Q_d/∂P < 0  (downward-sloping demand from utility maximization)";
                $state['proof_traces'][] = "- **Price Elasticity**: ε_d = (∂Q/∂P)(P/Q);  Elastic: |ε|>1;  Inelastic: |ε|<1;  Unitary: |ε|=1";
                $state['proof_traces'][] = "- **Consumer Surplus**: CS = ∫_{P*}^{P_max} D(p)dp  (welfare gain above equilibrium price)";
                $state['proof_traces'][] = "- **Producer Surplus**: PS = ∫_{P_min}^{P*} S(p)dp  (profit above marginal cost)";
                $state['proof_traces'][] = "- **Deadweight Loss (Monopoly)**: DWL = ½(P_m−MC)(Q_c−Q_m)  (welfare lost to monopoly markup)";
                $state['proof_traces'][] = "- **Cournot Duopoly**: Nash q₁* = q₂* = (a−c)/(3b) → Q* = 2(a−c)/(3b)  (between monopoly and competitive output)";

                // Supply-demand equilibrium: Q_d = 120 − 2P, Q_s = 4P − 60
                // Eq: 120 − 2P* = 4P* − 60 → P* = 30, Q* = 60
                foreach ([20, 25, 30, 35, 40] as $P) {
                    $Qd = 120 - 2 * $P;
                    $Qs = max(0, 4 * $P - 60);
                    $surplus = $Qs - $Qd;
                    $state['trials'][] = [
                        'Price P' => $P,
                        'Q_d = 120−2P' => $Qd,
                        'Q_s = 4P−60' => $Qs,
                        'Excess/Deficit' => $surplus > 0 ? "+{$surplus} (surplus→P↓)" : ($surplus < 0 ? "{$surplus} (shortage→P↑)" : '✅ Equilibrium P*=30'),
                        'CS+PS optimal?' => $surplus === 0 ? 'Max Welfare ✅' : 'Deadweight loss present',
                    ];
                }
                // Elasticity table for Q = 100P^(-ε)
                foreach ([0.3, 0.5, 1.0, 1.5, 2.0] as $e) {
                    $P = 10;
                    $Q = 100 * pow($P, -$e);
                    $state['proof_traces'][] = "Elasticity {$e}: P=10 → Q=" . number_format($Q, 2) . "; |ε|=" . $e . " → " . ($e > 1 ? 'Elastic' : ($e < 1 ? 'Inelastic' : 'Unitary'));
                }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Utility Maximization', 'expr' => 'max U(x₁,x₂) s.t. p₁x₁+p₂x₂=I → FOC: ∂U/∂x₁ / ∂U/∂x₂ = p₁/p₂  (MRS = price ratio)'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Demand Derivation', 'expr' => 'From Roy\'s Identity: xᵢ(p,I) = −∂V/∂pᵢ / ∂V/∂I  where V = indirect utility function'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Welfare Measurement', 'expr' => 'Total Surplus = CS + PS = ∫₀^{Q*}[D(q) − S(q)]dq;  maximized at competitive equilibrium P*=MC ✅'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Monopoly DWL', 'expr' => 'Monopolist: MR = MC → P_m > MC;  DWL = ½(P_m−MC)(Q_c−Q_m) > 0 → Social welfare loss ✅'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Cournot Equilibrium', 'expr' => 'Duopoly: P = a−b(q₁+q₂);  BR₁: q₁ = (a−c−bq₂)/(2b);  NE: q₁*=q₂*=(a−c)/(3b);  P*=(a+2c)/3'];
                $state['proof_traces'][] = "**Microeconomic Deduction**: Utility maximization and market equilibrium follow rigorously from optimization theory. Welfare losses under market failures are mathematically provable.";
        }
    ],
    'BehavioralEconomics' => [
        'meta' => [
            'inductive_limit' => 'Prospect Theory (Kahneman-Tversky) is replicated across 1000+ experiments in 40+ countries. Loss aversion coefficient λ≈2.25 is the most precisely measured constant in economics. Bounded rationality limits are physically grounded in neural working memory constraints and NP-hard computational complexity.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🧠 Vector Abstraction (Behavioral Economics)**:";
                $state['proof_traces'][] = "- **Prospect Theory (Kahneman-Tversky 1979)**: V(x) = x^α if x≥0;  −λ(−x)^β if x<0  (where λ≈2.25, α=β≈0.88)";
                $state['proof_traces'][] = "- **Loss Aversion**: λ ≈ 2.25 — losses feel ~2.25× worse than equivalent gains (asymmetric value function)";
                $state['proof_traces'][] = "- **Probability Weighting**: w(p) = p^γ / (p^γ + (1−p)^γ)^(1/γ);  γ≈0.65 (overweights small probs, underweights large)";
                $state['proof_traces'][] = "- **Bounded Rationality (Simon 1957)**: Agents 'satisfice' rather than optimize — search stops at first 'good enough' option";
                $state['proof_traces'][] = "- **Hyperbolic Discounting**: U(t) = V/(1+kt) (vs. exponential: Ve^(−rt)) — explains preference reversal & procrastination";
                $state['proof_traces'][] = "- **Anchoring Effect**: Final estimate biased toward initial anchor; adjustment is systematically insufficient";
                $state['proof_traces'][] = "- **Status Quo Bias**: Value of existing state amplified by loss aversion (switching feels like a loss)";
                $state['proof_traces'][] = "- **Endowment Effect**: WTA − WTP gap; people demand ~2× more to give up an object than they'd pay to acquire it";

                // Prospect Theory value function samples
                $alpha = 0.88; $lambda = 2.25; $beta = 0.88;
                $gains  = [10, 50, 100, 500, 1000];
                $losses = [-10, -50, -100, -500, -1000];
                foreach ($gains as $i => $g) {
                    $vGain = pow($g, $alpha);
                    $vLoss = -$lambda * pow(abs($losses[$i]), $beta);
                    $state['trials'][] = [
                        'Outcome'       => "+{$g} / {$losses[$i]}",
                        'V(gain)'       => number_format($vGain, 2),
                        'V(loss)'       => number_format($vLoss, 2),
                        '|V(loss)/V(gain)|' => number_format(abs($vLoss / $vGain), 2) . '× (loss aversion ✅)',
                        'Loss > Gain?' => abs($vLoss) > $vGain ? 'Yes — λ≈2.25 ✅' : '?',
                    ];
                }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Prospect Theory Value', 'expr' => 'V(x) = x^0.88 (gains);  V(x) = −2.25·|x|^0.88 (losses);  Derived from experimental certainty equivalent data'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Prob. Weighting', 'expr' => 'w(p) = p^0.65 / (p^0.65 + (1−p)^0.65)^(1/0.65);  w(0.01) ≈ 0.056 > 0.01;  w(0.99) ≈ 0.944 < 0.99 → certainty effect'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Loss Aversion Bound', 'expr' => 'For mixed gamble (gain g, lose l): accepted iff g^α ≥ λ·l^β;  with λ=2.25: g/l ≥ 2.25^(1/α) ≈ 2.47 (gain must be ~2.47× loss)'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Hyperbolic Discounting', 'expr' => 'U(t) = V/(1+kt);  Preference reversal: prefer A(now) over B(1 week) but prefer B(52 weeks) over A(51 weeks) → time-inconsistency ✅'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Bounded Rationality Bound', 'expr' => 'Human working memory: 7±2 chunks (Miller 1956);  N-body optimization NP-hard for N>3 → perfect rationality computationally impossible for complex choices'];
                $state['proof_traces'][] = "**Behavioral Deduction**: Rational agent model (Homo Economicus) is mathematically refuted by experimental evidence. Prospect Theory value function is the empirically superior model with λ≈2.25 firmly established across 1000+ studies.";
        }
    ],
    'Sociology' => [
        'meta' => [
            'inductive_limit' => 'Arrow\'s Impossibility Theorem is an absolute mathematical proof — no rank-order voting system satisfying unanimity, IIA, and non-dictatorship can exist for 3+ candidates. This is not a political opinion; it is a theorem. Power laws in social phenomena emerge from preferential attachment dynamics and are scale-invariant.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🤝 Vector Abstraction (Sociology & Political Science)**:";
                $state['proof_traces'][] = "- **Zipf's Law (Power Law)**: f(rank) = C/rank^s;  most social phenomena follow heavy-tailed distributions (s≈1 for cities, income)";
                $state['proof_traces'][] = "- **Gini Coefficient**: G = A/(A+B) where A = area above Lorenz curve;  G=0 (perfect equality), G=1 (perfect inequality)";
                $state['proof_traces'][] = "- **Pareto Principle (80/20)**: ~80% of effects from ~20% of causes (special case of power law: shape parameter ≈ log(4)/log(5) ≈ 1.16)";
                $state['proof_traces'][] = "- **Dunbar's Number**: Cognitive limit ≈ 150 stable social relationships (neocortex ratio bound, Robin Dunbar 1992)";
                $state['proof_traces'][] = "- **Arrow's Impossibility Theorem (1951)**: No rank-order voting system can simultaneously satisfy: unanimity, independence of irrelevant alternatives, non-dictatorship (proof by contradiction on 3+ candidates)";
                $state['proof_traces'][] = "- **Condorcet Paradox**: Collective preferences can be cyclic even if individual preferences are transitive (A>B, B>C, C>A)";
                $state['proof_traces'][] = "- **Olson's Collective Action Problem**: Individual rational to free-ride → public goods underprovided without selective incentives or coercion";
                $state['proof_traces'][] = "- **Social Discount Rate**: δ = ρ + ηg  (Ramsey rule; ρ = pure time preference, η = elasticity of marginal utility, g = growth rate)";

                // Gini coefficient for various income distributions
                $distributions = [
                    ['name' => 'Perfect Equality',  'gini' => 0.00, 'top10%' => '10%'],
                    ['name' => 'Nordic Countries',   'gini' => 0.27, 'top10%' => '23%'],
                    ['name' => 'United States',       'gini' => 0.41, 'top10%' => '47%'],
                    ['name' => 'Brazil',              'gini' => 0.53, 'top10%' => '58%'],
                    ['name' => 'South Africa',        'gini' => 0.63, 'top10%' => '65%'],
                    ['name' => 'Perfect Inequality',  'gini' => 1.00, 'top10%' => '100%'],
                ];
                foreach ($distributions as $d) {
                    $state['trials'][] = [
                        'Country/Scenario'    => $d['name'],
                        'Gini Coefficient G'  => $d['gini'],
                        'Top 10% income share'=> $d['top10%'],
                        'Equity Level'        => $d['gini'] < 0.3 ? 'High ✅' : ($d['gini'] < 0.5 ? 'Moderate' : 'Low ❌'),
                    ];
                }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Arrow\'s Impossibility', 'expr' => 'Assume voting rule F satisfies unanimity + IIA. For 3+ candidates, construct Condorcet cycle: A>B, B>C, C>A. Any F must be dictatorial (Arrow 1951 ✅)'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Power Law Derivation', 'expr' => 'P(X > x) = (x_min/x)^α;  From preferential attachment: rich-get-richer → Zipf exponent s≈1 for cities, wealth, words ✅'];
                $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Gini from Lorenz', 'expr' => 'G = 1 − 2∫₀¹ L(p)dp  where L(p) = Lorenz curve;  For power law: G = 1/(2α−1) ✅'];
                $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Dunbar\'s Number Bound', 'expr' => 'log(group size) ∝ log(neocortex ratio);  Humans: neocortex ratio ≈ 4.1 → N ≈ 148±30 (empirically: 100-250 in most human groups)'];
                $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Cultural Evolution', 'expr' => 'Social norms evolve to optimize group fitness in specific environmental constraints (e.g. Dunbar\'s Number ~150).'];
                $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Base-Superstructure', 'expr' => 'Culture (superstructure) is ultimately constrained by the economic/technological modes of production (base).'];
                $state['symbolic_traces'][] = ['step' => '7', 'label' => 'Collective Action', 'expr' => 'n-player PD: dominant strategy = free-ride;  Without selective incentives, contribution c = 0 → public good G = 0 (Olson 1965 ✅)'];
                $state['proof_traces'][] = "**Sociological Deduction**: Societies are complex adaptive systems where cultural norms function as evolved heuristics to manage resource distribution, bounded by cognitive scaling limits (Dunbar's number) and material physics.";
        }
    ],
    'MilitaryScience' => [
        'meta' => [
            'inductive_limit' => 'Military strategy is not merely an art; it is applied physics, thermodynamics, and game theory. Victory and defeat are mathematically bounded by force concentration laws, logistical energy constraints, and the Nash equilibria of mutually assured destruction.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**⚔️ Vector Abstraction (Military Science)**:";
                $state['proof_traces'][] = "- **Lanchester's Square Law**: In modern aimed fire, fighting strength is proportional to the square of its numerical size multiplied by individual fighting value (dx/dt = -αy).";
                $state['proof_traces'][] = "- **Clausewitzian Friction**: The difference between war on paper and war in reality, caused by unpredictable thermodynamic and psychological entropy.";
                $state['trials'][] = ['Model' => 'Lanchester Square Law', 'Variable' => 'Numerical superiority', 'Effect' => 'Quadratic advantage'];
                $state['trials'][] = ['Model' => 'Friction', 'Variable' => 'Logistical entropy', 'Effect' => 'Linear degradation'];
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Attrition Differential', 'expr' => 'dx/dt = -a·y and dy/dt = -b·x. Integrating yields a(x₀² - x²) = b(y₀² - y²).'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Force Concentration', 'expr' => 'A force twice as large is four times as effective in aimed combat.'];
                $state['proof_traces'][] = "**Military Science Deduction**: Strategy is ultimately bounded by the differential equations of attrition, thermodynamic logistics, and game-theoretic deterrence.";
        }
    ],
    'Demography' => [
        'meta' => [
            'inductive_limit' => 'Demography bridges the biological realities of human mortality (Gompertz curve) with the macroeconomic realities of carrying capacity. The demographic transition is a universal thermodynamic adaptation of populations to increased energy access.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**📊 Vector Abstraction (Demography)**:";
                $state['proof_traces'][] = "- **Gompertz-Makeham Law**: Human mortality rate is the sum of an age-independent component (Makeham) and an exponentially increasing age-dependent component (Gompertz).";
                $state['proof_traces'][] = "- **Demographic Transition Model (DTM)**: The historical shift from high birth/death rates to low birth/death rates as societies industrialize.";
                $state['trials'][] = ['Model' => 'Gompertz Law', 'Predictor' => 'Age-dependent mortality', 'Constraint' => 'Exponential decay of survivorship'];
                $state['trials'][] = ['Model' => 'DTM', 'Predictor' => 'Industrialization', 'Constraint' => 'Birth rate collapse'];
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Gompertz Equation', 'expr' => 'μ(x) = α + β·e^(γx). Mortality rate μ at age x.'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Population Momentum', 'expr' => 'P(t) continues to grow even after fertility drops below replacement (2.1) due to age structure.'];
                $state['proof_traces'][] = "**Demographic Deduction**: Human population dynamics are strictly constrained by the biological limits of the Gompertz law and the carrying capacity of their energetic base.";
        }
    ],
    'MediaAndCommunication' => [
        'meta' => [
            'inductive_limit' => 'Human communication is an information-theoretic process. By applying Shannon\'s mathematical limits to mass media, we understand that the structure of the network strictly bounds the complexity and fidelity of the ideas that can be transmitted.',
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**📡 Vector Abstraction (Media & Communication)**:";
                $state['proof_traces'][] = "- **Shannon-Weaver Model**: A mathematical theory of communication involving Source → Encoder → Channel (w/ Noise) → Decoder → Destination.";
                $state['proof_traces'][] = "- **Technological Determinism**: The physical structure of the medium dictates the social and cognitive structure of the society using it.";
                $state['trials'][] = ['Theorem' => 'Shannon Capacity limit', 'Bound' => 'C = B log2(1 + S/N)', 'Implication' => 'Absolute maximum data rate'];
                $state['trials'][] = ['Theory' => 'McLuhan', 'Bound' => 'Medium = Message', 'Implication' => 'Cognitive rewiring'];
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Shannon Channel Capacity', 'expr' => 'C = B log₂(1 + S/N). Capacity is bounded by Bandwidth (B) and Signal-to-Noise Ratio (S/N).'];
                $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Error Correction Limits', 'expr' => 'If transmission rate R < C, there exists a coding technique with arbitrarily small error probability.'];
                $state['proof_traces'][] = "**Information Deduction**: All human communication, whether mass media or interpersonal, operates within the absolute thermodynamic limits of Shannon Information Theory.";
        }
    ],
    'AccountingFinance' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**💼 Vector Abstraction (Commerce, Finance & Accounting)**:";
                $state['proof_traces'][] = "- **Net Present Value (NPV)**: NPV = ∑ [ R_t / (1+r)^t ] - C₀. A project is viable if NPV > 0.";
                $state['proof_traces'][] = "- **Capital Asset Pricing Model (CAPM)**: E(R_i) = R_f + β_i[E(R_m) - R_f]. Expected return is a linear function of systemic risk (Beta).";
                $state['proof_traces'][] = "- **Accounting Equation**: Assets = Liabilities + Equity. (Fundamental constraint of double-entry bookkeeping).";
                $state['proof_traces'][] = "- **Black-Scholes Model**: Prices European options via geometric Brownian motion assumption. Avoids arbitrage.";
                $state['proof_traces'][] = "- **Little's Law (Operations)**: L = λW. (Long-term average number of customers = arrival rate × average time spent).";
                $state['proof_traces'][] = "- **WACC (Weighted Average Cost of Capital)**: Minimum acceptable return on asset investments for a firm.";

                $state['trials'][] = ['Model' => 'NPV', 'Constraint' => 'Time Value of Money', 'Decision Rule' => 'Accept if NPV > 0'];
                $state['trials'][] = ['Model' => 'CAPM', 'Constraint' => 'Risk-Return Tradeoff', 'Decision Rule' => 'Higher β demands higher E(R)'];
                $state['trials'][] = ['Model' => 'Double Entry Bookkeeping', 'Constraint' => 'Conservation of Capital', 'Decision Rule' => 'Assets ≡ Liab + Eq'];
        },
    ],
];
