<?php

namespace App\Services\Dialectical;

use App\Services\Dialectical\Solvers\DialecticalSolverInterface;
use App\Services\Dialectical\Solvers\BooleanLogicSolver;
use App\Services\Dialectical\Solvers\AlgebraicSummationSolver;
use App\Services\Dialectical\Solvers\SetTheorySolver;
use App\Services\Dialectical\Solvers\ParadoxSolver;
use App\Services\Dialectical\Solvers\FormalLogicSolver;
use App\Services\Dialectical\Solvers\NumberTheorySolver;
use App\Services\Dialectical\Solvers\MathematicalAnalysisSolver;
use App\Services\Dialectical\Solvers\ComplexDomainSolver;
use App\Services\Dialectical\Solvers\NaturalScienceSolver;
use App\Services\Dialectical\Solvers\StatisticalScienceSolver;
use App\Services\Dialectical\Solvers\ComputationalLogicSolver;
use App\Services\Dialectical\Solvers\EngineeringScienceSolver;
use App\Services\Dialectical\Solvers\SocialScienceSolver;
use App\Services\Dialectical\Solvers\HumanitiesDialecticsSolver;
use App\Services\Dialectical\Solvers\PostHumanSpeculativeSolver;
use App\Services\Dialectical\Solvers\QuantumMechanicsSolver;
use App\Services\Dialectical\Solvers\AbstractMetaphysicalSolver;
use App\Services\Dialectical\Solvers\ProvenTheoremStrategyResolver;
use App\Services\Dialectical\Solvers\EmpiricalScienceSolver;
use App\Services\Dialectical\Semantic\SemanticRouterService;
use App\Services\SymbolicMathSolverService;

class UniversalRouterService
{
    private DynamicSyntaxGenerator $syntax;
    private SymbolicMathSolverService $cas;
    private SemanticRouterService $semantic;
    private \App\Services\DialecticalOracleService $oracle;

    public function __construct(DynamicSyntaxGenerator $syntax, SymbolicMathSolverService $cas)
    {
        $this->syntax = $syntax;
        $this->cas = $cas;
        $this->semantic = new SemanticRouterService();
        $this->oracle = new \App\Services\DialecticalOracleService();
    }

    /**
     * Determines the domain of the thesis and returns the appropriate Solver.
     * Routing is performed in a strictly-ordered, layered priority system.
     * Each layer is a set of structural/semantic guards that MUST fire before
     * any broader domain classification to prevent token bleeding.
     *
     * LAYER ORDER:
     *  0   – AST-based structural routing
     *  1   – Paradox Priority Guard (before Boolean, before Science)
     *  2   – Formal Proof Theory Guard (modus ponens, incompleteness)
     *  3   – Boolean Logic Guard (truth table, boolean expression, XOR, De Morgan)
     *  4   – Quantum Mechanics Guard (Schrödinger, Heisenberg, Pauli, Bell)
     *  5   – Statistical Science Guard (Bayes, CLT, z-score, entropy)
     *  6   – Set Theory Guard (Cantor, ZFC, Aleph, Zorn)
     *  7   – Computational Logic Guard (Halting, P vs NP, RSA, Turing complexity)
     *  8   – Social Science Guard (Nash, Pareto, Gini, Prisoner's Dilemma)
     *  9   – Engineering Science Guard (Reynolds, yield stress, bending moment)
     *  10  – Speculative / Post-Human Guard (Kardashev, Omega Point, holographic)
     *  11  – Algebraic Summation Guard (sum of n=1 to 100, sum_{k=1}^{n})
     *  12  – Complex Domain Guard (Euler identity, imaginary, complex plane, Lambert W)
     *  13  – Number Theory Guard (prime, GCD, perfect number, Fermat, Goldbach)
     *  14  – Humanities Priority Guard (Hegel, Rawls, Searle, Wittgenstein)
     *  15  – Mathematical Analysis Guard (sin, ln, exp, epsilon-delta, derivative)
     *  16  – Natural Science Guard — broad physics/chem/biology fallback
     *  17  – Formal Logic Structural Patterns (syllogisms, implies-therefore)
     *  18  – Oracle / ML Semantic Fallback
     *  19  – PHP-ML Semantic Fallback
     *  20  – Ultimate math/logic fallback
     *
     * @param string $thesis
     * @param string|null $knownDomain
     * @param array|null $astMatrix
     * @return DialecticalSolverInterface|null
     */
    public function routeThesis(string $thesis, ?string $knownDomain = null, ?array $astMatrix = null): ?DialecticalSolverInterface
    {
        $thesis = \App\Services\Dialectical\Semantic\LaTeXMathNormalizer::normalize($thesis);
        $thesis = strtolower($thesis);

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 0 – AST-Based Dynamic Routing
        // ═══════════════════════════════════════════════════════════════════
        if ($astMatrix !== null && !empty($astMatrix['primary_node_type'])) {
            if ($astMatrix['primary_node_type'] === 'categorical_syllogism') {
                return new FormalLogicSolver($this->syntax);
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 1 – Paradox Priority Guard
        // Must fire before Boolean (liar paradox contains "true/false")
        // and before Science (Gettier contains "justified true belief" /
        // epistemic "problem").
        // ═══════════════════════════════════════════════════════════════════
        if (
            preg_match(
                '/this sentence is (true|false)'
                . '|heterological'
                . '|i am lying'
                . '|liar paradox'
                . '|\bsorites paradox\b|\bsorites\b|\bheap\b.*grains?|grains?.*\bheap\b'
                . '|bald.*paradox|paradox.*bald'
                . '|smallest positive integer.*definable'
                . '|curry\'s paradox'
                . '|yablo\'s paradox|\byablo\b'
                . '|\bfitch\b.*paradox|fitch.*knowability'
                . '|\bnewcomb\b'
                . '|\bzeno\b'
                . '|achilles and the tortoise'
                . '|thomson\'s lamp|ross.littlewood'
                . '|\bgettier\b'
                . '|justified true belief.*problem|problem.*justified true belief'
                . '|chicken or the egg|grandfather paradox|ship of theseus|crocodile paradox'
                . '|unexpected hanging|twin paradox|sleeping beauty'
                . '|omnipotence paradox|banach.tarski paradox'
                . '/iu',
                $thesis
            )
        ) {
            return new ParadoxSolver($this->syntax);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 2 – Formal Proof Theory Guard
        // Catches pure logic/proof theory before Boolean or Science can grab it.
        // Negative lookaheads prevent Humanities-context Gödel from landing here.
        // ═══════════════════════════════════════════════════════════════════
        if (
            preg_match(
                '/\b(modus ponens|modus tollens|first.order logic|peano arithmetic'
                . '|propositional logic|diagonalisation|t.norm|fuzzy logic|paraconsistent'
                . '|tarski undefinability|l[öo]b\'s theorem|goodstein|paris.harrington'
                . '|incompleteness theorem(?!.*(?:knowledge|epistemolog|philosoph))'
                . '|g[öo]del(?!.*(?:epistemolog|philosoph|knowledge))'
                . '|\bcategorical syllogism\b|\bhypothetical syllogism\b|\baffirming the consequent\b|\btarski.*undefinability\b|\bimplies.*true\b)\b/iu',
                $thesis
            )
        ) {
            return new FormalLogicSolver($this->syntax);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 3 – Boolean Logic Guard
        // Must fire BEFORE NaturalScience (which would catch "true/false",
        // "energy", "force" in physics-adjacent language), and BEFORE
        // FormalLogic (which catches "if…then" patterns).
        // ═══════════════════════════════════════════════════════════════════
        if (
            preg_match(
                '/\bboolean expression\b'
                . '|\bboolean\b'
                . '|\btruth table\b'
                . '|\bxor\b'
                . '|de morgan\'?s law'
                . '|<->|<=>|\biff\b'
                . '|\btautology\b'
                . '|\bcontradiction\b.*\blogic\b|\blogic\b.*\bcontradiction\b'
                . '|\bpropositional calculus\b'
                . '|\bk.?map\b|minimize.*boolean|boolean.*minimize|\babsorption\b'
                . '|\bfunctionally complete\b'
                . '|\btrue and false\b|\btrue\b.*\band\b.*\bfalse\b|p \-> q|\->'
                . '/iu',
                $thesis
            )
        ) {
            return new BooleanLogicSolver($this->syntax);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 4 – Quantum Mechanics Priority Guard
        // Must fire BEFORE Statistical (probability/entropy) and Natural Science.
        // Uses /iu for multi-byte Schrödinger, Fermi-Dirac etc.
        // ═══════════════════════════════════════════════════════════════════
        if (
            preg_match(
                '/\b(heisenberg\b|schr[öo]dinger\b|de broglie\b|pauli\b'
                . '|planck constant|wave function|eigenvalue\b|quantum entanglement'
                . '|bose.?einstein|fermi.?dirac|commut(ation|ator)\b|born rule'
                . '|uncertainty principle|fermion\b|boson\b|photon energy'
                . '|photoelectric effect|infinite potential well|bell\'s inequalit'
                . '|bell inequalit|hilbert space.*quantum'
                . '|\bphoton\b|dual nature|double.?slit|hidden variables|harmonic oscillator'
                . '|\bquantum\b(?!.*(?:leap|computing game|social)))/iu',
                $thesis
            )
        ) {
            return new QuantumMechanicsSolver($this->syntax, $this->cas);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 5 – Statistical Science Guard
        // Must fire BEFORE NumberTheory (CLT contains "theorem") and
        // BEFORE NaturalScience (entropy/energy overlap).
        // ═══════════════════════════════════════════════════════════════════
        if (
            preg_match(
                '/\b(bayes\'? theorem|bayesian\b|posterior probability|prior probability'
                . '|central limit theorem\b|standard deviation\b|normal distribution\b'
                . '|z.score\b|confidence interval\b|hypothesis test'
                . '|shannon entropy\b|information entropy\b|kolmogorov entropy'
                . '|markov chain|stochastic process|poisson distribution'
                . '|binomial distribution|chi.squared test|survival analysis'
                . '|hazard function|regression analysis\b|law of large numbers'
                . '|\bmean\b(?!\svalue theorem)|\bmedian\b|\bmode\b|\bprobability\b|\bcovariance\b'
                . '|\bp.?value\b|\bhypothesis testing\b|\bmle\b|\bregression\b|\banova\b'
                . '|\bt.?test\b|\bchi.?square\b|\bdice\b|coin toss'
                . '|maximum likelihood estimation)/iu',
                $thesis
            )
        ) {
            return new StatisticalScienceSolver($this->syntax);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 6 – Set Theory Guard
        // ═══════════════════════════════════════════════════════════════════
        if (
            preg_match(
                '/\b(banach.tarski|cantor\'?s theorem|power set\b|cardinality\b'
                . '|continuum hypothesis\b|aleph.?[0-9∞]?\b|beth number'
                . '|ordinal arithmetic|transfinite induction|zorn\'?s lemma'
                . '|axiom of choice\b|well.ordering theorem|burali.forti'
                . '|cantor.bernstein|diagonal argument|cardinal hierarchy'
                . '|russell\'?s paradox|zfc\b|von neumann ordinal'
                . '|set of all sets|power set of real'
                . '|\bunion\b.*\bsets?\b|\bsets?\b.*\bunion\b|\bempty set\b|\buncountable set\b|\bintersection\b.*\bsets?\b|\bsets?\b.*\bintersection\b|\binaccessible cardinals?\b)/iu',
                $thesis
            )
        ) {
            return new SetTheorySolver($this->syntax);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 7 – Computational Logic Guard
        // Must fire BEFORE NumberTheory (RSA uses "prime factorization"),
        // and BEFORE Natural Science.
        // ═══════════════════════════════════════════════════════════════════
        if (
            preg_match(
                '/\b(halting problem\b|p vs np\b|p = np\b|np.complete\b|np.hard\b'
                . '|turing machine\b|time complexity\b|space complexity\b'
                . '|big.o\b|church.turing|computability\b|uncomputabl'
                . '|rsa cryptograph|diffie.hellman|aes encryption|lossless compression'
                . '|kolmogorov complexity\b|hamming code|traveling salesperson'
                . '|boolean satisfiability|landauer limit|one.time pad'
                . '|byzantine general|nakamoto consensus|hash collision\b'
                . '|\balgorithm\b|\bbinary number\b|\brecursion\b|\bmachine learning\b'
                . '|\bneural network\b|\bsorting\b)/iu',
                $thesis
            )
        ) {
            return new ComputationalLogicSolver($this->syntax);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 8 – Social Science Guard
        // ═══════════════════════════════════════════════════════════════════
        if (
            preg_match(
                '/\b(nash equilibrium\b|prisoner\'?s dilemma\b|pareto efficiency\b'
                . '|pareto optimal\b|gini coefficient\b|prospect theory\b|loss aversion\b'
                . '|consumer surplus\b|deadweight loss\b|monopoly pricing\b'
                . '|price elasticity\b|utility maximization\b|cournot\b|bertrand\b'
                . '|game theory\b|macroeconomics\b|microeconomics\b|behavioral economics\b'
                . '|phillips curve\b|okun\'?s law\b|solow (growth|model)\b'
                . '|kahneman\b|tversky\b|bounded rationality\b|hyperbolic discounting\b'
                . '|arrow\'?s impossibility\b|condorcet paradox\b|gini\b|zipf\'?s law\b'
                . '|dunbar\'?s number\b|keynesian\b|fiscal policy\b|monetary policy\b'
                . '|aggregate demand\b|is.lm\b|folk theorem\b|minimax theorem\b'
                . '|backward induction\b.*game|endowment effect\b|status quo bias\b'
                . '|concept of culture|cognitive dissonance)/iu',
                $thesis
            )
        ) {
            return new SocialScienceSolver($this->syntax, $this->cas);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 9 – Engineering Science Guard
        // Must fire BEFORE NaturalScience (which is a superset).
        // ═══════════════════════════════════════════════════════════════════
        if (
            preg_match(
                '/\b(yield stress\b|tensile strength\b|young\'?s modulus\b'
                . '|reynolds number\b|navier.stokes\b|bernoulli\'?s (equation|principle)\b'
                . '|lift equation\b|kutta.joukowski\b|drag coefficient\b|mach number\b'
                . '|bending moment\b|shear force (diagram)?\b|cantilever beam\b'
                . '|euler column\b|slenderness ratio\b|beam bending\b'
                . '|specific impulse\b|tsiolkovsky\b|rocket equation\b'
                . '|rankine cycle\b|brayton cycle\b|carnot cycle\b|refrigeration cop\b'
                . '|fourier conduction\b|newton\'?s cooling\b|heat exchanger\b'
                . '|rc circuit\b|rl circuit\b|rlc (resonance|circuit)\b'
                . '|mohr\'?s circle\b|fracture toughness\b|griffith crack\b'
                . '|poiseuille flow\b|boundary layer\b|aerodynamics\b'
                . '|structural load\b|hooke\'?s law\b|material fatigue\b'
                . '|shear modulus\b|fluid dynamics\b|viscosity\b'
                . '|reynolds\b.*flow|flow.*reynolds\b'
                . '|ohm\'?s law|ac and dc|transformer|fatigue life|miner\'?s rule|nyquist plot'
                . '|specific impulse|rocketry'
                . '|stress.*rod|\bstress\b.*force|\bforce\b.*\bstress\b)/iu',
                $thesis
            )
        ) {
            return new EngineeringScienceSolver($this->syntax, $this->cas);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 10 – Post-Human Speculative Guard
        // Must fire BEFORE Natural Science (holographic/Dyson are physics-adjacent).
        // ═══════════════════════════════════════════════════════════════════
        if (
            preg_match(
                '/\b(simulation theory\b|simulated reality\b|we.*living in a simul'
                . '|holographic principle\b|holographic universe\b'
                . '|kardashev scale\b|type (i|ii|iii) civilization\b'
                . '|dyson sphere\b|technological singularity\b|singularity\b.*ai'
                . '|superintelligence\b|post.human\b|transhuman\b'
                . '|omega point\b|eschatology\b.*technolog|heat death.*universe'
                . '|matrioshka brain\b|infinite computation\b|zero energy cost\b'
                . '|neuralink\b|mind uploading\b|brain.computer interface.*future'
                . '|artificial intelligence|simulation hypothesis|simulated matrix|dyson spheres?|fermi paradox)/iu',
                $thesis
            )
        ) {
            return new PostHumanSpeculativeSolver($this->syntax, $this->cas);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 11 – Algebraic Summation Guard
        // Must fire BEFORE NumberTheory (n^2 matches) and BEFORE NaturalScience.
        // ═══════════════════════════════════════════════════════════════════
        if (
            preg_match(
                '/\bsum\b.*\bfrom\b|\bsum\b.*\bto\b'          // "sum of n from 1 to 100"
                . '|sum_\{'                                      // LaTeX sum_{k=1}^{n}
                . '|sum\s*\(\s*[a-z]\s*='                       // sum(n = 1
                . '|\bgeometric series\b'
                . '|\barithmetic series\b'
                . '|\bsigma\b.*=.*\d'                           // Σ notation
                . '|\bsummation\b'
                . '|\barithmetic progression\b|\bgeometric progression\b|\bramanujan summation\b|\bbasel problem\b'
                . '|\bsum.*1\+2\b|\bsum.*odd numbers\b|\bsum.*cubes\b'
                . '/iu',
                $thesis
            )
        ) {
            return new AlgebraicSummationSolver($this->syntax, $this->cas);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 12 – Complex Domain Guard
        // Must fire BEFORE NumberTheory (imaginary roots of x^2+1 matches "x^").
        // ═══════════════════════════════════════════════════════════════════
        if (
            preg_match(
                '/euler\'?s identity\b|e\^?\(?i.*pi\)?'
                . '|\bimaginary (root|number|unit|plane)\b'
                . '|\bcomplex plane\b|\bcomplex function\b|\bcomplex number\b'
                . '|\bprincipal root\b|\bprincipal branch\b'
                . '|roots.*\bcomplex\b|\bcomplex\b.*roots'
                . '|\blambert w\b'
                . '|\btranscendental number\b'
                . '|pi and e are transcendental|e and pi.*transcendental'
                . '|\bconformal map\b|\briemann surface\b'
                . '|\banalytic function\b|\bholomorphic\b'
                . '|square root of \-1|\bpolar form\b|\bde moivre\b|cube roots of unity|\briemann zeta\b'
                . '|\bcomplex numbers\b|multiply.*1 \+ i|\bprincipal logarithm\b|\bcontour integral\b'
                . '/iu',
                $thesis
            )
        ) {
            return new ComplexDomainSolver($this->syntax);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 13 – Number Theory Guard
        // Explicit mathematical number-theory terms. "perfect number" and
        // "proper divisors" are caught here before NaturalScience.
        // "RSA prime factorization" is already caught in LAYER 7.
        // ═══════════════════════════════════════════════════════════════════
        if (
            preg_match(
                '/\b(perfect number\b|proper divisors?\b'
                . '|gcd\b|greatest common divisor\b|lcm\b|least common multiple\b'
                . '|modulo\b|modular arithmetic\b'
                . '|goldbach\b|collatz\b|twin prime\b|fermat\'?s last theorem\b'
                . '|riemann hypothesis\b|poincar[eé] conjecture\b'
                . '|hodge conjecture\b|birch and swinnerton\b'
                . '|sum of two odd\b|sum of two primes?\b|even.*prime|prime.*even'
                . '|divisib(le|ility)\b|prime factori[sz]ation\b'
                . '|euler\'?s totient\b|chinese remainder theorem\b'
                . '|arithmetic progression.*prime|prime.*arithmetic progression'
                . '|greatest common divisor|carmichael number|fundamental theorem of arithmetic'
                . '|\bprime number\b|multiplying.*even number|\bpositive integers?\b|\binfinitely many prime numbers\b)\b/iu',
                $thesis
            )
        ) {
            return new NumberTheorySolver($this->syntax);
        }

        // Also catch structural n^x or letter^letter patterns (but exclude quantum/physics context)
        if (
            preg_match('/\bn\^[0-9]\b|\bn\^2\b|\bn\^3\b/i', $thesis)
            && !preg_match('/\b(quantum|wave|orbital|photon|electron|proton|neutron)\b/i', $thesis)
        ) {
            return new NumberTheorySolver($this->syntax);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 14 – Humanities Priority Guard
        // Must fire BEFORE Phase2ProofTheory (Gödel in epistemology) and
        // BEFORE NaturalScience (neuroscience adjacency).
        // NOTE: No outer \b wrappers – \b breaks on multi-byte chars (ö).
        // Uses /iu for UTF-8 support.
        // ═══════════════════════════════════════════════════════════════════
        if (
            preg_match(
                '/('
                . 'hard problem of consciousness|qualia\b|phenomenal consciousness|explanatory gap'
                . '|chinese room|searle.*strong ai|intentionality\b|syntax.?semantics'
                . '|integrated information theory'
                . '|philosophy of mind\b|philosophy of consciousness\b|functionalism.*mind'
                . '|chomsky\b|universal grammar\b|language acquisition device'
                . '|sapir.?whorf|linguistic relativity\b|language game\b|wittgenstein\b'
                . '|frege.*sense|sense.*reference|sinn.*bedeutung|speech act theory\b|illocutionary\b'
                . '|rawls\b|veil of ignorance\b|difference principle\b|original position\b'
                . '|categorical imperative\b|kingdom of ends\b|humanity formula\b'
                . '|utilitarianism\b|bentham.*utility|mill.*harm principle|aggregate utility'
                . '|virtue ethics\b|eudaimonia\b|phronesis\b|aristotle.*ethics'
                . '|contractualism\b|kin selection.*ethics|hamilton.*rule.*moral'
                . '|g[öo]del.*epistemolog|incompleteness.*knowledge|popper.*falsif|bayesian.*belief'
                . '|problem of induction.*hume|quine.*holism|web of belief'
                . '|fukuyama\b|end of history\b|hegel.*dialectic|dialectical.*materialism|aufhebung\b'
                . '|kuhn.*paradigm|paradigm shift.*science|toynbee\b|braudel\b|tainter.*complexity'
                . '|turing test.*intelligence|behavioral.*criterion.*machine'
                . '|hegelian dialectic|historical materialism.*marx|marx.*historical materialism'
                . ')/iu',
                $thesis
            )
        ) {
            return new HumanitiesDialecticsSolver($this->syntax, $this->cas);
        }

        // Deeper Humanities catch: Phase 11 broad terms
        if (
            preg_match(
                '/\b(hegel\b|dialectics?\b|dialectical\b|marxist\b|kant\b|nietzsche\b'
                . '|epistemology\b|phenomenology\b|aesthetics\b|ontology\b'
                . '|moral philosophy\b|popper\b|falsifiab\w+|kuhn\b|paradigm shift\b'
                . '|toynbee\b|tainter\b|turing test\b|searle\b|chalmers\b'
                . '|consciousness\b|qualia\b|functionalism\b|frege\b'
                . '|chomsky\b|fukuyama\b'
                . '|\bsocrates\b|allegory of the cave|existentialism|modernism|postmodernism)/iu',
                $thesis
            )
        ) {
            return new HumanitiesDialecticsSolver($this->syntax, $this->cas);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 15 – Mathematical Analysis Guard
        // Explicit calculus/analysis functions that are unambiguously math.
        // NOTE: "limit" alone removed — catches too many physics limits.
        // ═══════════════════════════════════════════════════════════════════
        if (
            preg_match(
                '/\b(sin|cos|tan|sinh|cosh|tanh|asin|acos|atan)\s*\('
                . '|\bln\s*\(|\blog\s*\(|\bexp\s*\('
                . '|\bsqrt\s*\('
                . '|\bderivative\b|\bintegral\b|\bantiderivative\b'
                . '|\bdifferential equation\b'
                . '|\bepsilon.?delta\b|\bcontinuity\b.*function|\bfunction.*continuity\b'
                . '|\blim\b.*\bas\b.*\bapproaches\b|\blimit\b.*\bapproaches\b'
                . '|\binfinitely many roots\b|\bfunction.*roots.*bounded\b|\broots.*bounded domain\b'
                . '|\bidentity theorem\b|\banalytic\b.*function'
                . '|\btaylor series\b|\bmaclaurin series\b|\bfourier series\b'
                . '|\briemann integral\b|\blebesgue integral\b'
                . '|\bintermediate value theorem\b|\bmean value theorem\b'
                . '|\bbolzano.weierstrass\b|\bheine.cantor\b'
                . '|\bmean value theorem\b|\barc length\b|\bweierstrass\b'
                . '|\bfundamental theorem of calculus\b'
                . '/iu',
                $thesis
            )
        ) {
            return new MathematicalAnalysisSolver($this->syntax);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 16 – Natural Science Broad Guards
        // Only reached after all specialized domain guards have fired.
        // Split into sub-guards (Thermodynamics, Kinematics, EM, Nuclear, Biology)
        // ═══════════════════════════════════════════════════════════════════

        // 16a. Kinematics & Mechanics (mass-energy equivalence catches "rest mass of 1kg")
        if (
            preg_match(
                '/\b(mass.energy equivalence\b|e\s*=\s*mc.?\b|rest mass\b'
                . '|kinematic equation\b|constant acceleration\b'
                . '|velocity\b|acceleration\b|lorentz factor\b|schwarzschild\b'
                . '|time dilation\b|length contraction\b|spacetime\b'
                . '|gravitational (wave|lensing|field)\b|frame dragging\b'
                . '|angular momentum\b|linear momentum\b|torque\b|centripetal\b'
                . '|kinetic energy\b|potential energy\b)\b/iu',
                $thesis
            )
        ) {
            return new NaturalScienceSolver($this->syntax, $this->cas);
        }

        // 16b. Thermodynamics & Chemistry
        if (
            preg_match(
                '/\b(thermodynamics?\b|carnot engine\b|carnot efficiency\b'
                . '|gibbs free energy\b|helmholtz\b|clausius\b|boltzmann\b|entropy\b'
                . '|heat engine\b|perpetual motion\b|conservation of energy\b'
                . '|stoichiometry\b|molar mass\b|avogadro\b|photosynthesis\b'
                . '|combustion\b|equilibrium constant\b|le chatelier\b|arrhenius\b'
                . '|hess\'?s law\b|gibbs\b|haber.bosch\b|acid.base\b'
                . '|chemical formula|plate tectonics|standard model)\b/iu',
                $thesis
            )
        ) {
            return new NaturalScienceSolver($this->syntax, $this->cas);
        }

        // 16c. Electromagnetism
        if (
            preg_match(
                '/\b(maxwell\'?s equations?\b|faraday\'?s law\b|ampere\'?s law\b'
                . '|ohm\'?s law\b|coulomb\'?s law\b|kirchhoff\b|lorentz force\b'
                . '|magnetic flux\b|electromotive\b|gauss\'?s law\b'
                . '|electromagnetic\b|electrostatic\b|capacitance\b|inductance\b'
                . '|snell\'?s law\b|refraction\b|diffraction\b|interference\b'
                . '|doppler effect\b|standing wave\b)\b/iu',
                $thesis
            )
        ) {
            return new NaturalScienceSolver($this->syntax, $this->cas);
        }

        // 16d. Nuclear & Particle Physics
        if (
            preg_match(
                '/\b(nuclear fission\b|nuclear fusion\b|nuclear decay\b|binding energy\b'
                . '|radioactive\b|half.life\b|decay constant\b|alpha particle\b|beta decay\b'
                . '|gamma radiation\b|bohr model\b|rutherford\b|hydrogen energy level\b'
                . '|electron volt\b|nucleon\b|neutron\b|proton\b)\b/iu',
                $thesis
            )
        ) {
            return new NaturalScienceSolver($this->syntax, $this->cas);
        }

        // 16e. Biology & Life Sciences
        if (
            preg_match(
                '/\b(dna\b|rna\b|genetics?\b|chromosome\b|mitosis\b|meiosis\b'
                . '|atp synthesis\b|cellular respiration\b|glycolysis\b'
                . '|adenosine triphosphate\b|mitochondria\b|natural selection\b'
                . '|hardy.weinberg\b|speciation\b|phenotype\b|genotype\b|allele\b'
                . '|neurotransmitter\b|synapse\b|action potential\b|neuron\b'
                . '|evolv(e|ing|ution)\b(?!.*ethics)|kin selection\b(?!.*ethics|.*moral)'
                . '|cellular respiration|krebs cycle)\b/iu',
                $thesis
            )
        ) {
            return new NaturalScienceSolver($this->syntax, $this->cas);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 16f – Empirical Science Guard
        // Must fire BEFORE FormalLogic (which grabs "if…then" patterns) and
        // BEFORE the oracle fallback (which may misclassify scientific method
        // questions as philosophy).
        // ═══════════════════════════════════════════════════════════════════
        if (
            preg_match(
                '/\b(scientific method\b|hypothesis testing\b|falsif(iab|y|ication)\b'
                . '|controlled experiment\b|independent variable\b|dependent variable\b'
                . '|scientific theory\b|scientific law\b|peer review\b|replicat(e|ion|ing)\b'
                . '|empirical evidence\b|null hypothesis\b|experimental design\b'
                . '|cosmolog\w+\b|big bang\b|hubble constant\b|hubble\'?s law\b'
                . '|cosmic microwave background\b|cmb\b|dark matter\b|dark energy\b'
                . '|stellar nucleosynthesis\b|chandrasekhar limit\b|lambda.?cdm\b'
                . '|redshift\b(?!.*econom)'
                . '|plate tectonics\b|radiometric dating\b|geologic time\b|stratigraphy\b'
                . '|milankovitch\b|seafloor spreading\b|subduction\b'
                . '|greenhouse effect\b|global warming\b|climate forcing\b'
                . '|stefan.boltzmann.*climate|co2.*atmosphere|carbon dioxide.*temperature'
                . '|lotka.volterra\b|carrying capacity\b(?!.*econom)'
                . '|trophic level\b|food chain.*energy|biodiversity index\b'
                . '|shannon.*diversity|competitive exclusion\b'
                . '|si unit\b|measurement uncertainty\b|propagation of (error|uncertainty)'
                . '|significant figure\b|dimensional analysis\b(?!.*econom)'
                . ')/iu',
                $thesis
            )
        ) {
            return new EmpiricalScienceSolver($this->syntax);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 17 – Formal Logic Structural Patterns
        // Syllogisms and implication chains not caught by Layer 2.
        // ═══════════════════════════════════════════════════════════════════
        // Phase 1: Metaphysics, Ontology & Epistemology
        if (
            preg_match(
                '/\b(identity of indiscernibles\b|ship of theseus\b|sufficient reason\b'
                . '|modal realism\b|bundle theory\b|determinism\b|compatibilism\b'
                . '|mereology\b|existentialism\b|substantivalism\b|hylomorphism\b'
                . '|trope nominalism\b|dualism\b|epiphenomenalism\b|idealism\b'
                . '|knowable\b)\b/iu',
                $thesis
            )
        ) {
            return new FormalLogicSolver($this->syntax);
        }

        // Syllogism patterns and implication chains
        if (
            preg_match('/\b(all|every|some|no)\s+\w+.*\b(are|is)\b.*\btherefore\b/i', $thesis)
            || preg_match('/\bif\b.*\bthen\b.*\btherefore\b/i', $thesis)
            || preg_match('/\bimplies\b.*\btherefore\b/i', $thesis)
        ) {
            return new FormalLogicSolver($this->syntax);
        }

        // implies + equation — formal logic
        if (preg_match('/\b(if|then|therefore|implies)\b/i', $thesis) && preg_match('/[=><]/', $thesis)) {
            return new FormalLogicSolver($this->syntax);
        }

        // Boolean operator with = or iff patterns (not already caught above)
        if (preg_match('/\b(and|or|not|xor)\b/i', $thesis) && preg_match('/=|iff|<->/i', $thesis)) {
            $hasNonBooleanNumbers = preg_match('/\b[2-9]\b|\d{2,}|\.\d+/', $thesis);
            $hasScienceKeywords = preg_match('/\b(mass|force|acceleration|velocity|speed|gravity|energy|work|potential|kinetic|temp|temperature|pressure|volume|moles|density|entropy|enthalpy|speciation|evolution|population|supply|demand|price|market|cost|gdp|inflation)\b/i', $thesis);
            if (!$hasNonBooleanNumbers && !$hasScienceKeywords) {
                return new BooleanLogicSolver($this->syntax);
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 18 – Oracle / ML Semantic Fallback (DB-driven)
        // ═══════════════════════════════════════════════════════════════════
        $oracleDomain = $this->oracle->classifyDomain($thesis);
        if ($oracleDomain) {
            $branch = $oracleDomain['branch'] ?? $oracleDomain['domain_partition'] ?? $oracleDomain['key'];
            $solverClass = \App\Services\Dialectical\Semantic\ScientificTaxonomyService::resolveSolverClass($branch);
            $map = [
                \App\Services\Dialectical\Solvers\MathematicalAnalysisSolver::class => fn() => new MathematicalAnalysisSolver($this->syntax),
                \App\Services\Dialectical\Solvers\ComplexDomainSolver::class => fn() => new ComplexDomainSolver($this->syntax),
                \App\Services\Dialectical\Solvers\SetTheorySolver::class => fn() => new SetTheorySolver($this->syntax),
                \App\Services\Dialectical\Solvers\AlgebraicSummationSolver::class => fn() => new AlgebraicSummationSolver($this->syntax, $this->cas),
                \App\Services\Dialectical\Solvers\ComputationalLogicSolver::class => fn() => new ComputationalLogicSolver($this->syntax),
                \App\Services\Dialectical\Solvers\HumanitiesDialecticsSolver::class => fn() => new HumanitiesDialecticsSolver($this->syntax, $this->cas),
                \App\Services\Dialectical\Solvers\PostHumanSpeculativeSolver::class => fn() => new PostHumanSpeculativeSolver($this->syntax, $this->cas),
                \App\Services\Dialectical\Solvers\NumberTheorySolver::class => fn() => new NumberTheorySolver($this->syntax),
                \App\Services\Dialectical\Solvers\FormalLogicSolver::class => fn() => new FormalLogicSolver($this->syntax),
                \App\Services\Dialectical\Solvers\NaturalScienceSolver::class => fn() => new NaturalScienceSolver($this->syntax, $this->cas),
                \App\Services\Dialectical\Solvers\EngineeringScienceSolver::class => fn() => new EngineeringScienceSolver($this->syntax, $this->cas),
                \App\Services\Dialectical\Solvers\SocialScienceSolver::class => fn() => new SocialScienceSolver($this->syntax, $this->cas),
                \App\Services\Dialectical\Solvers\StatisticalScienceSolver::class => fn() => new StatisticalScienceSolver($this->syntax),
                \App\Services\Dialectical\Solvers\QuantumMechanicsSolver::class => fn() => new QuantumMechanicsSolver($this->syntax, $this->cas),
                \App\Services\Dialectical\Solvers\BooleanLogicSolver::class => fn() => new BooleanLogicSolver($this->syntax),
                \App\Services\Dialectical\Solvers\ParadoxSolver::class => fn() => new ParadoxSolver($this->syntax),
            ];
            if (isset($map[$solverClass])) {
                return ($map[$solverClass])();
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 19 – PHP-ML Semantic Routing Fallback
        // ═══════════════════════════════════════════════════════════════════
        $semanticDomain = $knownDomain ?: $this->semantic->classify($thesis);
        if ($semanticDomain) {
            $solverClass = \App\Services\Dialectical\Semantic\ScientificTaxonomyService::resolveSolverClass($semanticDomain);
            $mlMap = [
                \App\Services\Dialectical\Solvers\NumberTheorySolver::class => fn() => new NumberTheorySolver($this->syntax),
                \App\Services\Dialectical\Solvers\FormalLogicSolver::class => fn() => new FormalLogicSolver($this->syntax),
                \App\Services\Dialectical\Solvers\NaturalScienceSolver::class => fn() => new NaturalScienceSolver($this->syntax, $this->cas),
                \App\Services\Dialectical\Solvers\StatisticalScienceSolver::class => fn() => new StatisticalScienceSolver($this->syntax),
            ];
            if (isset($mlMap[$solverClass])) {
                return ($mlMap[$solverClass])();
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 20 – Ultimate Fallback
        // ═══════════════════════════════════════════════════════════════════
        if (app(\App\Services\Dialectical\ScienceSyntaxAnalyzer::class)->isMathOrScientificExpression($thesis)) {
            return new NumberTheorySolver($this->syntax);
        }

        $hasLogicTerms = preg_match('/\b(?:implies|is true|is false|be true|negation|contradict|propositions?|logic|conjunction|disjunction|premise|if\s+.*?then|all\s+.*?are|some\s+.*?are|no\s+.*?are|none|conjecture)\b/i', $thesis);
        if ($hasLogicTerms) {
            return new FormalLogicSolver($this->syntax);
        }

        // Universal ultimate fallback — never return null, always answer
        return new FormalLogicSolver($this->syntax);
    }
}
