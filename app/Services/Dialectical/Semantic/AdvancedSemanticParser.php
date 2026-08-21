<?php

namespace App\Services\Dialectical\Semantic;

use Phpml\Tokenization\Tokenizer;

class AdvancedSemanticParser implements Tokenizer
{
    /**
     * Stop words to filter out.
     */
    private array $stopwords = [
        'the', 'is', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'that', 'this', 
        'for', 'with', 'on', 'by', 'at', 'from', 'it', 'its', 'their', 'every', 'any'
    ];

    /**
     * Tokenize text with advanced scientific stemming and relation extraction.
     */
    public function tokenize(string $text): array
    {
        $text = strtolower($text);
        
        // 1. Structural Pseudotoken Extraction
        $tokens = $this->extractStructuralPseudoTokens($text);
        
        // 2. Word Stemming & Lemmatization
        preg_match_all('/[a-z0-9_]+/', $text, $matches);
        $words = [];
        
        foreach ($matches[0] as $word) {
            if (strlen($word) > 1 && !in_array($word, $this->stopwords)) {
                $stemmed = $this->stemScientificTerm($word);
                $words[] = $stemmed;
                $tokens[] = $stemmed;
            }
            // Preserve common single-letter variables
            if (strlen($word) === 1 && in_array($word, ['n', 'k', 'x', 'y', 'z', 'p', 'q', 'a', 'b', 'c'])) {
                $tokens[] = '_VAR_' . strtoupper($word);
            }
        }

        // 3. Syntactic Relation Tuples Extraction
        $relations = $this->extractRelations($text, $words);
        $tokens = array_merge($tokens, $relations);

        // 4. Conceptual Bigrams
        $bigrams = [];
        $wordCount = count($words);
        for ($i = 0; $i < $wordCount - 1; $i++) {
            $bigrams[] = $words[$i] . '_' . $words[$i+1];
        }

        return array_unique(array_merge($tokens, $bigrams));
    }

    /**
     * Apply morphological rules to stem words to their scientific root form.
     */
    private function stemScientificTerm(string $word): string
    {
        // Plural removal
        if (str_ends_with($word, 'ies') && strlen($word) > 4) {
            $word = substr($word, 0, -3) . 'y';
        } elseif (str_ends_with($word, 's') && !str_ends_with($word, 'ss') && strlen($word) > 2) {
            $word = substr($word, 0, -1);
        }

        // Science and mathematical word family lemmatization
        $rules = [
            // Fragment 2: Metaphysics & Ontology
            '/identity|identical/' => 'ident',
            '/contradiction|contradictory|contradict/' => 'contradict',
            '/metaphysics|metaphysical/' => 'metaphys',
            '/ontology|ontological|ontologies/' => 'ontolog',
            '/substantialism|substantivalism|relationalism/' => 'spacetime_substance',
            '/nominalism|realism|conceptualism/' => 'universal_realism',
            '/hylomorphism|hylomorphic/' => 'hylomorph',
            '/essentialism|essential/' => 'essenti',
            '/physicalism|physicalist|monism|monist/' => 'monism',
            '/haecceity|haecceities/' => 'haecce',
            '/intentionality|intentional/' => 'intent',
            '/presentism|eternalism/' => 'time_exist',
            '/mereology|mereological/' => 'mereolog',
            '/supplementation|supplemented/' => 'supplement',

            // Fragment 3 & 4: Formal Logic, Non-Classical, Set Theory
            '/proposition|propositional|propositions/' => 'proposit',
            '/isomorphism|isomorphic|isomorphisms/' => 'isomorph',
            '/homeomorphism|homeomorphic|homeomorphisms/' => 'homeomorph',
            '/homomorphism|homomorphic|homomorphisms/' => 'homomorph',
            '/automorphism|automorphic|automorphisms/' => 'automorph',
            '/cardinality|cardinal|cardinals/' => 'cardinal',
            '/polynomial|polynomials/' => 'polynomi',
            '/topology|topological|topologies/' => 'topolog',
            '/geometry|geometric|geometries/' => 'geometri',
            '/continuity|continuous|continuum/' => 'continu',
            '/completeness|complete|incompleteness|incomplete/' => 'complet',
            '/consistency|consistent|inconsistency|inconsistent/' => 'consist',
            '/divisibility|divisible|divides/' => 'divid',
            '/deontic|obligation|permissible|forbidden/' => 'deontic',
            '/epistemic|epistemology|epistemological|justification/' => 'epistem',
            '/doxastic|belief|beliefs/' => 'doxastic',
            '/syllogism|syllogisms|syllogistic/' => 'syllog',
            '/quantification|quantifier|quantifiers/' => 'quantifi',
            '/satisfiability|satisfiable|satisfies/' => 'satisfi',
            '/undecidability|undecidable/' => 'undecid',
            '/computability|computable|computer|computing/' => 'comput',
            '/recursiveness|recursive|recursion|recurse/' => 'recurs',
            '/induction|inductive|induct/' => 'induct',
            '/deduction|deductive|deduct/' => 'deduct',
            '/abduction|abductive|abduct/' => 'abduct',
            '/paraconsistent|paraconsistency/' => 'paraconsist',
            '/intuitionistic|intuitionism/' => 'intuition',
            '/dialethism|dialetheic/' => 'dialeth',
            '/temporal|temporality/' => 'tempor',
            '/extensionality|extensional/' => 'extension',
            '/regularity|foundation/' => 'regular',
            '/category|categorical|categories/' => 'categor',
            '/functor|functorial|functors/' => 'functor',
            '/adjoint|adjunction|adjoints/' => 'adjoint',
            '/monad|monads|monadic/' => 'monad',
            '/sequent|sequents/' => 'sequent',
            '/hauptsatz|cut_elimination/' => 'hauptsatz',
            '/falsification|falsifiable|falsify/' => 'falsifi',
            '/bayesian|bayes|probabilistic/' => 'bayes',
            
            // Fragment 10-11: Physics
            '/thermodynamics|thermodynamic|thermo/' => 'thermo',
            '/relativity|relativistic/' => 'relativ',
            '/electromagnetism|electromagnetic/' => 'electromagnet',
            '/collision|collisions|collider/' => 'collid',
            '/mechanics|mechanical/' => 'mechan',
            '/quantum|quantization/' => 'quantum',
            '/optics|optical/' => 'optics',
            '/acoustics|acoustic/' => 'acoustics',
            '/fluid|fluids|hydrodynamics/' => 'fluid',
            '/astrophysics|astrophysical|astronomy/' => 'astrophys',
            '/particle|particles/' => 'particle',
            
            // Fragment 12-13: Chemistry
            '/stoichiometry|stoichiometric/' => 'stoichiometri',
            '/polymerization|polymer|polymers/' => 'polymer',
            '/inorganic/' => 'inorganic',
            '/organic/' => 'organic',
            '/chemical|chemistry|chemist/' => 'chem',
            '/electrochemistry|electrochemical/' => 'electrochem',
            '/analytical/' => 'analytical',
            '/biochemistry|biochemical/' => 'biochem',
            
            // Fragment 14-17: Biology, Medicine, Earth Sciences
            '/cellular|cells|cell/' => 'cell',
            '/molecular|molecule|molecules/' => 'molecul',
            '/evolutionary|evolution|evolve/' => 'evolut',
            '/genetics|genetic|gene|genes/' => 'genet',
            '/microbiology|microbiological/' => 'microbiolog',
            '/neuroscience|neuroscientific|neurons|neuron/' => 'neuron',
            '/epidemiology|epidemiological/' => 'epidemiolog',
            '/physiology|physiological/' => 'physiolog',
            '/pharmacology|pharmacological|pharmaceutical/' => 'pharmacol',
            '/pathology|pathological/' => 'patholog',
            '/surgery|surgical/' => 'surg',
            '/geology|geological/' => 'geolog',
            '/meteorology|meteorological/' => 'meteorolog',
            '/oceanography|oceanographic/' => 'oceanograph',
            '/seismology|seismological/' => 'seismolog',
            
            // Fragment 18-20: Game Theory, CS, Engineering
            '/cryptography|cryptographic|crypto/' => 'crypto',
            '/algorithm|algorithmic|algorithms/' => 'algorithm',
            '/intelligence|intelligent/' => 'intellig',
            '/decentralization|decentralized|consensus/' => 'consensus',
            '/blockchain|blockchains/' => 'blockchain',
            '/software|program|programming|programs/' => 'softwar',
            '/aerospace|aeronautics/' => 'aerospac',
            '/electrical|electricity/' => 'electric',
            '/civil/' => 'civil',
            '/materials|material/' => 'materi',
            
            // Fragment 21-23: Social Sciences, Humanities, Speculative
            '/economics|economical|economy/' => 'econom',
            '/sociology|sociological/' => 'sociolog',
            '/political|politics/' => 'polit',
            '/linguistics|linguistic/' => 'linguist',
            '/aesthetics|aesthetic/' => 'aesthet',
            '/ethics|ethical/' => 'ethic',
            '/transhumanism|transhumanist|posthuman/' => 'transhuman',
            '/simulation|simulated/' => 'simul',
            '/xenology|xenological/' => 'xenolog',
            '/omega_point|omega/' => 'omega'
        ];

        foreach ($rules as $pattern => $replacement) {
            if (preg_match($pattern, $word)) {
                return $replacement;
            }
        }

        return $word;
    }

    /**
     * Extract key semantic relation tuples to maintain syntactic order.
     */
    private function extractRelations(string $text, array $words): array
    {
        $relations = [];
        
        // Match conditional patterns (if ... then)
        if (preg_match('/\bif\b.*\bthen\b/i', $text)) {
            $relations[] = '_SYN_CONDITIONAL_';
        }

        // Match negation patterns
        if (preg_match('/\b(no|not|never|impossible|cannot|neither|nor)\b/i', $text)) {
            $relations[] = '_SYN_NEGATION_';
        }

        // Map subject-predicate-object semantic relation frames
        $relationFrames = [
            'isomorphic' => ['is', 'isomorphic', 'to'],
            'homeomorphic' => ['is', 'homeomorphic', 'to'],
            'implies' => ['implies', 'imply'],
            'divides' => ['divides', 'divide'],
            'contains' => ['contains', 'contain'],
            'colored' => ['colored', 'color'],
            'solved' => ['solved', 'solve', 'solves'],
            'converges' => ['converges', 'converge', 'convergence'],
            'causes' => ['causes', 'cause', 'causing'],
            'governs' => ['governs', 'govern', 'governing'],
            'transforms' => ['transforms', 'transform', 'transforming'],
            'contradicts' => ['contradicts', 'contradict', 'contradicting'],
            'limits' => ['limits', 'limit', 'limiting'],
            'scales' => ['scales', 'scale', 'scaling']
        ];

        foreach ($relationFrames as $key => $verbs) {
            foreach ($verbs as $verb) {
                if (str_contains($text, $verb)) {
                    // Extract surrounding words (simple window) to build syntactic tuples
                    $verbPos = array_search($verb, $words);
                    if ($verbPos !== false) {
                        $left = $words[$verbPos - 1] ?? '_null_';
                        $right = $words[$verbPos + 1] ?? '_null_';
                        $relations[] = "rel_{$left}_{$key}_{$right}";
                    }
                }
            }
        }

        return $relations;
    }

    /**
     * Extract crucial mathematical and logical structural symbols as pseudo-tokens.
     */
    private function extractStructuralPseudoTokens(string $text): array
    {
        $tokens = [];
        if (str_contains($text, '=')) $tokens[] = '_MATH_EQUALITY_';
        if (str_contains($text, '+')) $tokens[] = '_MATH_ADDITION_';
        if (str_contains($text, '-')) $tokens[] = '_MATH_SUBTRACTION_';
        if (str_contains($text, '*')) $tokens[] = '_MATH_MULTIPLICATION_';
        if (str_contains($text, '/')) $tokens[] = '_MATH_DIVISION_';
        if (str_contains($text, '^')) $tokens[] = '_MATH_EXPONENT_';
        if (str_contains($text, 'forall') || str_contains($text, '∀')) $tokens[] = '_LOGIC_FORALL_';
        if (str_contains($text, 'exists') || str_contains($text, '∃')) $tokens[] = '_LOGIC_EXISTS_';
        if (str_contains($text, 'implies') || str_contains($text, '⇒') || str_contains($text, '->')) $tokens[] = '_LOGIC_IMPLIES_';
        return $tokens;
    }
}
