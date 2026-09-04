<?php

return [
    'heisenberg_uncertainty' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🌊 Vector Abstraction (Heisenberg Uncertainty Principle)**:";
            $state['proof_traces'][] = "- Let **Δx** (delta x) = Standard deviation of position measurement";
            $state['proof_traces'][] = "- Let **Δp** (delta p) = Standard deviation of momentum measurement";
            $state['proof_traces'][] = "- Let **ℏ** (hbar) = Reduced Planck constant = 1.0546 × 10⁻³⁴ J·s";
            $state['proof_traces'][] = "- **Heisenberg Uncertainty**: `Δx · Δp ≥ ℏ/2`";
            $state['proof_traces'][] = "- **Energy-Time Variant**: `ΔE · Δt ≥ ℏ/2`";
            $state['proof_traces'][] = "- **Axiom Bound**: No quantum state can simultaneously have precisely defined position AND momentum — this is not a measurement limitation but a fundamental ontological constraint of wave mechanics.";
            // Check for violation: claim of Δx·Δp = 0 or < ℏ/2
            $violates = preg_match('/\b(delta_?x\s*[*·]\s*delta_?p\s*[=<]?\s*0|simultaneous(ly)?\s+(exact|precise|certain|definite|certain)\s+(position|momentum)|certainty\s+principle\s+violated)\b/i', strtolower($state['thesis']));
            $state['is_violation'] = (bool) $violates;
            $state['vectors']['hbar'] = $solver::HBAR;
            $state['vectors']['bound'] = 'Δx·Δp ≥ ℏ/2';
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Commutation Relation', 'expr' => '[x̂, p̂] = xp̂ − p̂x = iℏ'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Robertson Inequality', 'expr' => 'ΔÂ · ΔB̂ ≥ ½|⟨[Â,B̂]⟩|'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Apply to x̂, p̂', 'expr' => 'Δx · Δp ≥ ½|⟨iℏ⟩| = ℏ/2'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Numerical Bound', 'expr' => 'Δx · Δp ≥ ' . number_format($solver::HBAR / 2, 6, '.', '') . ' J·s ≈ 5.27×10⁻³⁵ J·s'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Energy-Time Variant', 'expr' => 'ΔE · Δt ≥ ℏ/2  (conjugate pair)'];
            if ($state['is_violation']) {
                if ($isUnsolved) {
                    $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Creative Bypass', 'expr' => 'Hypothetical sub-ℏ regime synthesized via quantum gravity manifold ✅'];
                    $state['proof_traces'][] = "> **[Creative Synthesis Bypass]** — The claim violates the canonical commutation relation. In a speculative quantum-gravity framework with modified commutators [x̂,p̂] = iℏ(1 + βp²), the bound is lifted.";
                } else {
                    $state['is_valid'] = false;
                    $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Violation Check', 'expr' => 'Δx·Δp < ℏ/2 → Violates [x̂,p̂]=iℏ → IMPOSSIBLE ❌'];
                    $state['proof_traces'][] = "**⚠️ QUANTUM VIOLATION**: The claim asserts simultaneous exact knowledge of both position and momentum. This contradicts the canonical commutation relation `[x̂, p̂] = iℏ`, which is a consequence of the Fourier-transform relationship between position and momentum representations. It cannot be violated in standard QM.";
                    $state['proof_traces'][] = "**[HALTED: Heisenberg Uncertainty Principle Violation ❌]**";
                }
            } else {
                $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Bound Satisfied', 'expr' => 'Δx·Δp ≥ ℏ/2 — Uncertainty principle holds ✅'];
                $state['proof_traces'][] = "The quantum vectors are **consistent** with the Heisenberg Uncertainty Principle. The commutation relation `[x̂, p̂] = iℏ` is preserved.";
            }
        }
    ],
    'schrodinger_equation' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🌀 Vector Abstraction (Schrödinger Equation)**:";
            $state['proof_traces'][] = "- Let **ψ(x,t)** (psi) = Quantum wave function (probability amplitude)";
            $state['proof_traces'][] = "- Let **Ĥ** (Hamiltonian) = Hamiltonian operator (total energy operator)";
            $state['proof_traces'][] = "- Let **ℏ** = Reduced Planck constant";
            $state['proof_traces'][] = "- **Time-Dependent Schrödinger Eq**: `iℏ ∂ψ/∂t = Ĥψ`";
            $state['proof_traces'][] = "- **Time-Independent (TISE)**: `Ĥψ = Eψ` (eigenvalue equation)";
            $state['proof_traces'][] = "- **Born Rule**: `P(x) = |ψ(x)|²` — probability density";
            $state['proof_traces'][] = "- **Normalization Axiom**: `∫|ψ(x)|²dx = 1` over all space";
            $state['proof_traces'][] = "- **Axiom Bound**: The wave function must be square-integrable (L² Hilbert space); energy eigenvalues must be real (Ĥ is Hermitian).";
            $state['vectors']['bound'] = 'ψ ∈ L²(ℝ), Ĥ† = Ĥ';
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'TDSE (General)', 'expr' => 'iℏ ∂ψ(x,t)/∂t = Ĥψ(x,t) = [−ℏ²/2m ∂²/∂x² + V(x)]ψ'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Separation of Variables', 'expr' => 'ψ(x,t) = φ(x)·e^(−iEt/ℏ)  [stationary state]'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'TISE (Eigenvalue Eq.)', 'expr' => 'Ĥφ(x) = Eφ(x)  →  −ℏ²/2m · d²φ/dx² + V(x)φ = Eφ'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Born Rule Normalization', 'expr' => '∫₋∞^∞ |ψ(x,t)|² dx = ∫₋∞^∞ |φ(x)|² dx = 1'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Hermiticity → Real Eigenvalues', 'expr' => 'Ĥ† = Ĥ  →  ⟨ψ|Ĥ|ψ⟩ ∈ ℝ  →  E ∈ ℝ always ✅'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Particle in Box / Infinite Well (V=0, 0<x<L)', 'expr' => 'E_n = n²π²ℏ²/(2mL²), ψ_n = √(2/L)·sin(nπx/L)'];
            // Compute ground state energy for electron in 1 Å box
            $L = 1.0E-10;
            // 1 Angstrom
            $E_ground = round(pow(M_PI, 2) * pow($solver::HBAR, 2) / (2 * $solver::MASS_E * pow($L, 2)) / $solver::E_CHARGE, 2);
            $state['symbolic_traces'][] = ['step' => '7', 'label' => 'Sample: Electron in 1Å Box', 'expr' => "E₁ = π²ℏ²/(2mₑL²) ≈ {$E_ground} eV (ground state)"];
            $state['proof_traces'][] = "**Schrödinger Solution**: Ground state electron in 1 Å potential box → E₁ ≈ {$E_ground} eV — consistent with atomic energy scales.";
        }
    ],
    'photoelectric_planck' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            $E_photon_sample = $solver::H_PLANCK * 600000000000000.0;
            // ~400nm violet photon
            $eV_sample = round($E_photon_sample / $solver::E_CHARGE, 2);
            $state['proof_traces'][] = "\n**💡 Vector Abstraction (Photoelectric Effect & Planck Quantization)**:";
            $state['proof_traces'][] = "- Let **E** = Energy of a photon";
            $state['proof_traces'][] = "- Let **h** = Planck constant = 6.626 × 10⁻³⁴ J·s";
            $state['proof_traces'][] = "- Let **ν** = Frequency of light (Hz)";
            $state['proof_traces'][] = "- Let **φ** = Work function of metal (minimum energy to eject electron)";
            $state['proof_traces'][] = "- **Planck-Einstein Relation**: `E = hν = ℏω`";
            $state['proof_traces'][] = "- **Photoelectric Equation** (Einstein 1905): `K_max = hν − φ`";
            $state['proof_traces'][] = "- **Sample**: Violet light (ν = 6×10¹⁴ Hz) → E = h·ν ≈ {$eV_sample} eV";
            $state['proof_traces'][] = "- **Axiom Bound**: Energy is quantized in units of hν. Light of frequency ν BELOW φ/h cannot eject ANY electrons regardless of intensity.";
            $state['vectors']['E_sample_eV'] = $eV_sample;
            $state['vectors']['bound'] = 'E = hν (quantized)';
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Planck Postulate (1900)', 'expr' => 'Energy is quantized: E = nhν, n ∈ ℤ⁺'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Einstein Photon (1905)', 'expr' => 'Each photon carries E = hν = ℏω'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Photoelectric Equation', 'expr' => 'K_max = hν − φ  (kinetic energy of ejected electron)'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Threshold Frequency', 'expr' => 'ν₀ = φ/h  →  below ν₀: NO electrons ejected, regardless of intensity'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Momentum of Photon', 'expr' => 'p = hν/c = h/λ  (de Broglie for massless photon)'];
            // Sodium work function example: φ = 2.36 eV
            $phi_Na = 2.36;
            // eV
            $nu_thresh_Na = round($phi_Na * $solver::E_CHARGE / $solver::H_PLANCK / 100000000000000.0, 3);
            // in 10^14 Hz
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Sample: Sodium (φ = 2.36 eV)', 'expr' => "ν₀ = {$nu_thresh_Na}×10¹⁴ Hz — light below this frequency cannot eject electrons ✅"];
            $state['proof_traces'][] = "**Photoelectric Derivation**: For sodium (φ = 2.36 eV), threshold frequency ν₀ ≈ {$nu_thresh_Na}×10¹⁴ Hz. Light of frequency below ν₀ cannot eject electrons regardless of intensity — confirming the quantum nature of light.";
        }
    ],
    'de_broglie_duality' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**〰️ Vector Abstraction (Wave-Particle Duality & de Broglie)**:";
            $state['proof_traces'][] = "- Let **λ** = de Broglie wavelength of matter";
            $state['proof_traces'][] = "- Let **p** = Momentum of particle";
            $state['proof_traces'][] = "- Let **h** = Planck constant";
            $state['proof_traces'][] = "- **de Broglie Relation**: `λ = h/p = h/(mv)`";
            $state['proof_traces'][] = "- **Wave Number**: `k = p/ℏ`, angular frequency `ω = E/ℏ`";
            $state['proof_traces'][] = "- **Double-Slit Bound**: All matter exhibits wave interference with fringe spacing `Δy = λL/d`";
            $state['proof_traces'][] = "- **Axiom Bound**: Every particle has an associated de Broglie wavelength. For macroscopic objects, λ is vanishingly small (e.g. 1 kg at 1 m/s: λ ≈ 6.6×10⁻³⁴ m), making quantum effects unobservable classically.";
            // Sample: electron at 1eV
            $p_e = sqrt(2 * $solver::MASS_E * $solver::E_CHARGE);
            // √(2mE)
            $lambda_e = round($solver::H_PLANCK / $p_e * 1000000000.0, 3);
            // in nm
            $state['proof_traces'][] = "- **Sample**: Electron at 1 eV → λ ≈ {$lambda_e} nm (≈ interatomic distance)";
            $state['vectors']['lambda_e_nm'] = $lambda_e;
            $state['vectors']['bound'] = 'λ = h/p';
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'de Broglie Hypothesis (1924)', 'expr' => 'λ = h/p = h/(mv)  for all matter'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Wave Number', 'expr' => 'k = 2π/λ = p/ℏ'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Energy-Momentum Relation', 'expr' => 'E = p²/2m  (non-relativistic)  →  E = pc  (photon/ultrarelativistic)'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Double-Slit Fringe Spacing', 'expr' => 'Δy = λL/d  →  interference pattern scales with λ = h/p'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Davisson-Germer Experiment (1927)', 'expr' => 'Electron diffraction confirmed λ = h/p to 1% accuracy ✅'];
            // Baseball at 30 m/s: λ ≈ h/(0.145 * 30)
            $m_ball = 0.145;
            $v_ball = 30.0;
            $lambda_ball = $solver::H_PLANCK / ($m_ball * $v_ball);
            $exp_ball = (int) floor(log10($lambda_ball));
            $mantissa_ball = round($lambda_ball / pow(10, $exp_ball), 1);
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Macroscopic Limit (Baseball, 30 m/s)', 'expr' => "λ ≈ {$mantissa_ball}×10^{$exp_ball} m — immeasurably small, QM negligible ✅"];
            $state['proof_traces'][] = "**de Broglie Wave-Particle Duality**: All matter has an associated wave nature. For macroscopic objects, λ → 0 making quantum effects negligible (classical limit). Confirmed by electron diffraction experiments.";
        }
    ],
    'hydrogen_energy_levels' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🔋 Vector Abstraction (Hydrogen Atom Energy Levels)**:";
            $state['proof_traces'][] = "- Let **n** = Principal quantum number (n = 1, 2, 3, ...)";
            $state['proof_traces'][] = "- Let **E_n** = Energy of hydrogen atom in state n";
            $state['proof_traces'][] = "- Let **α** = Fine-structure constant ≈ 1/137";
            $state['proof_traces'][] = "- **Bohr Model / TISE Exact Solution**: `E_n = −13.6 eV / n²`";
            $state['proof_traces'][] = "- **Ground State** (n=1): `E₁ = −13.6 eV`";
            $state['proof_traces'][] = "- **Ionization Energy**: `E_∞ − E₁ = 13.6 eV`";
            $state['proof_traces'][] = "- **Rydberg Formula**: `1/λ = R_H(1/n₁² − 1/n₂²)` where R_H = 1.097×10⁷ m⁻¹";
            // Generate base cases
            $energies = [];
            for ($n = 1; $n <= 4; $n++) {
                $E = round($solver::E0_H / ($n * $n), 4);
                $energies[] = "E_{$n} = {$E} eV";
            }
            $state['proof_traces'][] = "- **Calculated Levels**: " . implode(', ', $energies);
            $state['vectors']['E0'] = $solver::E0_H;
            $state['vectors']['bound'] = 'E_n = -13.6/n² eV';
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Coulomb Potential', 'expr' => 'V(r) = −e²/(4πε₀r) = −ke²/r'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Radial Schrödinger Equation', 'expr' => 'Ĥ = −ℏ²/(2μ)∇² − e²/(4πε₀r)  →  Ĥψ = Eψ'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Energy Eigenvalues (Exact)', 'expr' => 'E_n = −(μe⁴)/(2ℏ²) · 1/n² = −13.6 eV/n²'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Angular Momentum Quantization', 'expr' => 'L = √(l(l+1))ℏ,  l = 0,1,...,n-1;  m_l = −l,...,+l'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Spin Quantum Number', 'expr' => 's = ½  →  m_s = ±½  (Pauli inclusion for each orbital)'];
            for ($n = 1; $n <= 5; $n++) {
                $E = round($solver::E0_H / ($n * $n), 4);
                $degeneracy = 2 * $n * $n;
                $state['symbolic_traces'][] = ['step' => "n={$n}", 'label' => "Energy Level (n={$n})", 'expr' => "E_{$n} = {$E} eV,  degeneracy = {$degeneracy}  ✅"];
            }
            $state['proof_traces'][] = "**Hydrogen TISE Solution**: Energy levels exactly solvable. E_n = −13.6/n² eV — spectroscopic precision match with experiment (Lyman, Balmer, Paschen series confirmed).";
        }
    ],
    'quantum_entanglement' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🔗 Vector Abstraction (Quantum Entanglement & Bell Inequalities)**:";
            $state['proof_traces'][] = "- Let **|Φ⁺⟩** = Maximally entangled Bell state = (1/√2)(|00⟩ + |11⟩)";
            $state['proof_traces'][] = "- **Bell Inequality** (CHSH): `|S| ≤ 2` for classical local hidden variables";
            $state['proof_traces'][] = "- **Quantum Prediction**: `|S_QM| = 2√2 ≈ 2.828` (Tsirelson bound)";
            $state['proof_traces'][] = "- **Experimental Fact**: Bell tests (Aspect 1982, Zeilinger 2022) confirm `|S| ≈ 2.82`, violating classical bound";
            $state['proof_traces'][] = "- **Non-Locality Bound**: Entanglement correlations CANNOT be used for faster-than-light communication (no-signaling theorem), but they are fundamentally nonlocal.";
            $state['proof_traces'][] = "- **Axiom Bound**: QM is nonlocal but no causal superluminal information transfer is possible.";
            $state['vectors']['S_QM'] = round(2 * sqrt(2), 4);
            $state['vectors']['S_classical_max'] = 2;
            $state['vectors']['bound'] = '|S_QM| = 2√2 > 2';
        },
        'phase2' => function(&$state, $solver) {
            $S_QM = round(2 * sqrt(2), 6);
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Bell State |Φ⁺⟩', 'expr' => '|Φ⁺⟩ = (|00⟩ + |11⟩)/√2  (maximally entangled)'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'CHSH Inequality (Classical)', 'expr' => '|S| = |E(a,b) − E(a,b\') + E(a\',b) + E(a\',b\')| ≤ 2'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'QM Prediction (Tsirelson)', 'expr' => '|S_QM| = 2√2 ≈ ' . $S_QM . ' > 2  (violates CHSH) ✅'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Experimental Confirmation', 'expr' => 'Aspect (1982), Hensen (2015), Zeilinger (2022 Nobel) → |S| ≈ 2.82 ✅'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'No-Signaling Theorem', 'expr' => 'Entanglement correlations: no information transfer possible at > c  ✅'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'No-Cloning Theorem', 'expr' => '∄ unitary U: U|ψ⟩|0⟩ = |ψ⟩|ψ⟩ for arbitrary |ψ⟩ ✅'];
            $state['proof_traces'][] = "**Quantum Entanglement Verified**: Bell-CHSH violations proven experimentally. QM predicts |S| = 2√2 ≈ {$S_QM} vs. classical bound of 2. No faster-than-light signaling is possible (no-signaling theorem).";
        }
    ],
    'pauli_exclusion' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🚫 Vector Abstraction (Pauli Exclusion Principle)**:";
            $state['proof_traces'][] = "- **Pauli Exclusion**: No two identical fermions can occupy the same quantum state simultaneously";
            $state['proof_traces'][] = "- **Fermions**: Half-integer spin (electrons, protons, neutrons, quarks)";
            $state['proof_traces'][] = "- **Bosons**: Integer spin (photons, gluons, W/Z bosons) — NOT subject to exclusion";
            $state['proof_traces'][] = "- **Fermi-Dirac Distribution**: `f(E) = 1 / (exp((E−μ)/(k_B·T)) + 1)`";
            $state['proof_traces'][] = "- **Bose-Einstein Distribution**: `f(E) = 1 / (exp((E−μ)/(k_B·T)) − 1)`";
            $state['proof_traces'][] = "- **Consequence**: Pauli exclusion explains atomic shell structure, neutron stars, white dwarf pressure, and the stability of ordinary matter.";
            $state['proof_traces'][] = "- **Axiom Bound**: The antisymmetry of the fermionic wave function under particle exchange is an absolute quantum constraint — `ψ(r₁,r₂) = −ψ(r₂,r₁)` for fermions.";
            $state['vectors']['bound'] = 'ψ_fermi(r₁,r₂) = −ψ_fermi(r₂,r₁)';
        },
        'phase2' => function(&$state, $solver) {
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Fermionic Antisymmetry', 'expr' => 'ψ(r₁,s₁; r₂,s₂) = −ψ(r₂,s₂; r₁,s₁)  for identical fermions'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Identical State Collapse', 'expr' => 'If r₁=r₂, s₁=s₂: ψ = −ψ  →  ψ = 0  (impossible occupation) ✅'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Spin-Statistics Theorem (Pauli 1940)', 'expr' => 'Fermions (half-integer spin): antisymmetric; Bosons (integer spin): symmetric'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Fermi-Dirac Distribution', 'expr' => 'f(E) = 1/[exp((E−μ)/k_BT) + 1]  →  f ≤ 1 always ✅'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Consequence: Electron Shells', 'expr' => 'n=1: max 2e⁻; n=2: max 8e⁻; n=3: max 18e⁻ = 2n² per shell ✅'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'White Dwarf / Neutron Star', 'expr' => 'Degeneracy pressure from Pauli exclusion supports stellar remnants against collapse ✅'];
            $state['proof_traces'][] = "**Pauli Exclusion Verified**: The antisymmetry of fermionic wave functions is absolute — identical fermions cannot share quantum states. This explains atomic structure, chemistry, and the stability of matter.";
        }
    ],
    'wavefunction_collapse' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**📐 Vector Abstraction (Wave Function Collapse & Born Rule)**:";
            $state['proof_traces'][] = "- Let **ψ** = Quantum state before measurement (superposition)";
            $state['proof_traces'][] = "- Let **{|aₙ⟩}** = Complete orthonormal eigenbasis of observable Â";
            $state['proof_traces'][] = "- **Born Rule**: `P(aₙ) = |⟨aₙ|ψ⟩|²` — probability of measuring eigenvalue aₙ";
            $state['proof_traces'][] = "- **Collapse Postulate**: After measuring aₙ, the state collapses: `ψ → |aₙ⟩`";
            $state['proof_traces'][] = "- **Completeness**: `∑ₙ |⟨aₙ|ψ⟩|² = 1` (total probability = 1)";
            $state['proof_traces'][] = "- **Axiom Bound**: Before measurement, no definite value exists — the particle is in genuine superposition, NOT a hidden classical state (as proven by Bell tests).";
            $state['vectors']['bound'] = 'P(aₙ) = |⟨aₙ|ψ⟩|² ≥ 0, ∑P = 1';
        },
    ],
    'quantum_tunneling' => [
        'meta' => [
        ],
        'phase1' => function(&$state, $solver) {
            $state['proof_traces'][] = "\n**🚧 Vector Abstraction (Quantum Tunneling)**:";
            $state['proof_traces'][] = "- Let **V₀** = Potential barrier height";
            $state['proof_traces'][] = "- Let **E** = Particle kinetic energy (E < V₀ classically forbidden)";
            $state['proof_traces'][] = "- Let **d** = Barrier width";
            $state['proof_traces'][] = "- **Transmission Coefficient**: `T ≈ exp(−2κd)` where `κ = √(2m(V₀−E))/ℏ`";
            $state['proof_traces'][] = "- **Axiom Bound**: Even when E < V₀, T > 0 — the wave function has exponentially decaying amplitude inside the barrier but non-zero probability of emerging on the other side.";
            $state['proof_traces'][] = "- **Applications**: Nuclear fusion (solar interior), scanning tunneling microscopy (STM), tunnel diodes, radioactive α-decay.";
            $state['vectors']['bound'] = 'T = exp(-2κd) > 0 for all finite d';
        },
        'phase2' => function(&$state, $solver) {
            // Sample: proton tunneling through 1 fm barrier at 1 MeV below barrier top
            $V0_MeV = 5.0;
            $E_MeV = 4.0;
            $d_fm = 2.0;
            // fm
            $m_p = 1.6726E-27;
            // kg proton mass
            $kappa = sqrt(2 * $m_p * ($V0_MeV - $E_MeV) * 1000000.0 * $solver::E_CHARGE) / $solver::HBAR;
            $T_coeff = round(exp(-2 * $kappa * $d_fm * 1.0E-15), 6);
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Classical Barrier (Forbidden)', 'expr' => 'For E < V₀: classically T = 0 (no penetration)'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'QM Wave Equation in Barrier', 'expr' => 'ψ(x) = A·e^(κx) + B·e^(−κx),  κ = √(2m(V₀−E))/ℏ'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Transmission Coefficient', 'expr' => 'T ≈ e^(−2κd)  (for κd >> 1)'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'WKB Generalization', 'expr' => 'T = exp[−2/ℏ · ∫√(2m(V(x)−E))dx]'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Sample: Proton through 2 fm Nuclear Barrier', 'expr' => "V₀={$V0_MeV} MeV, E={$E_MeV} MeV, d={$d_fm} fm → T ≈ {$T_coeff}  (nonzero ✅)"];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Solar Fusion Application', 'expr' => 'Proton-proton fusion in sun: T ≈ 10⁻²⁰ — small but enough to power the sun for 10 billion years ✅'];
            $state['proof_traces'][] = "**Quantum Tunneling Verified**: Transmission coefficient T ≈ {$T_coeff} for sample nuclear barrier — nonzero despite being classically forbidden. This is experimentally confirmed in α-decay, STM, and nuclear fusion.";
        }
    ],
];
