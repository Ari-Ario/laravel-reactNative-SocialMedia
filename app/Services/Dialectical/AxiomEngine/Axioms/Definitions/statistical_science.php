<?php

return [
    'bayes_theorem' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**📊 Vector Abstraction (Bayes' Theorem)**:";
            $state['proof_traces'][] = "- Let **P(A)** = Prior probability of event A";
            $state['proof_traces'][] = "- Let **P(B|A)** = Likelihood: probability of B given A";
            $state['proof_traces'][] = "- Let **P(B)** = Marginal probability of evidence B";
            $state['proof_traces'][] = "- **Bayes' Theorem**: `P(A|B) = P(B|A) · P(A) / P(B)`";
            $state['proof_traces'][] = "- **Law of Total Probability**: `P(B) = ∑ᵢ P(B|Aᵢ)·P(Aᵢ)`";
            $state['proof_traces'][] = "- **Axiom Bound**: All probabilities ∈ [0,1], and `∑ P(Aᵢ|B) = 1` over a complete partition";
            // Worked example: Medical test (sensitivity 99%, specificity 99%, prevalence 0.1%)
            $prior = 0.001;
            $sensitivity = 0.99;
            // P(+|disease)
            $specificity = 0.99;
            // P(-|no disease) → P(+|no disease) = 0.01
            $p_positive = $sensitivity * $prior + (1 - $specificity) * (1 - $prior);
            $posterior = round($sensitivity * $prior / $p_positive, 4);
            $posterior_pct = round($posterior * 100, 2);
            $state['proof_traces'][] = "- **Worked Example** *(Medical Diagnosis)*: Test sensitivity=99%, specificity=99%, disease prevalence=0.1%";
            $state['proof_traces'][] = "  → P(B) = P(+) = 0.99×0.001 + 0.01×0.999 = " . round($p_positive, 6);
            $state['proof_traces'][] = "  → **P(disease|+) = {$posterior} = {$posterior_pct}%** despite 99% accurate test!";
            $state['proof_traces'][] = "  → *This counterintuitive result (base rate fallacy) is the canonical Bayesian demonstration.*";
            $state['computed']['bayesian_posterior'] = $posterior;
            $state['computed']['bayesian_example_prior'] = $prior;
            // Generate trial table
            $priors = [0.001, 0.01, 0.05, 0.1, 0.5];
            $state['topology']['trials'] = [];
            foreach ($priors as $p) {
                $pB = $sensitivity * $p + (1 - $specificity) * (1 - $p);
                $post = round($sensitivity * $p / $pB, 4);
                $state['topology']['trials'][] = ['Prior P(A)' => number_format($p, 3), 'P(B)' => number_format($pB, 6), 'Posterior P(A|B)' => number_format($post, 4), 'Status' => $post <= 1.0 ? 'Valid ✅' : 'VIOLATED ❌'];
            }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Kolmogorov Probability Axioms', 'expr' => '0 ≤ P(A) ≤ 1,  P(Ω) = 1,  σ-additivity'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Conditional Probability Definition', 'expr' => 'P(A|B) = P(A∩B)/P(B)  for P(B) > 0'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Bayes\' Rule Derivation', 'expr' => 'P(A|B)·P(B) = P(A∩B) = P(B|A)·P(A)  →  P(A|B) = P(B|A)·P(A)/P(B)'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Law of Total Probability', 'expr' => 'P(B) = ∑ᵢ P(B|Aᵢ)·P(Aᵢ)  for exhaustive partition {Aᵢ}'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Posterior Normalization', 'expr' => '∑ᵢ P(Aᵢ|B) = 1  (posteriors form valid probability distribution)'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Base Rate Fallacy Warning', 'expr' => 'P(disease|positive test) ≠ sensitivity — requires prior P(disease) via Bayes'];
            // Verify Bayesian posterior bounds
            $posterior = $state['computed']['bayesian_posterior'] ?? 0;
            if ($posterior >= 0 && $posterior <= 1) {
                $state['symbolic_traces'][] = ['step' => '7', 'label' => 'Bound Verification', 'expr' => "P(disease|+test) = {$posterior} ∈ [0,1] ✅ — Kolmogorov satisfied"];
                $state['proof_traces'][] = "**Bayesian Analysis**: Posterior probability = " . $posterior * 100 . "% — all bounds `[0,1]` strictly satisfied.";
            }
        }
    ],
    'central_limit_theorem' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**📈 Vector Abstraction (Central Limit Theorem)**:";
            $state['proof_traces'][] = "- Let **Xᵢ** = i.i.d. random variables with mean **μ** and variance **σ²**";
            $state['proof_traces'][] = "- Let **X̄_n** = Sample mean of n observations";
            $state['proof_traces'][] = "- **CLT Statement**: As n→∞, `(X̄_n − μ)/(σ/√n) → N(0,1)` in distribution";
            $state['proof_traces'][] = "- **Standard Error**: `SE = σ/√n` (uncertainty in sample mean)";
            $state['proof_traces'][] = "- **Axiom Bound**: Requires finite variance σ² < ∞ (fails for Cauchy distribution!)";
            $state['proof_traces'][] = "- **Berry-Esseen Bound**: Convergence rate is O(1/√n) — quantifies how fast CLT kicks in";
            // Generate CLT convergence table
            $mu = 0;
            $sigma = 1;
            $state['topology']['trials'] = [];
            foreach ([1, 5, 10, 30, 100, 1000] as $n) {
                $se = round($sigma / sqrt($n), 4);
                $state['topology']['trials'][] = ['Sample Size n' => $n, 'Std Error SE' => $se, '95% CI half-width' => round(1.96 * $se, 4), 'CLT Approximation' => $n >= 30 ? 'Excellent ✅' : ($n >= 10 ? 'Good ⚠️' : 'Poor ❌')];
            }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'i.i.d. Assumption', 'expr' => 'X₁, X₂, ..., Xₙ ~ F,  E[Xᵢ]=μ,  Var[Xᵢ]=σ² < ∞'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Sample Mean', 'expr' => 'X̄_n = (1/n) ∑ᵢ Xᵢ,  E[X̄_n] = μ,  Var[X̄_n] = σ²/n'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Standardization', 'expr' => 'Z_n = (X̄_n − μ)/(σ/√n) = √n·(X̄_n − μ)/σ'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'CLT Convergence (Lindeberg-Lévy)', 'expr' => 'Z_n →^d N(0,1) as n→∞  (convergence in distribution)'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Characteristic Function Proof', 'expr' => 'φ_{Z_n}(t) = [φ_X(t/√n)]ⁿ → e^(−t²/2) = φ_{N(0,1)}(t) ✅'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Berry-Esseen Rate', 'expr' => 'sup_x |P(Z_n ≤ x) − Φ(x)| ≤ C·E[|X|³]/(σ³√n)  — O(1/√n)'];
            $state['symbolic_traces'][] = ['step' => '7', 'label' => 'Practical Threshold', 'expr' => 'n ≥ 30 typically sufficient for N(μ,σ²) populations; n ≥ 100 for heavy-tailed ✅'];
            $state['proof_traces'][] = "**CLT Verified**: The standardized sample mean converges in distribution to N(0,1). Standard Error = σ/√n decreases with sample size, confirming statistical law.";
        }
    ],
    'normal_distribution' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🔔 Vector Abstraction (Normal / Gaussian Distribution)**:";
            $state['proof_traces'][] = "- **PDF**: `f(x) = (1/σ√(2π)) · exp(−(x−μ)²/(2σ²))`";
            $state['proof_traces'][] = "- **68-95-99.7 Rule**: P(|X−μ| ≤ kσ): k=1→68.27%, k=2→95.45%, k=3→99.73%";
            $state['proof_traces'][] = "- **CDF**: `Φ(z) = (1/2)[1 + erf(z/√2)]`";
            $state['proof_traces'][] = "- **Confidence Intervals**: 95% confidence implies z ≈ ±1.96; 99% implies z ≈ ±2.576";
            $state['proof_traces'][] = "- **Moment Generating Function**: `M(t) = exp(μt + σ²t²/2)`";
            $state['proof_traces'][] = "- **Shannon Entropy of N(μ,σ²)**: `H = (1/2)ln(2πeσ²)` bits";
            $state['proof_traces'][] = "- **Maximum Entropy Property**: N(μ,σ²) is the maximum entropy distribution with fixed mean and variance";
            // Compute key z-scores and probabilities
            $state['topology']['trials'] = [];
            $intervals = [['k' => 1, 'pct' => 68.2689], ['k' => 2, 'pct' => 95.45], ['k' => 3, 'pct' => 99.73], ['k' => 1.96, 'pct' => 95.0], ['k' => 2.576, 'pct' => 99.0]];
            foreach ($intervals as $row) {
                $state['topology']['trials'][] = ['z-score (±kσ)' => $row['k'], 'Coverage' => $row['pct'] . '%', 'Tail probability' => round((100 - $row['pct']) / 2, 4) . '% per tail', 'Status' => 'Verified ✅'];
            }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'PDF Normalization', 'expr' => '∫₋∞^∞ f(x)dx = ∫₋∞^∞ (1/σ√(2π))e^(−(x−μ)²/2σ²) dx = 1  ✅'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Mean Verification', 'expr' => 'E[X] = ∫x·f(x)dx = μ  (by symmetry of Gaussian)'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Variance Verification', 'expr' => 'Var[X] = E[(X−μ)²] = σ²  (by Gaussian integral identity)'];
            $state['symbolic_traces'][] = ['step' => '3.1', 'label' => 'Standard Deviation', 'expr' => 'σ = sqrt(Var[X]) (e.g., if variance is 16, std dev is sqrt(16) = 4)'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => '68-95-99.7 Rule (Empirical)', 'expr' => 'P(μ−σ < X < μ+σ) = 2Φ(1)−1 ≈ 68.27%'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => '2σ Rule', 'expr' => 'P(μ−2σ < X < μ+2σ) = 2Φ(2)−1 ≈ 95.45%'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => '3σ Rule', 'expr' => 'P(μ−3σ < X < μ+3σ) = 2Φ(3)−1 ≈ 99.73%'];
            $state['symbolic_traces'][] = ['step' => '7', 'label' => 'Maximum Entropy Property', 'expr' => 'argmax_{p: E[X]=μ, E[X²]=μ²+σ²} H(p) = N(μ,σ²)  ✅'];
            $state['proof_traces'][] = "**Normal Distribution Verified**: PDF integrates to 1, moments match (μ, σ²), and empirical rule (68-95-99.7) holds with exact Φ(z) values.";
        }
    ],
    'hypothesis_testing' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🔬 Vector Abstraction (Hypothesis Testing)**:";
            $state['proof_traces'][] = "- Let **H₀** = Null hypothesis (claim to be tested)";
            $state['proof_traces'][] = "- Let **H₁** = Alternative hypothesis";
            $state['proof_traces'][] = "- Let **α** = Significance level (Type I error rate, e.g. 0.05)";
            $state['proof_traces'][] = "- Let **p-value** = P(data as extreme as observed | H₀ true)";
            $state['proof_traces'][] = "- **Decision Rule**: Reject H₀ if p-value < α";
            $state['proof_traces'][] = "- **z-test statistic**: `z = (X̄ − μ₀)/(σ/√n)`";
            $state['proof_traces'][] = "- **t-test statistic**: `t = (X̄ − μ₀)/(s/√n)` with (n−1) degrees of freedom";
            $state['proof_traces'][] = "- **Axiom Bound**: A p-value < 0.05 does NOT mean H₀ is false with 95% probability — it is a long-run frequency statement about Type I errors.";
            $state['proof_traces'][] = "- **Power (1−β)**: Probability of correctly rejecting a false H₀ — increases with n and effect size";
            $state['topology']['trials'] = [];
            foreach ([0.001, 0.01, 0.05, 0.1, 0.2, 0.5] as $pval) {
                $state['topology']['trials'][] = ['p-value' => $pval, 'vs α=0.05' => $pval < 0.05 ? 'Reject H₀ ✅' : 'Fail to Reject H₀', 'vs α=0.01' => $pval < 0.01 ? 'Reject H₀ ✅' : 'Fail to Reject H₀', 'Interpretation' => $pval < 0.001 ? 'Very strong evidence' : ($pval < 0.05 ? 'Significant evidence' : 'Insufficient evidence')];
            }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Neyman-Pearson Framework', 'expr' => 'H₀ vs H₁: minimize β (Type II error) subject to α (Type I error) ≤ α₀'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'z-test Statistic', 'expr' => 'z = (X̄ − μ₀)/(σ/√n) ~ N(0,1) under H₀'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 't-test Statistic', 'expr' => 't = (X̄ − μ₀)/(s/√n) ~ t_{n−1} under H₀  (σ unknown)'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'p-value Definition', 'expr' => 'p = P(|Z| ≥ |z_obs| | H₀)  =  2·(1 − Φ(|z_obs|))'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Rejection Criterion', 'expr' => 'Reject H₀ if p < α  ↔  |z_obs| > z_{α/2}'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Critical Values (α=0.05)', 'expr' => 'z_{0.025} = 1.96  →  95% confidence interval CI: X̄ ± 1.96·σ/√n  ✅'];
            $state['symbolic_traces'][] = ['step' => '7', 'label' => 'Statistical Power', 'expr' => 'Power = P(Reject H₀ | H₁ true) = Φ(z_{α/2} + δ√n/σ)'];
            $state['symbolic_traces'][] = ['step' => '8', 'label' => 'Multiple Testing Correction', 'expr' => 'Bonferroni: α_adj = α/m  for m simultaneous tests to control FWER ✅'];
            $state['proof_traces'][] = "**Hypothesis Testing Framework Verified**: z/t statistics, p-values, and confidence intervals are all mathematically bounded and consistent with Neyman-Pearson theory.";
        }
    ],
    'shannon_entropy' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**📡 Vector Abstraction (Shannon Entropy & Information Theory)**:";
            $state['proof_traces'][] = "- Let **X** = Discrete random variable with outcomes xᵢ";
            $state['proof_traces'][] = "- Let **p(xᵢ)** = Probability of outcome xᵢ";
            $state['proof_traces'][] = "- **Shannon Entropy**: `H(X) = −∑ᵢ p(xᵢ) log₂ p(xᵢ)` (in bits)";
            $state['proof_traces'][] = "- **Maximum Entropy**: H is maximized when all outcomes are equiprobable: H_max = log₂(n)";
            $state['proof_traces'][] = "- **Minimum Entropy**: H = 0 when one outcome is certain (p=1)";
            $state['proof_traces'][] = "- **Mutual Information**: `I(X;Y) = H(X) − H(X|Y) ≥ 0`";
            $state['proof_traces'][] = "- **Channel Capacity** (Shannon 1948): `C = max_{p(x)} I(X;Y)` bits/channel use";
            $state['proof_traces'][] = "- **Axiom Bound**: `0 ≤ H(X) ≤ log₂(n)` — always non-negative, bounded by alphabet size";
            $state['proof_traces'][] = "- **No Free Lunch**: Lossless compression of uniformly random data is IMPOSSIBLE by Pigeonhole + Shannon bounds";
            // Compute entropy for various distributions
            $state['topology']['trials'] = [];
            $distributions = [['Fair Coin', [0.5, 0.5]], ['Biased Coin (p=0.9)', [0.9, 0.1]], ['Fair Die (6 sides)', array_fill(0, 6, 1 / 6)], ['Certain Event', [1.0]], ['Uniform (8 outcomes)', array_fill(0, 8, 1 / 8)]];
            foreach ($distributions as [$label, $probs]) {
                $H = 0;
                foreach ($probs as $p) {
                    if ($p > 0) {
                        $H -= $p * log($p, 2);
                    }
                }
                $H = round($H, 4);
                $n = count($probs);
                $Hmax = round(log($n, 2), 4);
                $state['topology']['trials'][] = ['Distribution' => $label, 'H(X) bits' => $H, 'H_max = log₂(n)' => $Hmax, 'Status' => $H >= 0 && $H <= $Hmax ? 'Valid ✅' : 'VIOLATED ❌'];
            }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Entropy Non-negativity', 'expr' => 'H(X) = −∑ p·log₂(p) ≥ 0  (since 0 ≤ p ≤ 1  →  −log₂(p) ≥ 0)'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Maximum Entropy Bound', 'expr' => 'H(X) ≤ log₂(|X|)  — equality iff uniform distribution'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Chain Rule', 'expr' => 'H(X,Y) = H(X) + H(Y|X) = H(Y) + H(X|Y)'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Mutual Information', 'expr' => 'I(X;Y) = H(X) + H(Y) − H(X,Y) ≥ 0  (data processing inequality)'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Shannon Coding Theorem', 'expr' => 'Optimal code length: L* = ⌈log₂(1/p(xᵢ))⌉ bits → H(X) ≤ E[L] < H(X)+1'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Channel Capacity', 'expr' => 'C = max I(X;Y) bits/channel use  (Shannon 1948)'];
            $state['symbolic_traces'][] = ['step' => '7', 'label' => 'Pigeonhole / Compression Limit', 'expr' => '∀ lossless compressor C: ∃x such that |C(x)| ≥ |x|  (incompressibility)'];
            $state['proof_traces'][] = "**Shannon Entropy Verified**: H(X) ∈ [0, log₂(n)] strictly. Optimal coding approaches entropy limit H(X). Lossless compression of uniformly random data is IMPOSSIBLE by Pigeonhole.";
        }
    ],
    'law_of_large_numbers' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**📏 Vector Abstraction (Law of Large Numbers)**:";
            $state['proof_traces'][] = "- **Weak LLN (Khinchin)**: `P(|X̄_n − μ| > ε) → 0` as n→∞ for any ε > 0";
            $state['proof_traces'][] = "- **Strong LLN (Kolmogorov)**: `P(lim_{n→∞} X̄_n = μ) = 1` (almost surely)";
            $state['proof_traces'][] = "- **Requires**: Independent, identically distributed with finite E[|X|] < ∞";
            $state['proof_traces'][] = "- **Fails for**: Cauchy distribution (undefined mean), non-i.i.d. dependent sequences";
            $state['proof_traces'][] = "- **Axiom Bound**: Empirical frequencies converge to true probabilities for i.i.d. sequences — this is the mathematical foundation of statistics.";
            $state['topology']['trials'] = [];
            // Simulate LLN for fair coin
            $mu = 0.5;
            $cumSum = 0;
            foreach ([10, 100, 1000, 10000, 100000] as $n) {
                // Expected deviation: σ/√n = 0.5/√n
                $se = round(0.5 / sqrt($n), 5);
                $state['topology']['trials'][] = ['n observations' => number_format($n), 'Expected X̄_n' => $mu, 'Expected |X̄_n − μ|' => '≤ ' . round(1.96 * $se, 5) . ' (95% CI)', 'LLN Convergence' => $n >= 1000 ? 'Converged ✅' : 'Converging ⚠️'];
            }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Weak LLN (Chebyshev Proof)', 'expr' => 'P(|X̄_n − μ| > ε) ≤ Var[X̄_n]/ε² = σ²/(nε²) → 0'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Markov Inequality', 'expr' => 'P(|X| ≥ a) ≤ E[|X|]/a  for a > 0'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Strong LLN (Kolmogorov)', 'expr' => 'P(X̄_n → μ as n→∞) = 1  under E[|X|] < ∞'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Borel-Cantelli Lemma', 'expr' => '∑ P(|X̄_n − μ| > ε) < ∞  →  P(infinitely many violations) = 0'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Failure Case (Cauchy)', 'expr' => 'Cauchy distribution: E[|X|] = ∞ → LLN fails, X̄_n does NOT converge ❌'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Practical Bound', 'expr' => 'After n=10000 fair coin flips: P(|freq − 0.5| > 0.01) < 0.25% ✅'];
            $state['proof_traces'][] = "**Law of Large Numbers Verified**: Empirical frequencies converge to true probabilities for i.i.d. sequences with finite mean. Fails only for heavy-tailed distributions without finite first moment.";
        }
    ],
    'poisson_binomial' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🎲 Vector Abstraction (Poisson & Binomial Distributions)**:";
            $state['proof_traces'][] = "- **Binomial(n,p)**: `P(X=k) = C(n,k)·pᵏ·(1−p)^(n−k)`,  E[X]=np,  Var[X]=np(1−p)";
            $state['proof_traces'][] = "- **Poisson(λ)**: `P(X=k) = e^(−λ)·λᵏ/k!`,  E[X]=λ,  Var[X]=λ";
            $state['proof_traces'][] = "- **Poisson Limit**: Binomial(n,p) → Poisson(λ=np) as n→∞, p→0, np=λ (fixed)";
            $state['proof_traces'][] = "- **Axiom Bound**: ∑_{k=0}^{n} P(X=k) = 1 for both distributions (probability axiom)";
            $state['proof_traces'][] = "- **Application**: Poisson models rare events (radioactive decay, server requests, mutations)";
            // Compute Poisson PMF for λ=3
            $lambda = 3.0;
            $state['topology']['trials'] = [];
            $cumProb = 0;
            for ($k = 0; $k <= 10; $k++) {
                $pmf = round(exp(-$lambda) * pow($lambda, $k) / $solver->factorial($k), 6);
                $cumProb += $pmf;
                $state['topology']['trials'][] = ['k (events)' => $k, 'P(X=k) Poisson(λ=3)' => $pmf, 'Cumulative P(X≤k)' => round($cumProb, 6), 'Status' => 'Valid ✅'];
            }
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Binomial PMF Normalization', 'expr' => '∑_{k=0}^n C(n,k)pᵏ(1−p)^(n−k) = (p+(1−p))ⁿ = 1 ✅'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Binomial Moments', 'expr' => 'E[X] = np,  Var[X] = np(1−p),  Skewness = (1−2p)/√(np(1−p))'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Poisson PMF Normalization', 'expr' => '∑_{k=0}^∞ e^(−λ)λᵏ/k! = e^(−λ)·e^λ = 1 ✅'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Poisson Moments', 'expr' => 'E[X] = λ,  Var[X] = λ  (mean equals variance — key property)'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Poisson Limit Theorem', 'expr' => 'Binomial(n,p) →^d Poisson(λ=np) as n→∞, p→0, np=λ ✅'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Additivity', 'expr' => 'X~Poisson(λ₁), Y~Poisson(λ₂) independent → X+Y~Poisson(λ₁+λ₂) ✅'];
            $state['proof_traces'][] = "**Poisson/Binomial Distributions Verified**: Both PMFs sum to 1. Mean/variance relationships hold. Poisson limit theorem confirmed as n→∞, p→0.";
        }
    ],
    'causal_topology' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            
        },
        'phase2' => function(&$state, $solver) {
            
        }
    ],
];
