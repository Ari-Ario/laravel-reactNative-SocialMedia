<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * NATURAL LANGUAGE INTENT SERVICE — AST Dialectical Engine v3
 *
 * Fully dynamic AST tokenization covering:
 * - Propositional logic: Modus Ponens/Tollens, Disjunctive, Hypothetical, Constructive/Destructive Dilemma
 * - Categorical syllogisms: All/Some/No quantifiers
 * - Number Theory: Parity, Divisibility, Algebraic operations
 * - Empirical Science: Thermodynamic, Kinematic, Biological, Chemical vectors
 * - Inductive / Causal reasoning patterns
 */
class NaturalLanguageIntentService
{
    const INTENT_PROOF       = 'proof_request';
    const INTENT_CALCULATION = 'calculation';
    const INTENT_EXPLANATION = 'explanation';
    const INTENT_SOCIAL      = 'social_question';
    const INTENT_GENERAL     = 'general_chat';

    const CACHE_TTL = 3600; // 1 hour — intent resolution is fully deterministic

    /**
     * In-process request cache keyed by sha256(rawInput).
     * In Octane, this persists for the worker lifetime — repeated identical
     * queries (burst retries, popular queries) are answered at zero cost.
     */
    private static array $requestCache = [];

    public function resolve(string $rawInput): array
    {
        $cacheKey = 'dire:ast:v3:' . hash('sha256', $rawInput);

        // Layer 0: in-process static cache (zero latency)
        if (isset(self::$requestCache[$cacheKey])) {
            return self::$requestCache[$cacheKey];
        }

        // Layer 1: Redis/DB distributed cache
        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            $cached['cache_hit'] = true;
            self::$requestCache[$cacheKey] = $cached;
            return $cached;
        }

        // ── Stage 1: Sanitize ─────────────────────────────
        [$normalized, $corrections] = $this->sanitize($rawInput);

        // ── Stage 2: AST Compilation ──────────────────────
        $ast = $this->compileAST($normalized);

        // ── Stage 3: Matrix/Thesis Extraction ─────────────
        $thesis = $this->extractThesisFromAST($ast, $normalized);

        // ── Stage 4: Branch Routing via AST Signatures ────
        [$branch, $oracleKey, $intent] = $this->mapBranchFromAST($ast, $normalized);

        $result = [
            'intent'           => $intent,
            'thesis'           => $thesis,
            'ast_matrix'       => $ast,
            'thesis_structure' => $ast['primary_node_type'] ?? 'conversational_statement',
            'branch'           => $branch,
            'oracle_key'       => $oracleKey,
            'confidence'       => $ast['is_mathematical'] ? 0.95 : 0.60,
            'normalized'       => $normalized,
            'original'         => $rawInput,
            'corrections'      => $corrections,
            'variables'        => $ast['variables'] ?? [],
            'is_social'        => in_array($branch, ['social', 'humanities']),
            'scores'           => [],
            'cache_hit'        => false,
        ];

        Cache::put($cacheKey, $result, self::CACHE_TTL);
        self::$requestCache[$cacheKey] = $result; // populate in-process cache too
        return $result;
    }

    private function sanitize(string $input): array
    {
        $corrections = [];
        $text = \App\Services\Dialectical\Semantic\LaTeXMathNormalizer::normalize($input);
        $text = strip_tags($text);
        $text = preg_replace('/\s+/', ' ', trim($text));

        // Basic abbreviation expansion
        $abbrevs = DialecticalKeywordBank::abbreviations();
        foreach ($abbrevs as $bad => $good) {
            $pattern = '/(?<![a-zA-Z0-9\^\+\-\*\/])' . preg_quote($bad, '/') . '(?![a-zA-Z0-9\^\+\-\*\/])/i';
            $replaced = preg_replace($pattern, $good, $text);
            if ($replaced !== $text) {
                $corrections[] = "{$bad}→{$good}";
                $text = $replaced;
            }
        }

        $text = strtolower(trim($text));

        $noisePatterns = [
            '/^(prove:|prove|proof|show that|demonstrate|verify|establish|calculate|compute|evaluate|solve|explain|define|describe|what is|what are)\s*:?\s*/i',
            '/\b(please|just|quickly|kindly|for me|to me|me that|is it true|is this correct|can you|could you|i want|i need|help me|tell me)\b\s*/i',
        ];
        foreach ($noisePatterns as $pattern) {
            $text = preg_replace($pattern, '', $text);
        }
        $text = trim($text);

        // Protect special names from being destroyed
        if (str_contains($text, 'navier') && str_contains($text, 'stokes')) {
            $text = str_replace(['navier stokes', 'navier-stokes'], 'navier_stokes', $text);
        }

        return [$text, $corrections];
    }

    private function compileAST(string $normalized): array
    {
        $ast = [
            'nodes'            => [],
            'variables'        => [],
            'is_mathematical'  => false,
            'primary_node_type'=> 'conversational_statement'
        ];

        // ═══════════════════════════════════════════════════════
        // LAYER 1: PURE NUMBER THEORY / MATHEMATICAL STRUCTURES
        // ═══════════════════════════════════════════════════════
        if (preg_match('/\b(even|odd|divisibl[ey]|sum\s+of|product\s+of|difference\s+of|prime|factor|modulo|modulus)\b/i', $normalized)
            || preg_match('/[=÷\^]|\bdivides\b|\bmod\b|[a-z]\^[a-z0-9]/i', $normalized)) {

            $ast['is_mathematical'] = true;
            $ast['primary_node_type'] = 'formal_equation';

            // Extract parity assertions (even/odd)
            if (preg_match_all('/\b(even|odd)\b/i', $normalized, $parityMatches)) {
                $ast['nodes'][] = [
                    'type'     => 'ParityAssertion',
                    'parities' => array_map('strtolower', $parityMatches[1])
                ];
            }

            // Extract divisibility assertions
            if (preg_match('/divisibl[ey]\s+by\s+(\d+)/i', $normalized, $divMatch)) {
                $ast['nodes'][] = [
                    'type'    => 'DivisibilityAssertion',
                    'divisor' => (int)$divMatch[1]
                ];
            }

            // Detect numeric divisibility in form "N divides expr"
            if (preg_match('/^(\d+)\s+divides\s+(.+)$/i', $normalized, $divExprMatch)) {
                $ast['nodes'][] = [
                    'type'    => 'DivisibilityExpression',
                    'divisor' => (int)$divExprMatch[1],
                    'expr'    => trim($divExprMatch[2])
                ];
                $ast['nodes'][] = ['type' => 'RawMath', 'value' => $normalized];
                return $ast;
            }

            // Extract explicit operations (sum/product/difference/power)
            if (preg_match('/\bsum\s+of\b|\badd(?:ition)?\b|\+/i', $normalized)) {
                $ast['nodes'][] = ['type' => 'Operation', 'value' => 'addition'];
            } elseif (preg_match('/\bproduct\s+of\b|\bmultipl\w+\b|\*/i', $normalized)) {
                $ast['nodes'][] = ['type' => 'Operation', 'value' => 'multiplication'];
            } elseif (preg_match('/\bdifference\s+of\b|\bsubtract\w*\b/i', $normalized)) {
                $ast['nodes'][] = ['type' => 'Operation', 'value' => 'subtraction'];
            } elseif (preg_match('/\bpower\b|\^/i', $normalized)) {
                $ast['nodes'][] = ['type' => 'Operation', 'value' => 'exponentiation'];
            }

            // Equation splits (LHS = RHS)
            $parts = explode('=', $normalized);
            if (count($parts) == 2) {
                $ast['nodes'][] = [
                    'type' => 'Equation',
                    'LHS'  => trim($parts[0]),
                    'RHS'  => trim($parts[1])
                ];
            } else {
                $ast['nodes'][] = ['type' => 'RawMath', 'value' => $normalized];
            }

            return $ast;
        }

        // ═══════════════════════════════════════════════════════
        // LAYER 2: EMPIRICAL / SCIENTIFIC STRUCTURES
        // ═══════════════════════════════════════════════════════
        if (preg_match('/\b(energy|machine|power|thermodynamic|entropy|heat|boil|perpetual)\b/i', $normalized)) {
            $ast['primary_node_type'] = 'empirical_system';
            // Detect paradox/violation claim
            $isViolation = (bool) preg_match('/\b(infinite|nothing|from nothing|perpetual|impossible|violate|more than|creates energy)\b/i', $normalized);
            $ast['nodes'][] = [
                'type'        => 'EmpiricalSystemNode',
                'system_type' => 'Thermodynamic',
                'claim'       => $isViolation ? 'E_out > E_in' : 'E_out <= E_in',
                'raw'         => $normalized
            ];
            return $ast;
        }

        if (preg_match('/\b(mass|velocity|speed|accelerat(?:e|ion)|force|momentum|inertia|newton)\b/i', $normalized)) {
            $ast['primary_node_type'] = 'empirical_system';
            $ast['nodes'][] = [
                'type'        => 'EmpiricalSystemNode',
                'system_type' => 'Kinematic',
                'raw'         => $normalized
            ];
            return $ast;
        }

        if (preg_match('/\b(biology|evolution|species|organism|genetic|dna|cell|populat)\b/i', $normalized)) {
            $ast['primary_node_type'] = 'empirical_system';
            $ast['nodes'][] = [
                'type'        => 'EmpiricalSystemNode',
                'system_type' => 'Biological',
                'raw'         => $normalized
            ];
            return $ast;
        }

        if (preg_match('/\b(supply|demand|price|economic|market|cost|inflation|gdp)\b/i', $normalized)) {
            $ast['primary_node_type'] = 'empirical_system';
            $ast['nodes'][] = [
                'type'        => 'EmpiricalSystemNode',
                'system_type' => 'Economic',
                'raw'         => $normalized
            ];
            return $ast;
        }

        // ═══════════════════════════════════════════════════════
        // LAYER 3: PROPOSITIONAL LOGIC (Syllogisms, Implications)
        // ═══════════════════════════════════════════════════════
        // Split by sentence boundaries
        $sentences = preg_split('/(?<=[.?!;])\s+/', $normalized);
        $hasLogic  = false;

        foreach ($sentences as $sentence) {
            $sentence = trim($sentence);
            if (!$sentence) continue;

            // ─── IMPLICATION: If P [then/,] Q ──────────────
            if (preg_match('/^if\s+(.+?)\s+(?:then|implies?)\s+(.+?)(?:\.|$)/i', $sentence, $m)
                || preg_match('/^if\s+(.+?)\s*,\s*(.+?)(?:\.|$)/i', $sentence, $m)) {
                $ast['nodes'][] = ['type' => 'Implication', 'P' => trim($m[1]), 'Q' => trim($m[2])];
                $hasLogic = true;

            // ─── DISJUNCTION: Either A or B ─────────────────
            } elseif (preg_match('/^(?:either\s+)?(.+?)\s+or\s+(.+?)(?:\.|$)/i', $sentence, $m)) {
                $left  = trim($m[1]);
                $right = trim($m[2]);
                // Avoid matching "either … or" that's part of an implication
                if (!preg_match('/^if\s/i', $left)) {
                    $ast['nodes'][] = ['type' => 'Disjunction', 'A' => $left, 'B' => $right];
                    $hasLogic = true;
                }

            // ─── CATEGORICAL: All/Some/No X are Y ───────────
            } elseif (preg_match('/^(all|every|some|no)\s+(.+?)\s+are\s+(.+?)(?:\.|$)/i', $sentence, $m)) {
                $ast['nodes'][] = [
                    'type'       => 'CategoricalPremise',
                    'quantifier' => strtolower($m[1]),
                    'subject'    => trim($m[2]),
                    'predicate'  => trim($m[3])
                ];
                $hasLogic = true;

            // ─── NOT assertion: [X] is not [Y] / Not [X] ───
            } elseif (preg_match('/^(?:not\s+|it is not the case that\s+|i do not\s+|(?:the\s+)?\w[\w\s]+\s+is not\s+)(.+?)(?:\.|$)/i', $sentence, $m)
                     || preg_match('/^(.+?)\s+(?:is not|are not|does not|do not|cannot|will not)(?:\s+(.+?))?(?:\.|$)/i', $sentence, $m2)) {
                $negVal = isset($m[1]) ? trim($m[1]) : trim($m2[1] . ' ' . ($m2[2] ?? ''));
                $ast['nodes'][] = ['type' => 'Negation', 'value' => $negVal, 'raw' => $sentence];
                $hasLogic = true;

            // ─── CONCLUSION: Therefore/Thus/Hence ──────────
            } elseif (preg_match('/^(?:therefore|thus|hence|so|it follows that|we conclude)\s*[,:]?\s*(.+?)(?:\.|$)/i', $sentence, $m)) {
                $ast['nodes'][] = ['type' => 'Conclusion', 'value' => trim($m[1])];
                $hasLogic = true;

            // ─── SINCE implication ──────────────────────────
            } elseif (preg_match('/^since\s+(.+?)\s*,\s*(.+?)(?:\.|$)/i', $sentence, $m)) {
                $ast['nodes'][] = ['type' => 'Implication', 'P' => trim($m[1]), 'Q' => trim($m[2])];
                $hasLogic = true;

            } else {
                // Generic premise
                $ast['nodes'][] = ['type' => 'Premise', 'value' => $sentence];
            }
        }

        if ($hasLogic) {
            $ast['is_mathematical'] = true;
            $ast['primary_node_type'] = 'categorical_syllogism';
        }

        return $ast;
    }

    private function extractThesisFromAST(array $ast, string $normalized): string
    {
        if ($ast['primary_node_type'] === 'categorical_syllogism' && !empty($ast['nodes'])) {
            $parts = [];
            foreach ($ast['nodes'] as $node) {
                if ($node['type'] === 'Implication') {
                    $parts[] = "P ⇒ Q | P: {$node['P']}, Q: {$node['Q']}";
                } elseif ($node['type'] === 'Disjunction') {
                    $parts[] = "A ∨ B | A: {$node['A']}, B: {$node['B']}";
                } elseif ($node['type'] === 'CategoricalPremise') {
                    $parts[] = strtoupper($node['quantifier']) . " {$node['subject']} are {$node['predicate']}";
                } elseif ($node['type'] === 'Conclusion') {
                    $parts[] = "∴ " . $node['value'];
                } elseif ($node['type'] === 'Negation') {
                    $parts[] = "¬ " . $node['value'];
                } elseif ($node['type'] === 'Premise') {
                    $parts[] = $node['value'];
                }
            }
            return implode(' | ', $parts);
        }
        return ucfirst(trim($normalized));
    }

    private function mapBranchFromAST(array $ast, string $normalized): array
    {
        $intent = $ast['is_mathematical'] ? self::INTENT_PROOF : self::INTENT_GENERAL;

        if ($ast['primary_node_type'] === 'categorical_syllogism') {
            return ['logic', 'formal_logic', self::INTENT_PROOF];
        }

        if ($ast['primary_node_type'] === 'formal_equation') {
            if (preg_match('/\b(sin|cos|tan|sinh|cosh|tanh|asin|acos|atan|ln|log|exp|sqrt|lim|derivative|integral)\b/i', $normalized)) {
                return ['math', 'trigonometry', self::INTENT_PROOF];
            }
            if (preg_match('/\|p\(n\)\||cantor|power set|banach-tarski|russell|zfc/i', $normalized)) {
                return ['math', 'set_theory', self::INTENT_PROOF];
            }
            if (preg_match('/e\^\(i\*pi\)|complex|imaginary/i', $normalized)) {
                return ['math', 'complex_domain', self::INTENT_PROOF];
            }
            if (preg_match('/\bsum(?:mation)?\b|\bseries\b/i', $normalized)) {
                return ['math', 'algebraic_summation', self::INTENT_PROOF];
            }
            if (preg_match('/P\([a-zA-Z]\s*\|\s*[a-zA-Z]\)|\b(bayes|probability|covariance|z-score)\b/i', $normalized)) {
                return ['statistics', 'bayes_theorem', self::INTENT_PROOF];
            }
            return ['math', 'peano', self::INTENT_PROOF];
        }

        if ($ast['primary_node_type'] === 'empirical_system') {
            if (preg_match('/\b(mass.energy|e\s*=\s*mc|hbar|heisenberg|uncertainty|quantum|schrodinger)\b/i', $normalized)) {
                return ['physics', 'quantum_mechanics', self::INTENT_PROOF];
            }
            if (preg_match('/\b(stoichiometry|combustion|oxidation|acid|base|ph|chemical)\b/i', $normalized)) {
                return ['chemistry', 'stoichiometry', self::INTENT_PROOF];
            }
            if (preg_match('/\b(bernoulli|ohm|kirchhoff|hooke|stress|strain|circuit)\b/i', $normalized)) {
                return ['engineering', 'electrical_engineering', self::INTENT_PROOF];
            }
            return ['science', 'natural_science', self::INTENT_PROOF];
        }

        // Fallback keyword scoring
        $bank   = DialecticalKeywordBank::get();
        $scores = [];
        foreach ($bank as $b => $terms) {
            if ($b === 'intent_verbs') continue;
            foreach ($terms as $kw) {
                if (preg_match('/\b' . preg_quote($kw, '/') . '\b/i', $normalized)) {
                    $scores[$b] = ($scores[$b] ?? 0) + 1;
                }
            }
        }

        if (!empty($scores)) {
            arsort($scores);
            $branch = array_key_first($scores);
            $map = [
                'logic'            => 'formal_logic',
                'math'             => 'trigonometry',
                'physics'          => 'newtons_second_law',
                'chemistry'        => 'stoichiometry',
                'computer_science' => 'cs_algorithms',
                'engineering'      => 'electrical_engineering',
                'biology'          => 'hardy',
                'social'           => 'social_science',
                'humanities'       => 'humanities_logic',
            ];
            return [$branch, $map[$branch] ?? null, self::INTENT_PROOF];
        }

        return ['general', null, $intent];
    }

    public function buildCorrectionHeader(array $intentResult): string
    {
        if (empty($intentResult['corrections'])) return '';
        $thesis = $intentResult['thesis'];
        $fixes  = implode(', ', array_slice($intentResult['corrections'], 0, 5));
        if (count($intentResult['corrections']) > 5) {
            $fixes .= ' (+' . (count($intentResult['corrections']) - 5) . ' more)';
        }
        return "💡 **I understood you to mean:** *\"{$thesis}\"*\n"
             . "> *(Auto-normalized: {$fixes})*\n\n"
             . "---\n\n";
    }
}
