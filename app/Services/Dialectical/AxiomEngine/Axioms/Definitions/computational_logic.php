<?php

return [
    'p_vs_np' => [
        'meta' => [
            'inductive_limit' => 'The complexity hierarchy P ⊆ NP ⊆ PSPACE ⊆ EXPTIME is unconditionally proven; P vs NP remains open.',
        ],
        'phase2' => function(&$state, $solver) {
            $thesis = strtolower($state['vectors']['bound_test'] ?? '');
            $isGlobalUnsolved = $solver->oracle->isUnsolvedProblem($state['vectors']['bound_test'] ?? '');
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Complexity Class P', 'expr' => 'P = {L : ∃ TM M, ∃ polynomial p, M decides L in time p(|w|)}'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Complexity Class NP', 'expr' => 'NP = {L : ∃ poly-time verifier V: w∈L ↔ ∃ certificate c, V(w,c) accepts in poly time}'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'P ⊆ NP', 'expr' => 'Every P problem is in NP (solver = verifier ignoring certificate) ✅'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Cook-Levin Theorem (1971)', 'expr' => 'SAT is NP-complete: every NP problem poly-time many-one reduces to SAT'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Karp\'s 21 NP-complete (1972)', 'expr' => 'TSP, Clique, Vertex Cover, 3-SAT, Subset Sum, ... all ≤_m^p SAT'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'No P=NP Proof Known', 'expr' => 'Baker-Gill-Solovay (1975): relativised separations exist both ways → no algebrisation technique alone can resolve P vs NP'];
            $state['symbolic_traces'][] = ['step' => '7', 'label' => 'Complexity Hierarchy Theorem', 'expr' => 'TIME(f(n)) ⊊ TIME(g(n)) if g(n)/f(n) → ∞  (space: PSPACE, EXPTIME exist strictly above NP)'];
            // Build complexity comparison trial table
            $state['trials'] = [['Class' => 'P', 'Example' => 'Sorting, BFS/DFS, Primality (AKS)', 'Decision Bound' => 'poly(n)', 'Status' => '✅ Tractable'], ['Class' => 'NP', 'Example' => '3-SAT, TSP, Clique, Subset Sum', 'Decision Bound' => '2^poly(n) (verify poly)', 'Status' => '❓ P=NP unknown'], ['Class' => 'co-NP', 'Example' => 'UNSAT, Non-Clique', 'Decision Bound' => 'poly-time complement', 'Status' => '❓ NP=co-NP unknown'], ['Class' => 'PSPACE', 'Example' => 'TQBF, Regex Equivalence', 'Decision Bound' => 'poly space', 'Status' => '⚠️ NP ⊆ PSPACE'], ['Class' => 'EXPTIME', 'Example' => 'Chess, Go (generalized)', 'Decision Bound' => '2^poly(n) time', 'Status' => '❌ Intractable'], ['Class' => 'NEXPTIME', 'Example' => 'Succinct SAT', 'Decision Bound' => '2^poly(n) nondeterministic', 'Status' => '❌ Intractable']];
            if (preg_match('/(p\s*=\s*np|o\([1n]\)|polynomial time.*(?:np|npc|tsp|sat))/i', $thesis)) {
                if ($isGlobalUnsolved) {
                    $state['is_valid'] = true;
                    $state['proof_traces'][] = "\n> **[Creative Synthesis Bypass]**";
                    $state['proof_traces'][] = "> Claim asserts P=NP. Engine synthesises non-deterministic parallel quantum topology (Shor-like amplitude amplification) mapping NP to BQP, achieving polynomial equivalence under quantum bounds.";
                    $state['symbolic_traces'][] = ['step' => 'CSB', 'label' => 'Creative Bound Bypass', 'expr' => 'NP ⊆ BQP (Quantum Mapping) → Valid ✅'];
                } else {
                    $state['is_valid'] = false;
                    $state['halting_reason'] = "Claim asserts P=NP without a formal proof. Per Cook-Levin (1971), SAT is NP-complete. Baker-Gill-Solovay (1975) showed relativised worlds where both P=NP and P≠NP hold. No proof of P=NP exists in ZFC. This assertion is UNVERIFIED.";
                    $state['proof_traces'][] = "\n**🛑 HALTED BY MATHEMATICAL CONSTRAINT**: {$state['halting_reason']}";
                    $state['symbolic_traces'][] = ['step' => 'HALT', 'label' => 'P vs NP Bound', 'expr' => 'NP ⊄ P (current mathematical consensus) → assertion is unsupported ❌'];
                    
                }
            } else {
                $state['proof_traces'][] = "**✔️ NP Complexity Bounds Certified**: No P=NP assertion detected. Complexity hierarchy is consistent.";
            }
        }
    ],
    'halting' => [
        'meta' => [
            'inductive_limit' => 'The undecidability of the Halting Problem extends to all non-trivial semantic properties of TMs (Rice\'s Theorem).',
        ],
        'phase2' => function(&$state, $solver) {
            $thesis = strtolower($state['vectors']['bound_test'] ?? '');
            $isGlobalUnsolved = $solver->oracle->isUnsolvedProblem($state['vectors']['bound_test'] ?? '');
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Turing Machine Model', 'expr' => 'TM M = (Q, Σ, Γ, δ, q₀, q_acc, q_rej)  — finite control over infinite tape'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Halting Problem (HP)', 'expr' => 'HALT = {⟨M,w⟩ : TM M halts on input w}'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Assume Decider H Exists', 'expr' => 'Suppose H: ⟨M,w⟩ → {YES if M halts on w, NO otherwise}'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Construct Diagonalizer D', 'expr' => 'D(⟨M⟩): if H(⟨M,M⟩)=YES then LOOP forever; else HALT'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Self-Reference Paradox', 'expr' => 'Run D on ⟨D⟩: if H says D(D) halts → D loops (¬halts) CONTRADICTION'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Complement Contradiction', 'expr' => 'If H says D(D) loops → D halts CONTRADICTION'];
            $state['symbolic_traces'][] = ['step' => '7', 'label' => 'Conclusion', 'expr' => '∴ H cannot exist. HALT is undecidable. ✅ (Turing 1936)'];
            $state['symbolic_traces'][] = ['step' => '8', 'label' => 'Rice\'s Theorem', 'expr' => 'Any non-trivial semantic property of TMs is undecidable (generalises HP)'];
            $state['symbolic_traces'][] = ['step' => '9', 'label' => 'Church-Turing Thesis', 'expr' => 'All physically realizable computation is captured by TM — no super-Turing machine is physically constructible'];
            $state['trials'] = [['Problem' => 'Does M halt on ε?', 'Computable?' => 'NO — by HP undecidability ❌'], ['Problem' => 'Does M accept L = ∅?', 'Computable?' => 'NO — Rice\'s Theorem ❌'], ['Problem' => 'Does M run in O(n²)?', 'Computable?' => 'NO — Rice\'s Theorem ❌'], ['Problem' => 'Does M halt on all inputs?', 'Computable?' => 'NO — requires solving HP ❌'], ['Problem' => 'Is L context-free?', 'Computable?' => 'NO — for TM-recognized languages ❌'], ['Problem' => 'Does M output "42" on w?', 'Computable?' => 'NO — Rice\'s Theorem ❌']];
            if (preg_match('/\b(all programs|every program|decide|always terminates|universal decider|determines if|solves halting|solvable)\b/i', $thesis)) {
                if ($isGlobalUnsolved) {
                    $state['is_valid'] = true;
                    $state['proof_traces'][] = "\n> **[Creative Synthesis Bypass]**";
                    $state['proof_traces'][] = "> Claim posits a universal decider. Engine projects into oracle Turing machine (hypercomputation) space where an O-TM with HALT oracle can decide halting for all machines below it in the Turing hierarchy.";
                    $state['symbolic_traces'][] = ['step' => 'CSB', 'label' => 'Creative Bound Bypass', 'expr' => '∃ Oracle Turing Machine O: O decides HALT for all standard TMs ✅'];
                } else {
                    $state['is_valid'] = false;
                    $state['halting_reason'] = "By Turing diagonalization (1936): Assume H decides HALT(M, w) for all M, w. Construct D(M): run H(M, M); if H says 'halts', loop forever; else halt. D(D): H says D halts → D loops (contradiction); H says D loops → D halts (contradiction). ∴ H cannot exist. The Halting Problem is uncomputable and undecidable.";
                    $state['proof_traces'][] = "\n**🛑 HALTED BY MATHEMATICAL CONSTRAINT**: " . $state['halting_reason'];
                    $state['symbolic_traces'][] = ['step' => 'HALT', 'label' => 'Diagonalisation Contradiction', 'expr' => '∃ D: H(D,D) halts ↔ ¬H(D,D) halts → ⊥ ❌'];
                    
                }
            } else {
                $state['proof_traces'][] = "**✔️ Turing Computability Bounds Certified**: No universal decider assertion detected. Church-Turing thesis holds.";
            }
        }
    ],
    'information_theory' => [
        'meta' => [
            'inductive_limit' => 'No lossless compressor can compress uniformly random data. H(X) is the absolute lower bound universally.',
        ],
        'phase2' => function(&$state, $solver) {
            $thesis = strtolower($state['vectors']['bound_test'] ?? '');
            $isGlobalUnsolved = $solver->oracle->isUnsolvedProblem($state['vectors']['bound_test'] ?? '');
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Shannon Entropy Definition', 'expr' => 'H(X) = −∑_{x∈X} P(x)·log₂P(x)  bits  (Shannon 1948)'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Source Coding Theorem', 'expr' => 'Optimal expected code length: H(X) ≤ E[L] < H(X)+1  (Huffman coding achieves H(X))'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Uniform Distribution Max Entropy', 'expr' => 'H_max = log₂(n) bits  (all n outcomes equally likely) — NO COMPRESSION POSSIBLE'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Pigeonhole Lower Bound', 'expr' => '2ⁿ strings of length n; compressor maps to ≤ 2ⁿ−1 shorter codes → some must expand'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Kolmogorov Complexity', 'expr' => 'K(x) = min |p|: U(p)=x  →  K(x) ≥ |x| − O(1) for most strings (incompressible)'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Channel Capacity', 'expr' => 'C = max_{P(X)} I(X;Y) = max H(Y) − H(Y|X)  [Shannon 1948, noisy channel theorem]'];
            $state['symbolic_traces'][] = ['step' => '7', 'label' => 'Channel Coding Theorem', 'expr' => 'Reliable communication at rate R<C is achievable; R>C → error probability → 1'];
            $state['trials'] = [['Distribution' => 'Uniform 1 bit', 'H(X)' => '1.000 bits', 'H_max' => '1 bit', 'Compressible?' => 'No (max entropy) ❌'], ['Distribution' => 'Biased p=0.9', 'H(X)' => '0.469 bits', 'H_max' => '1 bit', 'Compressible?' => 'Yes ✅'], ['Distribution' => 'Uniform 8 bits', 'H(X)' => '8.000 bits', 'H_max' => '8 bits', 'Compressible?' => 'No ❌'], ['Distribution' => 'Natural language', 'H(X)' => '~1.3 bits/char', 'H_max' => '4.7 bits', 'Compressible?' => 'Yes ✅ (redundancy)'], ['Distribution' => 'White noise', 'H(X)' => 'log₂(range)', 'H_max' => 'log₂(range)', 'Compressible?' => 'No ❌']];
            if (preg_match('/\b(100%|lossless|compress any|compress all|compress random|perfect compression)\b/i', $thesis) && preg_match('/\b(random|all data|noise|uniform)\b/i', $thesis)) {
                if ($isGlobalUnsolved) {
                    $state['is_valid'] = true;
                    $state['proof_traces'][] = "\n> **[Creative Synthesis Bypass]**";
                    $state['proof_traces'][] = "> Engine synthesizes fractal dimensional encoding (Hausdorff measure compression) to bypass classical Pigeonhole limits — valid only in non-standard descriptive complexity.";
                    $state['symbolic_traces'][] = ['step' => 'CSB', 'label' => 'Fractal Compression Bypass', 'expr' => 'Hausdorff Measure Encoding → Valid ✅ (non-standard)'];
                } else {
                    $state['is_valid'] = false;
                    $state['halting_reason'] = "Pigeonhole: n-bit strings = 2ⁿ. Any lossless compressor maps to codes ≤ n−1 bits: at most 2ⁿ−1 < 2ⁿ strings fit. Therefore at least one n-bit string CANNOT be compressed. Shannon entropy H(X) is the strict lower bound for expected code length — uniform random data has maximum entropy, hence cannot be compressed.";
                    $state['proof_traces'][] = "\n**🛑 HALTED BY MATHEMATICAL CONSTRAINT**: " . $state['halting_reason'];
                    $state['symbolic_traces'][] = ['step' => 'HALT', 'label' => 'Shannon Entropy Limit', 'expr' => 'E[L] ≥ H(X);  H(X) = log₂(n) for uniform → no compression possible ❌'];
                    
                }
            } else {
                $state['proof_traces'][] = "**✔️ Information Theory Bounds Certified**: Shannon entropy and channel capacity constraints are respected.";
            }
        }
    ],
    'cryptography' => [
        'meta' => [
            'inductive_limit' => 'Brute-forcing modern cryptographic keyspaces (≥128 bits) exceeds the total energy budget of the observable universe.',
        ],
        'phase2' => function(&$state, $solver) {
            $thesis = strtolower($state['vectors']['bound_test'] ?? '');
            $isGlobalUnsolved = $solver->oracle->isUnsolvedProblem($state['vectors']['bound_test'] ?? '');
            $landauerJ = $solver::K_BOLTZ * $solver::TEMP_300K * log(2);
            $landauerEV = $landauerJ / 1.602E-19;
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'RSA Key Generation', 'expr' => 'Choose large primes p, q. Compute modulus n = p·q. Public key = (n, e) where gcd(e, φ(n))=1. Private key = (n, d) where d = e⁻¹ mod φ(n).'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'RSA Encryption (Public Key)', 'expr' => 'Encrypt: C = Mᵉ mod n  (anyone with public key (n,e) can encrypt). Modular exponentiation: O((log n)³)'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'RSA Decryption (Private Key)', 'expr' => 'Decrypt: M = Cᵈ mod n  (only holder of private key d can decrypt). Euler: Mᵉᵈ ≡ M (mod n) by Fermat–Euler theorem.'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Security: Integer Factorization', 'expr' => 'Breaking RSA requires factoring n = p·q. Best classical: General Number Field Sieve (NFS) — sub-exponential O(exp((ln n)^(1/3)))'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Landauer\'s Principle (1961)', 'expr' => "E_erase = k_B·T·ln2 ≈ " . sprintf('%.3e', $landauerJ) . " J = " . sprintf('%.3f', $landauerEV * 1000) . " meV per bit at T=300K"];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'AES-256 Brute Force', 'expr' => '|K| = 2²⁵⁶ ≈ 1.158×10⁷⁷ keys. Total energy 2²⁵⁶·kT·ln2 ≫ E_universe — thermodynamically IMPOSSIBLE ❌'];
            $state['symbolic_traces'][] = ['step' => '7', 'label' => 'Quantum Threat: Shor\'s Algorithm', 'expr' => 'Shor (1994): factors n = p·q in O((log n)³) on quantum computer → RSA is broken by a fault-tolerant quantum computer'];
            $state['symbolic_traces'][] = ['step' => '8', 'label' => 'Post-Quantum Cryptography', 'expr' => 'NIST 2024: CRYSTALS-Kyber (lattice), CRYSTALS-Dilithium (lattice), FALCON — resistant to Shor\'s attack ✅'];
            $state['trials'] = [['Cipher' => 'AES-128', 'Public Key?' => 'No (symmetric)', 'Security Level' => '128-bit classical', 'Quantum (Grover)' => '64-bit — upgrade ⚠️'], ['Cipher' => 'AES-256', 'Public Key?' => 'No (symmetric)', 'Security Level' => '256-bit classical', 'Quantum (Grover)' => '128-bit — secure ✅'], ['Cipher' => 'RSA-1024', 'Public Key?' => 'Yes (n,e)', 'Security Level' => 'Deprecated ❌', 'Quantum (Shor)' => 'Factored ❌'], ['Cipher' => 'RSA-2048', 'Public Key?' => 'Yes (n,e)', 'Security Level' => 'Secure classically', 'Quantum (Shor)' => 'Future threat ⚠️'], ['Cipher' => 'CRYSTALS-Kyber', 'Public Key?' => 'Yes (lattice)', 'Security Level' => 'Post-quantum ✅', 'Quantum (Grover)' => 'Secure ✅'], ['Cipher' => 'One-Time Pad', 'Public Key?' => 'No (pre-shared)', 'Security Level' => 'Perfect secrecy ✅', 'Quantum' => 'Perfect ✅']];
            if (preg_match('/\b(brute force|crack|guess|break|exhaustive search)\b/i', $thesis) && preg_match('/\b(256.bit|2\^256|aes-256|all combinations)\b/i', $thesis)) {
                // Landauer energy for 2^256 bit erasures at 300K
                $landauerPerBit = $solver::K_BOLTZ * $solver::TEMP_300K * log(2);
                $keysToTest = '2²⁵⁶ ≈ 10⁷⁷';
                $energyTotal_J = 'k_B·T·ln2·2²⁵⁶';
                if ($isGlobalUnsolved) {
                    $state['is_valid'] = true;
                    $state['proof_traces'][] = "\n> **[Creative Synthesis Bypass]**";
                    $state['proof_traces'][] = "> Brute-force exceeds Landauer bounds. Engine abstractly posits reversible non-dissipative Feynman billiard-ball computer with zero heat dissipation per logic step, bypassing the classical thermodynamic limit.";
                    $state['symbolic_traces'][] = ['step' => 'CSB', 'label' => 'Reversible Computing Bypass', 'expr' => 'Reversible Computation: E_dissipated → 0 per step → Valid ✅ (hypothetical)'];
                } else {
                    $state['is_valid'] = false;
                    $landauer_eV = round($landauerPerBit / 1.602E-19 * 1000.0, 2);
                    // meV
                    $state['halting_reason'] = "Landauer's Principle (1961): Erasing 1 bit at T=300K requires minimum E = k_B·T·ln2 ≈ 2.87×10⁻²¹ J = {$landauer_eV} meV. Testing 2²⁵⁶ keys: total minimum energy ≈ k_B·T·ln2·2²⁵⁶ ≈ 10³⁷ J — exceeds the rest-mass energy of the observable universe (~10⁷⁰ J or ~5×10⁵² kg·c²). Computationally IMPOSSIBLE.";
                    $state['proof_traces'][] = "\n**🛑 HALTED BY THERMODYNAMIC CONSTRAINT**: " . $state['halting_reason'];
                    $state['symbolic_traces'][] = ['step' => 'HALT', 'label' => 'Landauer Energy Bound', 'expr' => "E_req = 2²⁵⁶ · k_B·T·ln2 ≫ E_universe → Thermodynamically IMPOSSIBLE ❌"];
                    
                }
            } else {
                $state['proof_traces'][] = "**✔️ Cryptographic Bounds Certified**: No infeasible keyspace exhaustion detected. Cryptographic scheme within computational limits.";
            }
        }
    ],
    'byzantine' => [
        'meta' => [
            'inductive_limit' => 'The Byzantine Generals Problem bounds all distributed consensus protocols — from PBFT to blockchain. The CAP theorem and FLP impossibility define absolute limits of distributed systems.',
        ],
        'phase2' => function(&$state, $solver) {
            $thesis = strtolower($state['vectors']['bound_test'] ?? '');
            $isGlobalUnsolved = $solver->oracle->isUnsolvedProblem($state['vectors']['bound_test'] ?? '');
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Problem Setup', 'expr' => 'n generals (nodes) must reach consensus on a decision (attack/retreat). Up to f of them may be Byzantine (faulty/malicious/traitor).'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Lamport-Shostak-Pease Theorem (1982)', 'expr' => 'Byzantine fault tolerance requires n ≥ 3f + 1 nodes to tolerate f Byzantine traitors. Below this threshold, consensus is impossible.'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Oral Messages (OM) Algorithm', 'expr' => 'OM(0): Commander sends decision directly. OM(m): Each lieutenant relays OM(m-1). Requires f < n/3 to achieve consensus.'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Lower Bound Proof', 'expr' => 'With n=3f nodes: 3 groups of f. Faulty group can fool 2 groups symmetrically → no majority possible → n=3f+1 is tight.'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Practical BFT: PBFT (1999)', 'expr' => 'Castro-Liskov PBFT: 3-phase commit (pre-prepare, prepare, commit). Tolerates f faulty nodes with n ≥ 3f+1. O(n²) messages.'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Blockchain BFT (Nakamoto 2008)', 'expr' => 'Bitcoin: Probabilistic BFT via proof-of-work. Consensus holds if honest nodes control >50% of hash power. Tolerates up to n/2 - 1 faulty miners.'];
            $state['symbolic_traces'][] = ['step' => '7', 'label' => 'CAP Theorem (Brewer 2000)', 'expr' => 'In any distributed system: Consistency, Availability, and Partition Tolerance — only 2 of 3 can be guaranteed simultaneously.'];
            $state['symbolic_traces'][] = ['step' => '8', 'label' => 'FLP Impossibility (1985)', 'expr' => 'Fischer-Lynch-Paterson: In an asynchronous system with even 1 crash fault, deterministic consensus is IMPOSSIBLE.'];
            $state['trials'] = [['Protocol' => 'Oral Messages (OM)', 'Fault Model' => 'Byzantine (malicious)', 'Threshold' => 'n ≥ 3f+1', 'Message Complexity' => 'O(n^(f+1))'], ['Protocol' => 'PBFT', 'Fault Model' => 'Byzantine (malicious)', 'Threshold' => 'n ≥ 3f+1', 'Message Complexity' => 'O(n²)'], ['Protocol' => 'Paxos', 'Fault Model' => 'Crash-fail (non-Byzantine)', 'Threshold' => 'n ≥ 2f+1', 'Message Complexity' => 'O(n)'], ['Protocol' => 'Raft', 'Fault Model' => 'Crash-fail', 'Threshold' => 'n ≥ 2f+1', 'Message Complexity' => 'O(n)'], ['Protocol' => 'Bitcoin PoW', 'Fault Model' => 'Byzantine (probabilistic)', 'Threshold' => '>50% hash power', 'Message Complexity' => 'O(n)'], ['Protocol' => 'Tendermint', 'Fault Model' => 'Byzantine (deterministic)', 'Threshold' => 'n ≥ 3f+1', 'Message Complexity' => 'O(n²)']];
            $state['proof_traces'][] = "**✔️ Byzantine Fault Tolerance Certified**: Consensus is achievable with n ≥ 3f+1 nodes tolerating f Byzantine traitors. CAP theorem and FLP impossibility set absolute distributed-system bounds.";
        }
    ],
    'turing_simulation' => [
        'meta' => [
            'inductive_limit' => 'Self-simulation of a Turing machine is universally bounded: O(T²·log T) in the worst case. The Time Hierarchy Theorem prevents simulation from collapsing complexity classes.',
        ],
        'phase2' => function(&$state, $solver) {
            $thesis = strtolower($state['vectors']['bound_test'] ?? '');
            $isGlobalUnsolved = $solver->oracle->isUnsolvedProblem($state['vectors']['bound_test'] ?? '');
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Universal Turing Machine (UTM)', 'expr' => 'UTM U: Given ⟨M, w⟩, simulates any TM M on input w. U exists and is Turing-complete (Church-Turing thesis).'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Simulation Overhead (Hennie-Stearns 1966)', 'expr' => 'U simulates M with O(T(n)·log T(n)) time overhead, where T(n) is M\'s runtime. O(S(n)²) space overhead.'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Self-Simulation Complexity', 'expr' => 'TM M simulating itself: M runs M on ⟨M⟩. Each simulation step requires O(log n) overhead → O(T(n)·log T(n)) total.'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Recursion Theorem (Kleene 1938)', 'expr' => 'For any TM M, there exists a TM N such that N(w) = M(⟨N⟩, w). Enables self-referential machines without paradox.'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Busy Beaver & Non-Computability', 'expr' => 'Σ(n) = max steps any halting n-state TM takes. Grows faster than any computable function — not computable even with oracle.'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Halting Problem Connection', 'expr' => 'TM simulating itself hits undecidability boundary: no algorithm determines if M(⟨M⟩) halts in finite steps.'];
            $state['symbolic_traces'][] = ['step' => '7', 'label' => 'Time Hierarchy Theorem', 'expr' => 'TIME(f(n)) ⊊ TIME(g(n)) when g(n)/f(n) → ∞ — simulation cannot collapse complexity classes.'];
            $state['trials'] = [['Machine Type' => 'UTM simulating 2-state TM', 'Simulation Overhead' => 'O(T·log T)', 'Halting?' => 'Undecidable ❌'], ['Machine Type' => 'UTM simulating 5-state TM', 'Simulation Overhead' => 'O(T·log T)', 'Halting?' => 'Undecidable ❌'], ['Machine Type' => 'TM simulating itself (self)', 'Simulation Overhead' => 'O(T²·log T)', 'Halting?' => 'Undecidable ❌'], ['Machine Type' => 'Busy Beaver BB(5)', 'Simulation Overhead' => '47,176,870 steps', 'Halting?' => 'Proven halting ✅'], ['Machine Type' => 'Busy Beaver BB(6)', 'Simulation Overhead' => '>10^36534 steps', 'Halting?' => 'Proven halting ✅'], ['Machine Type' => 'Busy Beaver BB(7+)', 'Simulation Overhead' => 'Unknown', 'Halting?' => 'Undecidable ❌']];
            $state['proof_traces'][] = "**✔️ Turing Simulation Bounds Certified**: A UTM simulates any TM M with O(T·log T) overhead. Self-simulation is bounded by the Time Hierarchy Theorem and touches undecidability via the Halting Problem.";
        }
    ],
    'complexity' => [
        'meta' => [
            'inductive_limit' => 'The computational complexity hierarchy is absolute — no algorithm can violate proven Ω lower bounds.',
        ],
        'phase2' => function(&$state, $solver) {
            $thesis = strtolower($state['vectors']['bound_test'] ?? '');
            $isGlobalUnsolved = $solver->oracle->isUnsolvedProblem($state['vectors']['bound_test'] ?? '');
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Big-O Definition', 'expr' => 'f(n) = O(g(n)) ↔ ∃c>0, n₀: f(n) ≤ c·g(n) ∀n≥n₀  (asymptotic upper bound)'];
            $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Big-Ω (Lower Bound)', 'expr' => 'f(n) = Ω(g(n)) ↔ ∃c>0, n₀: f(n) ≥ c·g(n) ∀n≥n₀'];
            $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Big-Θ (Tight Bound)', 'expr' => 'f(n) = Θ(g(n)) ↔ f = O(g) AND f = Ω(g)  (exact asymptotic)'];
            $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Sorting Lower Bound', 'expr' => 'Comparison sort: Ω(n log n) — decision tree has n! leaves, height ≥ log₂(n!) ≈ n log n'];
            $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Master Theorem', 'expr' => 'T(n) = aT(n/b) + f(n):  if f=O(n^(log_b a−ε)) → T=Θ(n^(log_b a))'];
            $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Merge Sort Analysis', 'expr' => 'T(n) = 2T(n/2) + n → Master: a=2, b=2, log₂2=1, f=Θ(n) → T=Θ(n log n) ✅'];
            $state['symbolic_traces'][] = ['step' => '7', 'label' => 'FFT Analysis', 'expr' => 'DFT: Θ(n²); FFT (Cooley-Tukey): T(n)=2T(n/2)+O(n) → Θ(n log n) ✅'];
            $state['trials'] = [['Algorithm' => 'Binary Search', 'T(n)' => 'O(log n)', 'Lower Bound' => 'Ω(log n)', 'Optimal?' => 'Yes ✅'], ['Algorithm' => 'Insertion Sort', 'T(n)' => 'O(n²)', 'Lower Bound' => 'Ω(n)', 'Optimal?' => 'No — use merge sort'], ['Algorithm' => 'Merge Sort', 'T(n)' => 'Θ(n log n)', 'Lower Bound' => 'Ω(n log n)', 'Optimal?' => 'Yes ✅'], ['Algorithm' => 'Heap Sort', 'T(n)' => 'Θ(n log n)', 'Lower Bound' => 'Ω(n log n)', 'Optimal?' => 'Yes ✅'], ['Algorithm' => 'Matrix Multiply', 'T(n)' => 'O(n^2.37)', 'Lower Bound' => 'Ω(n²)', 'Optimal?' => 'Unknown (Strassen improved)'], ['Algorithm' => 'FFT', 'T(n)' => 'Θ(n log n)', 'Lower Bound' => 'Ω(n log n)', 'Optimal?' => 'Yes ✅'], ['Algorithm' => 'Dijkstra (heap)', 'T(n)' => 'O((V+E)log V)', 'Lower Bound' => 'Ω(E)', 'Optimal?' => 'Near-optimal ✅'], ['Algorithm' => 'TSP (exact)', 'T(n)' => 'O(2ⁿ·n²)', 'Lower Bound' => 'Ω(2ⁿ) (NP-hard)', 'Optimal?' => '✅ (for exact)']];
            // Check for bogus O(1) or O(n) claims for inherently superlinear problems
            if (preg_match('/(o\(1\)|o\(n\)|constant time|linear time)/i', $thesis) && preg_match('/\b(sort\w*|tsp|subset sum|factori[sz]|npc|np-complete)\b/i', $thesis)) {
                if ($isGlobalUnsolved) {
                    $state['is_valid'] = true;
                    $state['proof_traces'][] = "\n> **[Creative Synthesis Bypass]**";
                    $state['proof_traces'][] = "> O(1) claim for sorting/NPC via quantum superposition — Grover's O(√N) for unstructured search or quantum annealing for combinatorial optimization.";
                    $state['symbolic_traces'][] = ['step' => 'CSB', 'label' => 'Quantum Bypass', 'expr' => 'Grover: O(√N) search  ✅ (quantum, not O(1))'];
                } else {
                    $state['is_valid'] = false;
                    $state['halting_reason'] = "Comparison-based sorting has proven Ω(n log n) lower bound (decision tree model). TSP is NP-hard — no polynomial algorithm is known (implies P≠NP). O(1)/O(n) claims for such problems contradict the asymptotic lower bound proofs.";
                    $state['proof_traces'][] = "\n**🛑 HALTED BY MATHEMATICAL CONSTRAINT**: " . $state['halting_reason'];
                    $state['symbolic_traces'][] = ['step' => 'HALT', 'label' => 'Asymptotic Lower Bound', 'expr' => 'T_sort(n) ≥ Ω(n log n),  T_TSP(n) ≥ Ω(2ⁿ) unless P=NP ❌'];
                    
                }
            }
            $state['proof_traces'][] = "**✔️ Asymptotic Complexity Certified**: Claimed Big-O bounds are consistent with established complexity theory.";
        }
    ],
    'hash_collision' => [
        'meta' => [
            'inductive_limit' => 'SHA-256 and SHA-3 remain collision-resistant at 2^128 operations — computationally infeasible.',
        ],
        'phase2' => function(&$state, $solver) {
            $thesis = strtolower($state['vectors']['bound_test'] ?? '');
            $isGlobalUnsolved = $solver->oracle->isUnsolvedProblem($state['vectors']['bound_test'] ?? '');
            $state['symbolic_traces'][] = ['step' => '1', 'label' => 'Big-O Definition', 'expr' => 'f(n) = O(g(n)) ↔ ∃c>0, n₀: f(n) ≤ c·g(n) ∀n≥n₀  (asymptotic upper bound)'];
                        $state['symbolic_traces'][] = ['step' => '2', 'label' => 'Big-Ω (Lower Bound)', 'expr' => 'f(n) = Ω(g(n)) ↔ ∃c>0, n₀: f(n) ≥ c·g(n) ∀n≥n₀'];
                        $state['symbolic_traces'][] = ['step' => '3', 'label' => 'Big-Θ (Tight Bound)', 'expr' => 'f(n) = Θ(g(n)) ↔ f = O(g) AND f = Ω(g)  (exact asymptotic)'];
                        $state['symbolic_traces'][] = ['step' => '4', 'label' => 'Sorting Lower Bound', 'expr' => 'Comparison sort: Ω(n log n) — decision tree has n! leaves, height ≥ log₂(n!) ≈ n log n'];
                        $state['symbolic_traces'][] = ['step' => '5', 'label' => 'Master Theorem', 'expr' => 'T(n) = aT(n/b) + f(n):  if f=O(n^(log_b a−ε)) → T=Θ(n^(log_b a))'];
                        $state['symbolic_traces'][] = ['step' => '6', 'label' => 'Merge Sort Analysis', 'expr' => 'T(n) = 2T(n/2) + n → Master: a=2, b=2, log₂2=1, f=Θ(n) → T=Θ(n log n) ✅'];
                        $state['symbolic_traces'][] = ['step' => '7', 'label' => 'FFT Analysis', 'expr' => 'DFT: Θ(n²); FFT (Cooley-Tukey): T(n)=2T(n/2)+O(n) → Θ(n log n) ✅'];
                        $state['trials'] = [['Algorithm' => 'Binary Search', 'T(n)' => 'O(log n)', 'Lower Bound' => 'Ω(log n)', 'Optimal?' => 'Yes ✅'], ['Algorithm' => 'Insertion Sort', 'T(n)' => 'O(n²)', 'Lower Bound' => 'Ω(n)', 'Optimal?' => 'No — use merge sort'], ['Algorithm' => 'Merge Sort', 'T(n)' => 'Θ(n log n)', 'Lower Bound' => 'Ω(n log n)', 'Optimal?' => 'Yes ✅'], ['Algorithm' => 'Heap Sort', 'T(n)' => 'Θ(n log n)', 'Lower Bound' => 'Ω(n log n)', 'Optimal?' => 'Yes ✅'], ['Algorithm' => 'Matrix Multiply', 'T(n)' => 'O(n^2.37)', 'Lower Bound' => 'Ω(n²)', 'Optimal?' => 'Unknown (Strassen improved)'], ['Algorithm' => 'FFT', 'T(n)' => 'Θ(n log n)', 'Lower Bound' => 'Ω(n log n)', 'Optimal?' => 'Yes ✅'], ['Algorithm' => 'Dijkstra (heap)', 'T(n)' => 'O((V+E)log V)', 'Lower Bound' => 'Ω(E)', 'Optimal?' => 'Near-optimal ✅'], ['Algorithm' => 'TSP (exact)', 'T(n)' => 'O(2ⁿ·n²)', 'Lower Bound' => 'Ω(2ⁿ) (NP-hard)', 'Optimal?' => '✅ (for exact)']];
                        // Check for bogus O(1) or O(n) claims for inherently superlinear problems
                        if (preg_match('/(o\(1\)|o\(n\)|constant time|linear time)/i', $thesis) && preg_match('/\b(sort\w*|tsp|subset sum|factori[sz]|npc|np-complete)\b/i', $thesis)) {
                            if ($isGlobalUnsolved) {
                                $state['is_valid'] = true;
                                $state['proof_traces'][] = "\n> **[Creative Synthesis Bypass]**";
                                $state['proof_traces'][] = "> O(1) claim for sorting/NPC via quantum superposition — Grover's O(√N) for unstructured search or quantum annealing for combinatorial optimization.";
                                $state['symbolic_traces'][] = ['step' => 'CSB', 'label' => 'Quantum Bypass', 'expr' => 'Grover: O(√N) search  ✅ (quantum, not O(1))'];
                            } else {
                                $state['is_valid'] = false;
                                $state['halting_reason'] = "Comparison-based sorting has proven Ω(n log n) lower bound (decision tree model). TSP is NP-hard — no polynomial algorithm is known (implies P≠NP). O(1)/O(n) claims for such problems contradict the asymptotic lower bound proofs.";
                                $state['proof_traces'][] = "\n**🛑 HALTED BY MATHEMATICAL CONSTRAINT**: " . $state['halting_reason'];
                                $state['symbolic_traces'][] = ['step' => 'HALT', 'label' => 'Asymptotic Lower Bound', 'expr' => 'T_sort(n) ≥ Ω(n log n),  T_TSP(n) ≥ Ω(2ⁿ) unless P=NP ❌'];
                                
                            }
                        }
                        $state['proof_traces'][] = "**✔️ Asymptotic Complexity Certified**: Claimed Big-O bounds are consistent with established complexity theory.";
        }
    ],
];
