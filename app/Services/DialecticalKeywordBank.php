<?php

namespace App\Services;

/**
 * DIALECTICAL KEYWORD BANK
 * OPcache-resident science terminology for all branches.
 * Loaded ONCE per Octane/Swoole worker via static memoization.
 * Zero DB queries. Zero allocations on repeat calls.
 */
final class DialecticalKeywordBank
{
    private static ?array $bank    = null;
    private static ?array $flat    = null;   // flattened for fast branch detection
    private static ?array $stopSet = null;   // O(1) stop-word lookup

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    /** Full bank keyed by branch */
    public static function get(): array
    {
        return self::$bank ??= self::build();
    }

    /** Flat array of every keyword (for Levenshtein loops) */
    public static function flat(): array
    {
        if (self::$flat !== null) return self::$flat;
        self::get(); // ensure bank is built
        $flat = [];
        foreach (self::$bank as $terms) {
            foreach ($terms as $t) $flat[] = $t;
        }
        return self::$flat = array_values(array_unique($flat));
    }

    /** O(1) stop-word check */
    public static function isStopWord(string $word): bool
    {
        return isset((self::$stopSet ??= self::buildStopSet())[$word]);
    }

    /** Return branch name for a keyword, or null */
    public static function branchOf(string $keyword): ?string
    {
        foreach (self::get() as $branch => $terms) {
            if (in_array($keyword, $terms, true)) return $branch;
        }
        return null;
    }

    /** Abbreviation expansion map (200+ entries) */
    public static function abbreviations(): array
    {
        return [
            // ── General shorthand ──────────────────────────────────────────
            'plz'   => 'please', 'pls' => 'please', 'thx' => 'thanks',
            'u'     => 'you',    'ur'  => 'your',   'r'   => 'are',
            'dat'   => 'that',   'dis' => 'this',   'iz'  => 'is',
            'wats'  => 'whats',  'wat' => 'what',   'whr' => 'where',
            'calc'  => 'calculate', 'calc:' => 'calculate:',
            'prv'   => 'prove',  'prv:' => 'prove:', 'thm' => 'theorem',
            'eq'    => 'equation', 'def' => 'definition', 'lhs' => 'left hand side',
            'rhs'   => 'right hand side', 'iff' => 'if and only if',
            'wlog'  => 'without loss of generality', 'qed' => 'end of proof',
            'st'    => 'show that', 's.t.' => 'show that',
            'n'     => 'n',  // preserve math variable
            // ── Logic ──────────────────────────────────────────────────────
            'theorm'  => 'theorem',  'thorem'  => 'theorem',  'theorim' => 'theorem',
            'therome' => 'theorem',  'theoreme' => 'theorem', 'theorim' => 'theorem',
            'prooving' => 'proving', 'proov' => 'prove',     'provv' => 'prove',
            'prrove'   => 'prove',   'proveing' => 'proving',
            'inductiv' => 'inductive',  'enductiv' => 'inductive',
            'deductiv' => 'deductive',  'deductve' => 'deductive',
            'abductiv' => 'abductive',  'syllogysm' => 'syllogism',
            'silogism' => 'syllogism',  'silogysm' => 'syllogism',
            'tautolgy' => 'tautology',  'tautolagy' => 'tautology',
            'contrdiction' => 'contradiction', 'contradicton' => 'contradiction',
            'propostion' => 'proposition', 'propositon' => 'proposition',
            'axiome'   => 'axiom',   'axim' => 'axiom',
            'lemme'    => 'lemma',   'corolary' => 'corollary',
            'hypothsis' => 'hypothesis', 'hypthesis' => 'hypothesis',
            'dialektik' => 'dialectic', 'dialektick' => 'dialectic',
            'dialectik' => 'dialectic', 'dyalektik' => 'dialectic',
            'modusponens' => 'modus ponens', 'modusponez' => 'modus ponens',
            'modtollens'  => 'modus tollens',
            // ── Mathematics ────────────────────────────────────────────────
            'pytagoren'  => 'pythagorean', 'pythagoren' => 'pythagorean',
            'pythagore'  => 'pythagorean', 'pitagorean' => 'pythagorean',
            'pythagoreon' => 'pythagorean',
            'divd'    => 'divides', 'divds' => 'divides', 'divids' => 'divides',
            'divvides' => 'divides', 'divieds' => 'divides',
            'sumation' => 'summation', 'summaton' => 'summation',
            'factorizaton' => 'factorization', 'factoriztion' => 'factorization',
            'derivtive' => 'derivative', 'derivativ' => 'derivative',
            'intgral'   => 'integral',   'intergal'  => 'integral',
            'binomeal'  => 'binomial',   'bionomial' => 'binomial',
            'matrics'   => 'matrices',   'matrx'     => 'matrix',
            'eigenvalu' => 'eigenvalue', 'eigenvektor' => 'eigenvector',
            'peeno'     => 'peano',      'pieno'     => 'peano',
            'goldbach'  => 'goldbach',   'colatz'    => 'collatz',
            'primenumber' => 'prime number', 'primorial' => 'primorial',
            'fibonaci'  => 'fibonacci',  'fibbonacci' => 'fibonacci',
            'modulo'    => 'mod',        'modulus'   => 'modulo',
            'calcultion' => 'calculation', 'calculaton' => 'calculation',
            // ── Physics ────────────────────────────────────────────────────
            'forse'       => 'force',         'fors'       => 'force',
            'acelertion'  => 'acceleration',  'aceleration' => 'acceleration',
            'accel'       => 'acceleration',  'accleration' => 'acceleration',
            'mases'       => 'mass',          'mss'        => 'mass',
            'velosity'    => 'velocity',      'velosty'    => 'velocity',
            'thermodynamcs' => 'thermodynamics', 'thermodinamics' => 'thermodynamics',
            'entropi'     => 'entropy',       'entrpy'     => 'entropy',
            'relativty'   => 'relativity',    'relativiti' => 'relativity',
            'quantm'      => 'quantum',       'quatum'     => 'quantum',
            'electromagnetc' => 'electromagnetic', 'electromagntic' => 'electromagnetic',
            'momentm'     => 'momentum',      'momemtum'   => 'momentum',
            'graviity'    => 'gravity',       'gravty'     => 'gravity',
            'photn'       => 'photon',        'protn'      => 'proton',
            'neutron'     => 'neutron',       'elektron'   => 'electron',
            'kirchhof'    => 'kirchhoff',     'kirchoff'   => 'kirchhoff',
            'boltzman'    => 'boltzmann',     'schrodinger' => 'schrodinger',
            'heisenbeg'   => 'heisenberg',    'newtons'    => 'newton',
            'lorentz'     => 'lorentz',
            // ── Chemistry ──────────────────────────────────────────────────
            'stoicheometry' => 'stoichiometry', 'stoichiometri' => 'stoichiometry',
            'stoichemistry' => 'stoichiometry', 'steochemistry' => 'stoichiometry',
            'oxydation'   => 'oxidation',     'oxidisation' => 'oxidation',
            'oxidizaton'  => 'oxidation',     'catalist'    => 'catalyst',
            'katalyst'    => 'catalyst',      'chemestry'   => 'chemistry',
            'chemsitry'   => 'chemistry',     'kinestics'   => 'kinetics',
            'kinetcs'     => 'kinetics',      'equilibrum'  => 'equilibrium',
            'equilbrium'  => 'equilibrium',   'molicule'    => 'molecule',
            'molcule'     => 'molecule',      'molocule'    => 'molecule',
            'periodik'    => 'periodic',      'periodik'    => 'periodic',
            'thermochim'  => 'thermochemistry', 'elecrolysis' => 'electrolysis',
            'electrolyis' => 'electrolysis',
            // ── Computer Science ───────────────────────────────────────────
            'algoritm'   => 'algorithm',    'algorythm'  => 'algorithm',
            'algarithm'  => 'algorithm',    'complexty'  => 'complexity',
            'komplexity' => 'complexity',   'recursoin'  => 'recursion',
            'recusion'   => 'recursion',    'turing'     => 'turing',
            'turinng'    => 'turing',       'bigo'       => 'big-o',
            'bigoh'      => 'big-o',        'p-np'       => 'p vs np',
            'pnp'        => 'p vs np',      'encrytion'  => 'encryption',
            'encription' => 'encryption',   'hashing'    => 'hash',
            'datastrutur' => 'data structure', 'datastrucutre' => 'data structure',
            'grph'        => 'graph',        'bianary'    => 'binary',
            'machinelearning' => 'machine learning', 'deeplearning' => 'deep learning',
            // ── Engineering ────────────────────────────────────────────────
            'thevenin'   => 'thevenin',     'thevanin'   => 'thevenin',
            'kirchhofs'  => 'kirchhoff',    'bernoulie'  => 'bernoulli',
            'bernoulli'  => 'bernoulli',    'hookes'     => 'hooke',
            'hookeslaw'  => 'hooke law',    'struture'   => 'structure',
            'strucure'   => 'structure',    'resonanse'  => 'resonance',
            'voltige'    => 'voltage',      'resistence' => 'resistance',
            'circit'     => 'circuit',      'circut'     => 'circuit',
            // ── Biology ────────────────────────────────────────────────────
            'evoultion'  => 'evolution',    'evoluton'   => 'evolution',
            'darwinian'  => 'darwin',       'gentics'    => 'genetics',
            'genetiks'   => 'genetics',     'dna'        => 'dna',
            'rna'        => 'rna',          'proteien'   => 'protein',
            'protiein'   => 'protein',      'osmossis'   => 'osmosis',
            'fotosynthesis' => 'photosynthesis', 'fotsynthesis' => 'photosynthesis',
            'mitossis'   => 'mitosis',      'meiossis'   => 'meiosis',
            'hardyweinberg' => 'hardy weinberg', 'hardiveinberg' => 'hardy weinberg',
            // ── Social Science ─────────────────────────────────────────────
            'sociolgy'   => 'sociology',    'soicology'  => 'sociology',
            'econimics'  => 'economics',    'economcs'   => 'economics',
            'psycology'  => 'psychology',   'psichology' => 'psychology',
            'nashequilbrium' => 'nash equilibrium', 'nasheqilibrium' => 'nash equilibrium',
            'gametheory' => 'game theory',  'gamethory'  => 'game theory',
            'behaviur'   => 'behavior',     'behavoir'   => 'behavior',
            'groop'      => 'group',        'grup'       => 'group',
            'groupz'     => 'groups',       'grupz'      => 'groups',
            'strugle'    => 'struggle',     'stuggle'    => 'struggle',
            'struggl'    => 'struggle',     'strugl'     => 'struggle',
            'dialektical' => 'dialectical', 'dialectikl' => 'dialectical',
            // ── Biology z-suffix slang ─────────────────────────────────────
            'selecton'   => 'selection',    'selectoin'  => 'selection',
            'adaptaton'  => 'adaptation',   'mutaton'    => 'mutation',
            'replicaton' => 'replication',  'transcrpton' => 'transcription',
            'evoloution' => 'evolution',    'evolusion'  => 'evolution',
            // ── CS z-suffix / common slang ────────────────────────────────
            'algoz'      => 'algorithms',   'algortihm'  => 'algorithm',
            'complxity'  => 'complexity',   'complexety' => 'complexity',
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE BUILDERS
    // ─────────────────────────────────────────────────────────────────────────

    private static function build(): array
    {
        return [
            // ── INTENT VERBS (cross-branch) ──────────────────────────────
            'intent_verbs' => [
                'prove', 'proof', 'show', 'demonstrate', 'derive', 'deduce',
                'verify', 'validate', 'establish', 'calculate', 'compute',
                'evaluate', 'solve', 'theorem', 'explain', 'describe',
                'what is', 'define', 'inductive proof', 'show that',
            ],

            // ── LOGIC ────────────────────────────────────────────────────
            'logic' => [
                // Proof methods
                'modus ponens', 'modus tollens', 'contraposition', 'contrapositive',
                'syllogism', 'disjunctive syllogism', 'hypothetical syllogism',
                'reductio ad absurdum', 'proof by contradiction', 'proof by induction',
                'direct proof', 'indirect proof', 'biconditional', 'tautology',
                // Operators & connectives
                'conjunction', 'disjunction', 'negation', 'implication',
                'logical equivalence', 'material conditional', 'exclusive or',
                'universal quantifier', 'existential quantifier', 'predicate',
                'propositional calculus', 'first order logic', 'second order logic',
                'boolean algebra', 'de morgan', 'truth table',
                // Structural terms
                'axiom', 'theorem', 'lemma', 'corollary', 'postulate',
                'hypothesis', 'proposition', 'premise', 'conclusion', 'inference',
                'deductive', 'inductive', 'abductive', 'formal logic',
                'incompleteness', 'consistency', 'consistent', 'formal systems',
                'computability', 'undecidability',
                // Dialectical
                'dialectic', 'dialectical', 'dialectics', 'dialectical methodology',
                'antithesis', 'synthesis', 'thesis', 'socratic', 'hegelian',
                'contradiction', 'negation of negation', 'unity of opposites',
                'groups struggle', 'class struggle', 'trial and error',
            ],

            // ── MATHEMATICS ──────────────────────────────────────────────
            'math' => [
                // Trigonometry & Calculus
                'sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'asin', 'acos', 'atan',
                'trigonometry', 'trigonometric', 'pythagorean identity',
                'ln', 'log', 'exp', 'sqrt', 'lim', 'limit', 'derivative', 'integral',
                'calculus', 'analysis', 'transcendental',
                // Number theory
                'peano', 'natural numbers', 'integer', 'rational', 'irrational',
                'real numbers', 'complex numbers', 'prime', 'composite',
                'divisibility', 'divisible', 'divides', 'modulo', 'modular arithmetic',
                'goldbach conjecture', 'collatz conjecture', 'twin primes',
                'riemann hypothesis', 'fermat', 'euler', 'gauss', 'fibonacci',
                // Algebra
                'pythagorean', 'binomial theorem', 'polynomial', 'factorization',
                'quadratic', 'linear equation', 'matrix', 'determinant',
                'eigenvalue', 'eigenvector', 'vector space', 'linear algebra',
                'group theory', 'ring theory', 'field theory', 'abstract algebra',
                'commutative', 'associative', 'distributive', 'identity element',
                'groups', 'group', 'fields', 'field', 'rings', 'ring', 'isomorphism', 
                'isomorphisms', 'isomorphic', 'homomorphism', 'homomorphisms', 
                'homomorphic', 'automorphism',
                // Calculus & Analysis
                'derivative', 'integral', 'limit', 'continuity', 'differentiable',
                'chain rule', 'product rule', 'fundamental theorem of calculus',
                'epsilon delta', 'convergence', 'divergence', 'series', 'sequence',
                'taylor series', 'fourier series', 'laplace transform',
                'differential equation', 'partial derivative', 'gradient',
                // Geometry & Topology
                'euclidean geometry', 'non euclidean', 'hyperbolic geometry',
                'pythagorean theorem', 'triangle inequality', 'congruence',
                'similarity', 'isomorphism', 'homeomorphism', 'topology',
                'manifold', 'manifolds', 'homeomorphism', 'homeomorphic', 'homotopy', 
                'spheres', 'sphere', 'simply-connected', 'compact', 'connected', 
                '3-manifold', '3-sphere', 'topological',
                'planar', 'map', 'color', 'colors', 'four', 'trisect', 'trisection', 
                'straightedge', 'compass', 'angle', 'angles', 'geometry', 'geometric',
                // Combinatorics & Probability
                'permutation', 'combination', 'factorial', 'binomial coefficient',
                'probability', 'expectation', 'variance', 'normal distribution',
                'bayes theorem', 'central limit theorem', 'law of large numbers',
                'summation', 'mathematical induction', 'strong induction',
                'well ordering principle', 'pigeonhole principle',
                'cardinality', 'continuum', 'set', 'sets',
                // Algebra ops
                'square root', 'cube root', 'exponent', 'logarithm',
                'absolute value', 'floor', 'ceiling', 'infinity',
            ],

            // ── PHYSICS ──────────────────────────────────────────────────
            'physics' => [
                // Classical mechanics
                'force', 'mass', 'acceleration', 'velocity', 'momentum',
                'kinetic energy', 'potential energy', 'work', 'power',
                'newton', 'newton law', 'gravity', 'gravitational', 'inertia',
                'torque', 'angular momentum', 'centripetal', 'centrifugal',
                'friction', 'tension', 'spring', 'hooke law', 'elastic',
                // Thermodynamics
                'thermodynamics', 'entropy', 'enthalpy', 'gibbs free energy',
                'boltzmann', 'heat', 'temperature', 'pressure', 'volume',
                'ideal gas', 'carnot', 'heat engine', 'second law',
                'third law', 'zeroth law', 'stefan boltzmann',
                // Electromagnetism
                'electric field', 'magnetic field', 'electromagnetic',
                'faraday', 'maxwell', 'lorentz', 'coulomb', 'ohm',
                'kirchhoff', 'voltage', 'current', 'resistance', 'capacitance',
                'inductance', 'photon', 'wave', 'frequency', 'wavelength',
                'speed of light', 'electromagnetic spectrum', 'radiation',
                // Relativity & Quantum
                'relativity', 'general relativity', 'special relativity',
                'lorentz factor', 'time dilation', 'length contraction',
                'mass energy equivalence', 'e equals mc squared',
                'quantum', 'quantum mechanics', 'heisenberg', 'schrodinger',
                'wave function', 'superposition', 'entanglement', 'spin',
                'planck', 'bohr', 'photoelectric effect', 'uncertainty principle',
                // Optics & Waves
                'refraction', 'reflection', 'diffraction', 'interference',
                'snell law', 'refractive index', 'lens', 'mirror',
                // Nuclear
                'nuclear', 'radioactive', 'half life', 'fission', 'fusion',
                'alpha decay', 'beta decay', 'gamma ray', 'neutrino',
            ],

            // ── CHEMISTRY ────────────────────────────────────────────────
            'chemistry' => [
                // Fundamentals
                'element', 'compound', 'mixture', 'atom', 'molecule', 'ion',
                'electron', 'proton', 'neutron', 'atomic number', 'mass number',
                'periodic table', 'periodic law', 'mole', 'avogadro',
                'molarity', 'molality', 'molar mass', 'stoichiometry',
                // Bonds & Structure
                'covalent bond', 'ionic bond', 'metallic bond', 'hydrogen bond',
                'electronegativity', 'polarity', 'hybridization', 'orbital',
                'valence', 'lewis structure', 'vsepr', 'molecular geometry',
                // Reactions
                'chemical reaction', 'combustion', 'oxidation', 'reduction',
                'oxidation state', 'redox', 'acid', 'base', 'ph', 'neutralization',
                'catalyst', 'activation energy', 'reaction rate', 'kinetics',
                'equilibrium', 'le chatelier', 'solubility', 'precipitation',
                // Thermochemistry
                'enthalpy', 'hess law', 'calorimetry', 'heat of reaction',
                'bond energy', 'lattice energy', 'electron affinity',
                // Electrochemistry
                'electrolysis', 'galvanic cell', 'electrode', 'anode', 'cathode',
                'faraday constant', 'nernst equation', 'standard potential',
                // Organic & Advanced
                'organic chemistry', 'functional group', 'isomer', 'polymer',
                'chirality', 'stereochemistry', 'nmr', 'spectroscopy',
                'thermodynamics', 'entropy', 'gibbs energy',
            ],

            // ── COMPUTER SCIENCE ─────────────────────────────────────────
            'computer_science' => [
                // Algorithms & Complexity
                'algorithm', 'complexity', 'big-o', 'time complexity',
                'space complexity', 'p vs np', 'np complete', 'np hard',
                'polynomial time', 'exponential time', 'decidable', 'undecidable',
                'halting problem', 'church turing thesis', 'turing machine',
                'rice theorem', 'cook levin', 'reduction',
                // Data Structures
                'data structure', 'array', 'linked list', 'stack', 'queue',
                'tree', 'binary tree', 'heap', 'graph', 'hash table',
                'binary search', 'sorting', 'mergesort', 'quicksort',
                'dynamic programming', 'greedy algorithm', 'recursion',
                'divide and conquer', 'backtracking', 'memoization',
                // Theory
                'automata', 'formal language', 'grammar', 'chomsky hierarchy',
                'regular expression', 'context free', 'pushdown automaton',
                'computability', 'kolmogorov complexity',
                // Systems & Networks
                'encryption', 'hash', 'cryptography', 'rsa', 'aes', 'sha',
                'diffie hellman', 'public key', 'digital signature',
                'shannon entropy', 'information theory', 'channel capacity',
                'networking', 'tcp', 'ip', 'protocol', 'bandwidth',
                // AI & ML
                'machine learning', 'neural network', 'deep learning',
                'gradient descent', 'backpropagation', 'loss function',
                'overfitting', 'bias variance', 'decision tree', 'random forest',
                'support vector machine', 'naive bayes', 'clustering',
                'natural language processing', 'computer vision',
            ],

            // ── ENGINEERING ──────────────────────────────────────────────
            'engineering' => [
                // Electrical
                'kirchhoff', 'thevenin', 'norton', 'superposition theorem',
                'maximum power transfer', 'ohm law', 'voltage divider',
                'current divider', 'resonance', 'impedance', 'admittance',
                'laplace transform', 'transfer function', 'bode plot',
                'operational amplifier', 'transistor', 'diode', 'mosfet',
                // Civil & Structural
                'hooke law', 'stress', 'strain', 'young modulus',
                'shear stress', 'bending moment', 'euler buckling',
                'bernoulli euler', 'mohr circle', 'virtual work',
                'structural analysis', 'truss', 'beam', 'column', 'foundation',
                // Fluid & Thermal
                'bernoulli equation', 'darcy weisbach', 'reynolds number',
                'navier stokes', 'continuity equation', 'fluid mechanics',
                'heat transfer', 'conduction', 'convection', 'radiation',
                'fourier law', 'newton cooling', 'stefan boltzmann',
                // Materials
                'stress strain', 'yield strength', 'ultimate strength',
                'fatigue', 'creep', 'fracture mechanics', 'thermal expansion',
                'poisson ratio', 'material properties',
                // Signals
                'fourier transform', 'nyquist', 'sampling theorem',
                'digital signal processing', 'filter', 'feedback control',
                'pid controller', 'stability', 'eigenvalue', 'poles zeros',
            ],

            // ── BIOLOGY ──────────────────────────────────────────────────
            'biology' => [
                // Cell & Molecular
                'cell', 'nucleus', 'dna', 'rna', 'protein', 'gene',
                'chromosome', 'mutation', 'transcription', 'translation',
                'replication', 'mitosis', 'meiosis', 'cell cycle', 'apoptosis',
                'enzyme', 'substrate', 'atp', 'respiration', 'photosynthesis',
                // Genetics
                'genetics', 'genotype', 'phenotype', 'allele', 'dominant',
                'recessive', 'mendelian', 'hardy weinberg', 'genetic drift',
                'natural selection', 'mutation', 'gene flow', 'speciation',
                // Evolution
                'evolution', 'darwin', 'natural selection', 'adaptation',
                'fitness', 'phylogeny', 'cladogram', 'common ancestor',
                // Ecology
                'ecosystem', 'food chain', 'food web', 'trophic level',
                'biomass', 'biodiversity', 'symbiosis', 'predation',
                'population dynamics', 'carrying capacity', 'logistic growth',
                // Physiology
                'homeostasis', 'osmosis', 'diffusion', 'membrane potential',
                'action potential', 'neurotransmitter', 'hormone',
                'immune system', 'antibody', 'antigen',
            ],

            // ── SOCIAL SCIENCE ───────────────────────────────────────────
            'social' => [
                // Sociology & Philosophy
                'sociology', 'social', 'society', 'culture', 'norms', 'values',
                'institution', 'stratification', 'class', 'power', 'authority',
                'dialectic of groups struggle', 'groups struggle', 'class struggle',
                'historical materialism', 'hegelian dialectic', 'marxist',
                'ideology', 'superstructure', 'base structure', 'false consciousness',
                // Economics
                'economics', 'supply', 'demand', 'equilibrium', 'market',
                'price', 'inflation', 'gdp', 'utility', 'marginal',
                'game theory', 'nash equilibrium', 'prisoner dilemma',
                'pareto efficiency', 'externality', 'public good', 'monopoly',
                // Psychology
                'psychology', 'behavior', 'cognition', 'motivation', 'emotion',
                'learning', 'memory', 'perception', 'consciousness',
                'pavlov', 'skinner', 'freud', 'piaget', 'maslow',
                // Political Science
                'governance', 'democracy', 'state', 'sovereignty', 'rights',
                'justice', 'equality', 'freedom', 'revolution', 'reform',
                // Anthropology
                'culture', 'civilization', 'myth', 'ritual', 'kinship',
                'ethnography', 'fieldwork', 'social structure',
            ],

            // ── APP SUPPORT & PLATFORM ───────────────────────────────────
            'app_support' => [
                'space', 'spaces', 'collab', 'whiteboard', 'meeting room', 'voice channel',
                'post', 'posts', 'feed', 'repost', 'caption', 'trending',
                'account', 'profile', 'login', 'signup', 'register', 'password', 'email verify',
                'payment', 'billing', 'subscription', 'refund', 'charge', 'paypal', 'stripe', 'invoice',
                'bug', 'error', 'crash', 'not working', 'broken', 'issue', 'slow', 'lag', 'freeze',
                'feature', 'add', 'missing', 'wish', 'request', 'idea', 'suggestion',
                'mobile', 'app', 'android', 'ios', 'iphone', 'play store', 'app store',
                'notification', 'alert', 'bell', 'push', 'reminder',
                'privacy', 'data', 'delete account', 'gdpr', 'personal info', 'vault', 'secret', 'visibility',
                'settings', 'preferences', 'options', 'customize', 'configuration', 'setup', 'theme',
                'troubleshoot', 'fix', 'resolve', 'solution', 'workaround',
                'poll', 'polls', 'survey', 'vote',
                'story', 'stories', 'segment', 'segments', 'ephemeral',
                'activity', 'activities', 'event', 'events', 'schedule',
                'safety', 'trust', 'reputation', 'score', 'standing',
                'sync', 'synergy', 'skill', 'matching', 'cursor', 'screen',
                'step', 'steps', 'guide', 'how to use', 'tutorial'
            ],

            // ── UI DESIGN & ENGINEERING ──────────────────────────────────
            'ui_design' => [
                'layer', 'layering', 'stacking', 'z-index', 'width', 'desktop', 'web',
                'overlay', 'modal', 'popup', 'backdrop', 'responsive', 'blackmodus',
                'portal', 'root', 'mediaviewer'
            ],
            
            // ── GENERAL KNOWLEDGE & ARTS ─────────────────────────────────
            'humanities' => [
                'film', 'movie', 'cinema', 'streaming', 'hollywood', 'bollywood',
                'sci-fi', 'science fiction', 'theater', 'play', 'stage', 'acting', 'drama',
                'storytelling', 'narrative', 'director', 'filmmaker', 'documentary',
                'animation', 'anime', 'vfx', 'cgi', 'cinematography',
                'history', 'literature', 'art', 'photography', 'music',
                'health', 'medicine', 'fitness', 'wellness', 'nutrition',
                'business', 'crypto', 'investing', 'real estate', 'tax',
                'education', 'language', 'teaching', 'localization', 'dialect',
                'travel', 'food', 'gaming', 'fashion', 'sports', 'environment'
            ]
        ];
    }

    private static function buildStopSet(): array
    {
        return array_flip([
            'a', 'an', 'the', 'is', 'it', 'in', 'on', 'at', 'to', 'of',
            'for', 'and', 'or', 'but', 'not', 'be', 'by', 'as', 'up',
            'do', 'if', 'so', 'we', 'my', 'me', 'he', 'she', 'they',
            'this', 'that', 'with', 'from', 'into', 'then', 'than',
            'can', 'will', 'just', 'has', 'had', 'was', 'were', 'are',
            'which', 'who', 'how', 'why', 'when', 'about', 'also', 'its',
            'any', 'all', 'each', 'both', 'very', 'more', 'most', 'some',
        ]);
    }
}
