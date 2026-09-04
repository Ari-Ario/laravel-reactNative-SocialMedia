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
                // DYNAMICALLY INJECTED CONCEPTS
                'gödel', 'incompleteness', 'löwenheim', 'skolem', 'compactness theorem', 'tarski', 'undefinability', 'church', 'turing', 'halting', 'lambda calculus', 'combinatory logic', 'curry-howard', 'intuitionistic', 'kripke', 'modal logic', 'temporal logic', 'epistemic logic', 'doxastic logic', 'deontic logic', 'fuzzy logic', 'paraconsistent logic', 'relevance logic', 'linear logic', 'boolean satisfiability', 'resolution', 'unification', 'herbrand', 'skolemization', 'prenex', 'zermelo', 'fraenkel', 'axiom of choice', 'continuum hypothesis', 'banach-tarski', 'russell\'s paradox', 'cantor\'s theorem', 'diagonal argument', 'ordinal', 'cardinal', 'transfinite', 'well-ordering', 'zorn\'s lemma', 'burali-forti', 'richard\'s paradox', 'berry paradox', 'liar paradox', 'sorites paradox', 'newcomb\'s paradox', 'prisoner\'s dilemma',

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
                // DYNAMICALLY INJECTED CONCEPTS
                'riemann hypothesis', 'poincare conjecture', 'fermat\'s last theorem', 'four color theorem', 'navier-stokes', 'p vs np', 'hodge conjecture', 'birch and swinnerton-dyer', 'yang-mills', 'abc conjecture', 'twin prime conjecture', 'goldbach\'s conjecture', 'collatz conjecture', 'catalan\'s conjecture', 'euler\'s identity', 'fundamental theorem of algebra', 'fundamental theorem of calculus', 'fundamental theorem of arithmetic', 'pythagorean theorem', 'stokes\' theorem', 'divergence theorem', 'green\'s theorem', 'cauchy\'s integral theorem', 'residue theorem', 'taylor\'s theorem', 'mean value theorem', 'intermediate value theorem', 'rolle\'s theorem', 'bolzano-weierstrass', 'heine-borel', 'picard\'s theorem', 'liouville\'s theorem', 'riemann-roch', 'atiyah-singer', 'gauss-bonnet', 'euler characteristic', 'betti number', 'homology', 'cohomology', 'homotopy', 'fundamental group', 'manifold', 'tensor', 'spinor', 'lie group', 'lie algebra', 'representation theory', 'galois theory', 'ring theory', 'field theory', 'module', 'vector space', 'hilbert space', 'banach space', 'metric space', 'topological space', 'measure theory', 'lebesgue integration', 'probability space', 'martingale', 'brownian motion', 'ito calculus', 'stochastic differential equation', 'markov chain', 'ergodic theory', 'dynamical system', 'chaos theory', 'fractal', 'mandelbrot set', 'julia set', 'cellular automaton', 'graph theory', 'eulerian path', 'hamiltonian cycle', 'traveling salesman problem', 'max-flow min-cut', 'linear programming', 'simplex method', 'duality', 'game theory', 'nash equilibrium',

                'math', 'mathematics', 'maths', 'mathematician',
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
                // DYNAMICALLY INJECTED CONCEPTS
                'newton\'s laws', 'maxwell\'s equations', 'schrödinger equation', 'dirac equation', 'klein-gordon equation', 'einstein field equations', 'lorentz transformation', 'galilean transformation', 'hamiltonian', 'lagrangian', 'action principle', 'noether\'s theorem', 'heisenberg uncertainty principle', 'pauli exclusion principle', 'fermi-dirac statistics', 'bose-einstein statistics', 'planck\'s law', 'stefan-boltzmann law', 'wien\'s displacement law', 'rayleigh-jeans law', 'bohr model', 'rutherford scattering', 'compton effect', 'photoelectric effect', 'zeeman effect', 'stark effect', 'casimir effect', 'aharonov-bohm effect', 'hall effect', 'quantum hall effect', 'superconductivity', 'meissner effect', 'bcs theory', 'josephson effect', 'superfluidity', 'standard model', 'higgs boson', 'quark', 'lepton', 'gluon', 'w and z bosons', 'neutrino', 'antimatter', 'feynman diagram', 'quantum electrodynamics', 'quantum chromodynamics', 'electroweak theory', 'grand unified theory', 'string theory', 'm-theory', 'loop quantum gravity', 'black hole', 'event horizon', 'hawking radiation', 'bekenstein-hawking entropy', 'penrose process', 'cosmic microwave background', 'hubble\'s law', 'dark matter', 'dark energy', 'inflationary epoch', 'big bang', 'relativity', 'general relativity', 'special relativity', 'time dilation', 'length contraction', 'mass-energy equivalence', 'equivalence principle', 'mach\'s principle', 'copernican principle', 'anthropic principle', 'thermodynamics', 'laws of thermodynamics', 'entropy', 'enthalpy', 'gibbs free energy', 'helmholtz free energy', 'carnot cycle', 'ideal gas law', 'van der waals equation', 'navier-stokes equations', 'bernoulli\'s principle', 'archimedes\' principle', 'pascal\'s principle', 'stokes\' law', 'poiseuille\'s law', 'reynolds number', 'froude number', 'mach number', 'prandtl number',

                'physics', 'physicist', 'physical',
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
                // Earth & Space Sciences
                'astrophysics', 'geology', 'seismology', 'vulcanology', 'climatology',
                'volcanology', 'oceanography', 'meteorology', 'astronomy', 'cosmology',
            ],

            // ── CHEMISTRY ────────────────────────────────────────────────
            'chemistry' => [
                // DYNAMICALLY INJECTED CONCEPTS
                'avogadro\'s law', 'boyle\'s law', 'charles\'s law', 'gay-lussac\'s law', 'dalton\'s law', 'graham\'s law', 'henry\'s law', 'raoult\'s law', 'le chatelier\'s principle', 'hess\'s law', 'born-haber cycle', 'nernst equation', 'arrhenius equation', 'michaelis-menten kinetics', 'eyring equation', 'schrödinger equation', 'pauli exclusion principle', 'hund\'s rule', 'aufbau principle', 'octet rule', 'vsepr theory', 'molecular orbital theory', 'valence bond theory', 'crystal field theory', 'ligand field theory', 'hard and soft acids and bases', 'brønsted-lowry', 'lewis acid and base', 'electronegativity', 'ionization energy', 'electron affinity', 'atomic radius', 'ionic radius', 'lattice energy', 'hydration energy', 'enthalpy of formation', 'entropy of vaporization', 'gibbs free energy of reaction', 'activation energy', 'catalysis', 'reaction mechanism', 'transition state', 'intermediate', 'nucleophile', 'electrophile', 'sn1 reaction', 'sn2 reaction', 'e1 reaction', 'e2 reaction', 'addition reaction', 'elimination reaction', 'substitution reaction', 'redox reaction', 'oxidation state', 'half-reaction', 'galvanic cell', 'electrolytic cell', 'faraday\'s laws of electrolysis', 'periodic table', 'alkali metal', 'alkaline earth metal', 'transition metal', 'halogen', 'noble gas', 'lanthanide', 'actinide', 'isotope', 'allotrope', 'isomer', 'stereoisomer', 'enantiomer', 'diastereomer', 'meso compound', 'chirality', 'optical activity', 'racemic mixture', 'polymer', 'monomer', 'copolymer', 'protein', 'carbohydrate', 'lipid', 'nucleic acid', 'dna', 'rna', 'enzyme', 'hormone', 'vitamin', 'alkaloid', 'terpene', 'steroid',

                'chemistry', 'chemist', 'chemical',
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
                // DYNAMICALLY INJECTED CONCEPTS
                'turing machine', 'church-turing thesis', 'halting problem', 'p vs np', 'np-complete', 'np-hard', 'time complexity', 'space complexity', 'big o notation', 'omega notation', 'theta notation', 'master theorem', 'algorithm', 'data structure', 'array', 'linked list', 'stack', 'queue', 'hash table', 'binary search tree', 'avl tree', 'red-black tree', 'b-tree', 'heap', 'graph', 'directed acyclic graph', 'spanning tree', 'kruskal\'s algorithm', 'prim\'s algorithm', 'dijkstra\'s algorithm', 'bellman-ford algorithm', 'floyd-warshall algorithm', 'a* search', 'depth-first search', 'breadth-first search', 'sorting', 'quicksort', 'mergesort', 'heapsort', 'dynamic programming', 'greedy algorithm', 'divide and conquer', 'backtracking', 'memoization', 'automata theory', 'finite state machine', 'pushdown automaton', 'regular expression', 'context-free grammar', 'chomsky hierarchy', 'compilers', 'lexical analysis', 'parsing', 'abstract syntax tree', 'semantic analysis', 'code generation', 'optimization', 'operating system', 'process', 'thread', 'concurrency', 'deadlock', 'mutex', 'semaphore', 'monitor', 'virtual memory', 'paging', 'segmentation', 'file system', 'networking', 'osi model', 'tcp/ip', 'http', 'dns', 'cryptography', 'symmetric encryption', 'asymmetric encryption', 'rsa', 'aes', 'hash function', 'sha-256', 'digital signature', 'public key infrastructure', 'blockchain', 'proof of work', 'proof of stake', 'smart contract', 'artificial intelligence', 'machine learning', 'deep learning', 'neural network', 'convolutional neural network', 'recurrent neural network', 'transformer', 'gradient descent', 'backpropagation', 'reinforcement learning', 'markov decision process',

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
                // DYNAMICALLY INJECTED CONCEPTS
                'navier-stokes equations', 'euler equations', 'bernoulli\'s principle', 'continuity equation', 'fourier\'s law', 'newton\'s law of cooling', 'stefan-boltzmann law', 'fick\'s laws of diffusion', 'hooke\'s law', 'young\'s modulus', 'shear modulus', 'bulk modulus', 'poisson\'s ratio', 'stress tensor', 'strain tensor', 'mohr\'s circle', 'yield strength', 'ultimate tensile strength', 'fatigue limit', 'fracture mechanics', 'stress intensity factor', 'j-integral', 'finite element method', 'computational fluid dynamics', 'control theory', 'pid controller', 'root locus', 'bode plot', 'nyquist stability criterion', 'state space', 'observability', 'controllability', 'kalman filter', 'signal processing', 'fourier transform', 'laplace transform', 'z-transform', 'nyquist-shannon sampling theorem', 'aliasing', 'filter design', 'fir filter', 'iir filter', 'modulation', 'amplitud modulation', 'frequency modulation', 'phase modulation', 'information theory', 'shannon capacity', 'entropy', 'error correcting code', 'hamming code', 'reed-solomon code', 'thermodynamics', 'carnot efficiency', 'rankine cycle', 'otto cycle', 'diesel cycle', 'brayton cycle', 'refrigeration cycle', 'heat exchanger', 'log mean temperature difference', 'ntu method', 'fluid mechanics', 'reynolds number', 'mach number', 'froude number', 'prandtl number', 'nusselt number', 'boundary layer', 'turbulence', 'drag coefficient', 'lift coefficient', 'aerodynamics', 'structural analysis', 'bending moment', 'shear force', 'deflection', 'euler buckling', 'truss', 'frame', 'finite element analysis', 'geotechnical engineering', 'soil mechanics', 'terzaghi\'s bearing capacity', 'consolidation', 'slope stability', 'retaining wall', 'civil engineering', 'mechanical engineering', 'electrical engineering', 'chemical engineering', 'aerospace engineering', 'industrial engineering', 'materials science', 'metallurgy', 'polymer science',

                'engineering', 'engineer', 'civil', 'mechanical', 'aerospace', 'industrial',
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
                // DYNAMICALLY INJECTED CONCEPTS
                'central dogma', 'dna replication', 'transcription', 'translation', 'genetic code', 'codon', 'anticodon', 'ribosome', 'tRNA', 'mRNA', 'rRNA', 'gene expression', 'operon', 'promoter', 'enhancer', 'silencer', 'transcription factor', 'epigenetics', 'dna methylation', 'histone modification', 'mutation', 'point mutation', 'frameshift mutation', 'chromosomal aberration', 'aneuploidy', 'polyploidy', 'meiosis', 'mitosis', 'cell cycle', 'apoptosis', 'necrosis', 'autophagy', 'signal transduction', 'g protein-coupled receptor', 'receptor tyrosine kinase', 'second messenger', 'cAMP', 'IP3', 'calcium signaling', 'kinase', 'phosphatase', 'metabolism', 'catabolism', 'anabolism', 'glycolysis', 'krebs cycle', 'citric acid cycle', 'oxidative phosphorylation', 'electron transport chain', 'atp synthase', 'photosynthesis', 'light reactions', 'calvin cycle', 'c3 carbon fixation', 'c4 carbon fixation', 'cam photosynthesis', 'enzymology', 'michaelis-menten', 'allosteric regulation', 'competitive inhibition', 'non-competitive inhibition', 'uncompetitive inhibition', 'mendelian inheritance', 'law of segregation', 'law of independent assortment', 'linkage', 'crossing over', 'recombination', 'genetic mapping', 'quantitative genetics', 'population genetics', 'hardy-weinberg equilibrium', 'genetic drift', 'gene flow', 'natural selection', 'sexual selection', 'kin selection', 'inclusive fitness', 'speciation', 'allopatric speciation', 'sympatric speciation', 'phylogenetics', 'cladistics', 'convergent evolution', 'divergent evolution', 'homology', 'analogy', 'ecology', 'ecosystem', 'biome', 'biosphere', 'population dynamics', 'carrying capacity', 'lotka-volterra equations', 'predator-prey model', 'competitive exclusion principle', 'niche', 'succession', 'primary production', 'secondary production', 'biogeochemical cycle', 'carbon cycle', 'nitrogen cycle', 'water cycle', 'phosphorus cycle', 'virology', 'epidemiology', 'sir model',

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
                // Medical & Sub-disciplines
                'virology', 'epidemiology', 'immunology', 'endocrinology',
                'neuroscience', 'botany', 'zoology', 'anatomy', 'pharmacology',
                'pharmacokinetics', 'toxicology', 'pathology', 'etiology',
            ],

            // ── SOCIAL SCIENCE ───────────────────────────────────────────
            'social' => [
                // DYNAMICALLY INJECTED CONCEPTS
                'social contract', 'state of nature', 'veil of ignorance', 'utilitarianism', 'deontology', 'virtue ethics', 'categorical imperative', 'dialectical materialism', 'historical materialism', 'base and superstructure', 'alienation', 'commodity fetishism', 'labor theory of value', 'surplus value', 'class struggle', 'hegemony', 'ideology', 'false consciousness', 'panopticon', 'biopower', 'disciplinary society', 'structuralism', 'post-structuralism', 'deconstruction', 'symbolic interactionism', 'dramaturgy', 'ethnomethodology', 'functionalism', 'conflict theory', 'social constructionism', 'critical theory', 'feminist theory', 'intersectionality', 'queer theory', 'post-colonialism', 'orientalism', 'microeconomics', 'macroeconomics', 'supply and demand', 'elasticity', 'opportunity cost', 'comparative advantage', 'marginal utility', 'indifference curve', 'general equilibrium', 'pareto efficiency', 'market failure', 'externality', 'public good', 'asymmetric information', 'moral hazard', 'adverse selection', 'game theory', 'nash equilibrium', 'prisoner\'s dilemma', 'dominant strategy', 'subgame perfect equilibrium', 'keynesian economics', 'monetarism', 'austrian school', 'neoclassical synthesis', 'is-lm model', 'phillips curve', 'solow growth model', 'endogenous growth theory', 'rational expectations', 'efficient market hypothesis', 'behavioral economics', 'prospect theory', 'loss aversion', 'cognitive bias', 'heuristics', 'bounded rationality', 'nudge theory', 'psychology', 'psychoanalysis', 'behaviorism', 'cognitive psychology', 'humanistic psychology', 'classical conditioning', 'operant conditioning', 'cognitive dissonance', 'maslow\'s hierarchy of needs', 'milgram experiment', 'stanford prison experiment', 'bystander effect', 'asch conformity experiments',

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
