<?php

namespace Tests\Unit\Dialectical\AxiomEngine\Inductive;

use Tests\TestCase;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicTerm;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicExpression;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicEquation;
use App\Services\Dialectical\AxiomEngine\Inductive\Fragment17\BaseCaseGenerator;
use App\Services\Dialectical\AxiomEngine\Inductive\Fragment18\UniversalScalingConstructor;
use App\Services\Dialectical\AxiomEngine\Inductive\Fragment19\StructuralInvarianceProver;
use App\Services\Dialectical\AxiomEngine\Inductive\Fragment20\AbsoluteClosureFormulator;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment3\PeanoArithmeticEngine;
use App\Services\Dialectical\AxiomEngine\AxiomRegistry;

class InductiveSynthesisTest extends TestCase
{
    private AxiomRegistry $registry;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->registry = $this->createMock(\App\Services\Dialectical\AxiomEngine\AxiomRegistry::class);
        $this->registry->method('getAxiom')->willReturn(null);
    }

    public function testBaseCaseGenerator()
    {
        $generator = new BaseCaseGenerator($this->registry);
        
        // P(n): n^2 + n = 2 (for base case n=1)
        // LHS: 1*n^2 + 1*n
        $lhs = new SymbolicExpression([
            new SymbolicTerm(1, ['n' => 2]),
            new SymbolicTerm(1, ['n' => 1])
        ]);
        
        // RHS: 2
        $rhs = new SymbolicExpression([
            new SymbolicTerm(2, [])
        ]);
        
        $equation = new SymbolicEquation($lhs, "=", $rhs);
        
        // Assert evaluateBaseCase for n=1 returns true (2 == 2)
        $isValid = $generator->evaluateBaseCase($equation, 'n', 1);
        $this->assertTrue($isValid, "Base case generator failed to prove 1^2 + 1^1 = 2 symbolically.");
    }

    public function testUniversalScalingConstructor()
    {
        $constructor = new UniversalScalingConstructor($this->registry);
        
        // P(n): n^2 + n
        $expr = new SymbolicExpression([
            new SymbolicTerm(1, ['n' => 2]),
            new SymbolicTerm(1, ['n' => 1])
        ]);
        
        // Replacement: k + 1
        $replacement = new SymbolicExpression([
            new SymbolicTerm(1, ['k' => 1]),
            new SymbolicTerm(1, [])
        ]);
        
        $scaledExpr = $constructor->scaleVariable($expr, 'n', $replacement);
        
        $arithmetic = new PeanoArithmeticEngine($this->registry);
        // simplify it
        $scaledExpr = $arithmetic->addExpressions($scaledExpr, new SymbolicExpression([]));
        
        // Verify output is structurally equal to k^2 + 3k + 2
        $expected = new SymbolicExpression([
            new SymbolicTerm(1, ['k' => 2]),
            new SymbolicTerm(3, ['k' => 1]),
            new SymbolicTerm(2, [])
        ]);
        
        $difference = $arithmetic->subtractExpressions($scaledExpr, $expected);
        $this->assertEquals("0", (string)$difference, "Scaling constructor failed to map n^2+n to k^2+3k+2");
    }

    public function testStructuralInvarianceProver()
    {
        $prover = new StructuralInvarianceProver($this->registry);
        
        // RHS_k = k^2 + k
        $rhsK = new SymbolicExpression([
            new SymbolicTerm(1, ['k' => 2]),
            new SymbolicTerm(1, ['k' => 1])
        ]);
        
        // Delta = 2k + 2
        $delta = new SymbolicExpression([
            new SymbolicTerm(2, ['k' => 1]),
            new SymbolicTerm(2, [])
        ]);
        
        // RHS_{k+1} = k^2 + 3k + 2
        $rhsKPlus1 = new SymbolicExpression([
            new SymbolicTerm(1, ['k' => 2]),
            new SymbolicTerm(3, ['k' => 1]),
            new SymbolicTerm(2, [])
        ]);
        
        // Proves RHS_k + Delta == RHS_{k+1}
        $isValid = $prover->proveInvariance($rhsK, $delta, $rhsKPlus1);
        
        $this->assertTrue($isValid, "Structural invariance prover failed to validate k^2+k + 2k+2 = k^2+3k+2");
    }

    public function testAbsoluteClosureFormulator()
    {
        $formulator = new AbsoluteClosureFormulator($this->registry);
        
        $baseEquation = new SymbolicEquation(
            new SymbolicExpression([new SymbolicTerm(2, [])]),
            "=",
            new SymbolicExpression([new SymbolicTerm(2, [])])
        );
        $pkEquation = new SymbolicEquation(
            new SymbolicExpression([new SymbolicTerm(1, ['k' => 1])]),
            "=",
            new SymbolicExpression([new SymbolicTerm(1, ['k' => 1])])
        );
        $pkPlus1Equation = new SymbolicEquation(
            new SymbolicExpression([new SymbolicTerm(1, ['k' => 2])]),
            "=",
            new SymbolicExpression([new SymbolicTerm(1, ['k' => 2])])
        );
        
        $markdown = $formulator->formulateInductiveProof(
            "Proof that twice the sum of first n numbers is n^2+n",
            $baseEquation,
            true,
            $pkEquation,
            $pkPlus1Equation,
            true
        );
        
        $this->assertStringContainsString("Absolute Closure", $markdown);
        $this->assertStringContainsString("\$\mathbf{True}\$ for all natural numbers", $markdown);
    }
    public function testEndToEndInductiveSynthesis()
    {
        // Prove that 2 * (1 + 2 + ... + n) = n^2 + n
        
        $baseGenerator = new BaseCaseGenerator($this->registry);
        $universalConstructor = new UniversalScalingConstructor($this->registry);
        $invarianceProver = new StructuralInvarianceProver($this->registry);
        $formulator = new AbsoluteClosureFormulator($this->registry);

        // 1. Base Case Generator (n = 1)
        // LHS: 1^2 + 1^1 = 2
        $lhs = new SymbolicExpression([
            new SymbolicTerm(1, ['n' => 2]),
            new SymbolicTerm(1, ['n' => 1])
        ]);
        
        // RHS: 2
        $rhs = new SymbolicExpression([
            new SymbolicTerm(2, [])
        ]);
        
        $equation = new SymbolicEquation($lhs, "=", $rhs);
        
        $baseValid = $baseGenerator->evaluateBaseCase($equation, 'n', 1);
        $this->assertTrue($baseValid, "E2E: Base case failed.");

        // 2. Universal Scaling Constructor (n -> k + 1)
        // P(k): k^2 + k
        $expr = new SymbolicExpression([
            new SymbolicTerm(1, ['n' => 2]),
            new SymbolicTerm(1, ['n' => 1])
        ]);
        
        $replacement = new SymbolicExpression([
            new SymbolicTerm(1, ['k' => 1]),
            new SymbolicTerm(1, [])
        ]);
        
        $pkPlus1Raw = $universalConstructor->scaleVariable($expr, 'n', $replacement);
        
        $arithmetic = new PeanoArithmeticEngine($this->registry);
        $pkPlus1 = $arithmetic->addExpressions($pkPlus1Raw, new SymbolicExpression([]));
        
        // pkPlus1 is now k^2 + 3k + 2
        
        // 3. Structural Invariance Prover
        $rhsK = new SymbolicExpression([
            new SymbolicTerm(1, ['k' => 2]),
            new SymbolicTerm(1, ['k' => 1])
        ]);
        
        // Delta for next term in sequence 2 * sum i (adding 2(k+1) = 2k + 2)
        $delta = new SymbolicExpression([
            new SymbolicTerm(2, ['k' => 1]),
            new SymbolicTerm(2, [])
        ]);
        
        $invarianceValid = $invarianceProver->proveInvariance($rhsK, $delta, $pkPlus1);
        $this->assertTrue($invarianceValid, "E2E: Structural invariance failed.");
        
        // 4. Absolute Closure Formulator
        $pkEquation = new SymbolicEquation(
            new SymbolicExpression([new SymbolicTerm(1, ['k' => 1])]), // dummy
            "=",
            $rhsK
        );
        $pkPlus1Equation = new SymbolicEquation(
            new SymbolicExpression([new SymbolicTerm(1, ['k' => 2])]), // dummy
            "=",
            $pkPlus1
        );
        
        $markdown = $formulator->formulateInductiveProof(
            "Proof that 2 * sum(1..n) = n^2 + n",
            $equation,
            $baseValid,
            $pkEquation,
            $pkPlus1Equation,
            $invarianceValid
        );
        
        $this->assertStringContainsString("Absolute Closure", $markdown);
        $this->assertStringContainsString("Proof that 2 * sum(1..n) = n^2 + n", $markdown);
    }

    public function testEndToEndInductiveSynthesisSumOfSquares()
    {
        // Prove that 6 * sum(i^2 from 1 to n) = 2n^3 + 3n^2 + n
        
        $baseGenerator = new BaseCaseGenerator($this->registry);
        $universalConstructor = new UniversalScalingConstructor($this->registry);
        $invarianceProver = new StructuralInvarianceProver($this->registry);
        $formulator = new AbsoluteClosureFormulator($this->registry);

        // 1. Base Case Generator (n = 1)
        // LHS: 2(1)^3 + 3(1)^2 + 1(1)^1 = 6
        $lhs = new SymbolicExpression([
            new SymbolicTerm(2, ['n' => 3]),
            new SymbolicTerm(3, ['n' => 2]),
            new SymbolicTerm(1, ['n' => 1])
        ]);
        
        // RHS: 6 (since 6 * 1^2 = 6)
        $rhs = new SymbolicExpression([
            new SymbolicTerm(6, [])
        ]);
        
        $equation = new SymbolicEquation($lhs, "=", $rhs);
        
        $baseValid = $baseGenerator->evaluateBaseCase($equation, 'n', 1);
        $this->assertTrue($baseValid, "E2E: Base case failed for Sum(i^2).");

        // 2. Universal Scaling Constructor (n -> k + 1)
        // P(k): 2k^3 + 3k^2 + k
        $expr = new SymbolicExpression([
            new SymbolicTerm(2, ['n' => 3]),
            new SymbolicTerm(3, ['n' => 2]),
            new SymbolicTerm(1, ['n' => 1])
        ]);
        
        $replacement = new SymbolicExpression([
            new SymbolicTerm(1, ['k' => 1]),
            new SymbolicTerm(1, [])
        ]);
        
        $pkPlus1Raw = $universalConstructor->scaleVariable($expr, 'n', $replacement);
        
        $arithmetic = new PeanoArithmeticEngine($this->registry);
        $pkPlus1 = $arithmetic->addExpressions($pkPlus1Raw, new SymbolicExpression([]));
        // Expecting: 2(k^3 + 3k^2 + 3k + 1) + 3(k^2 + 2k + 1) + (k + 1)
        // = 2k^3 + 6k^2 + 6k + 2 + 3k^2 + 6k + 3 + k + 1
        // = 2k^3 + 9k^2 + 13k + 6
        
        // 3. Structural Invariance Prover
        $rhsK = new SymbolicExpression([
            new SymbolicTerm(2, ['k' => 3]),
            new SymbolicTerm(3, ['k' => 2]),
            new SymbolicTerm(1, ['k' => 1])
        ]);
        
        // Delta for next term in sequence 6 * sum i^2 (adding 6(k+1)^2 = 6k^2 + 12k + 6)
        $delta = new SymbolicExpression([
            new SymbolicTerm(6, ['k' => 2]),
            new SymbolicTerm(12, ['k' => 1]),
            new SymbolicTerm(6, [])
        ]);
        
        $invarianceValid = $invarianceProver->proveInvariance($rhsK, $delta, $pkPlus1);
        $this->assertTrue($invarianceValid, "E2E: Structural invariance failed for Sum(i^2).");
        
        // 4. Absolute Closure Formulator
        $pkEquation = new SymbolicEquation(
            new SymbolicExpression([new SymbolicTerm(1, ['k' => 1])]), // dummy
            "=",
            $rhsK
        );
        $pkPlus1Equation = new SymbolicEquation(
            new SymbolicExpression([new SymbolicTerm(1, ['k' => 2])]), // dummy
            "=",
            $pkPlus1
        );
        
        $markdown = $formulator->formulateInductiveProof(
            "Proof that 6 * sum(i^2, 1..n) = 2n^3 + 3n^2 + n",
            $equation,
            $baseValid,
            $pkEquation,
            $pkPlus1Equation,
            $invarianceValid
        );
        
        $this->assertStringContainsString("Absolute Closure", $markdown);
        $this->assertStringContainsString("Proof that 6 * sum(i^2, 1..n) = 2n^3 + 3n^2 + n", $markdown);
    }

    public function testEndToEndInductiveSynthesisSumOfCubes()
    {
        // Prove that 4 * sum(i^3 from 1 to n) = n^4 + 2n^3 + n^2
        
        $baseGenerator = new BaseCaseGenerator($this->registry);
        $universalConstructor = new UniversalScalingConstructor($this->registry);
        $invarianceProver = new StructuralInvarianceProver($this->registry);
        $formulator = new AbsoluteClosureFormulator($this->registry);

        // 1. Base Case Generator (n = 1)
        // LHS: 1^4 + 2(1)^3 + 1^2 = 4
        $lhs = new SymbolicExpression([
            new SymbolicTerm(1, ['n' => 4]),
            new SymbolicTerm(2, ['n' => 3]),
            new SymbolicTerm(1, ['n' => 2])
        ]);
        
        // RHS: 4 (since 4 * 1^3 = 4)
        $rhs = new SymbolicExpression([
            new SymbolicTerm(4, [])
        ]);
        
        $equation = new SymbolicEquation($lhs, "=", $rhs);
        
        $baseValid = $baseGenerator->evaluateBaseCase($equation, 'n', 1);
        $this->assertTrue($baseValid, "E2E: Base case failed for Sum(i^3).");

        // 2. Universal Scaling Constructor (n -> k + 1)
        // P(k): k^4 + 2k^3 + k^2
        $expr = new SymbolicExpression([
            new SymbolicTerm(1, ['n' => 4]),
            new SymbolicTerm(2, ['n' => 3]),
            new SymbolicTerm(1, ['n' => 2])
        ]);
        
        $replacement = new SymbolicExpression([
            new SymbolicTerm(1, ['k' => 1]),
            new SymbolicTerm(1, [])
        ]);
        
        $pkPlus1Raw = $universalConstructor->scaleVariable($expr, 'n', $replacement);
        
        $arithmetic = new PeanoArithmeticEngine($this->registry);
        $pkPlus1 = $arithmetic->addExpressions($pkPlus1Raw, new SymbolicExpression([]));
        
        // 3. Structural Invariance Prover
        $rhsK = new SymbolicExpression([
            new SymbolicTerm(1, ['k' => 4]),
            new SymbolicTerm(2, ['k' => 3]),
            new SymbolicTerm(1, ['k' => 2])
        ]);
        
        // Delta for next term in sequence 4 * sum i^3 (adding 4(k+1)^3 = 4k^3 + 12k^2 + 12k + 4)
        $delta = new SymbolicExpression([
            new SymbolicTerm(4, ['k' => 3]),
            new SymbolicTerm(12, ['k' => 2]),
            new SymbolicTerm(12, ['k' => 1]),
            new SymbolicTerm(4, [])
        ]);
        
        $invarianceValid = $invarianceProver->proveInvariance($rhsK, $delta, $pkPlus1);
        $this->assertTrue($invarianceValid, "E2E: Structural invariance failed for Sum(i^3).");
    }

    public function testEndToEndInductiveSynthesisSumOfOddNumbers()
    {
        // Prove that sum(2i - 1 from 1 to n) = n^2
        
        $baseGenerator = new BaseCaseGenerator($this->registry);
        $universalConstructor = new UniversalScalingConstructor($this->registry);
        $invarianceProver = new StructuralInvarianceProver($this->registry);
        $formulator = new AbsoluteClosureFormulator($this->registry);

        // 1. Base Case (n = 1) -> 1^2 = 1
        $lhs = new SymbolicExpression([
            new SymbolicTerm(1, ['n' => 2])
        ]);
        $rhs = new SymbolicExpression([
            new SymbolicTerm(1, [])
        ]);
        
        $equation = new SymbolicEquation($lhs, "=", $rhs);
        $baseValid = $baseGenerator->evaluateBaseCase($equation, 'n', 1);
        $this->assertTrue($baseValid, "E2E: Base case failed for Sum(2i - 1).");

        // 2. Universal Scaling Constructor (n -> k + 1)
        // P(k): k^2
        $expr = new SymbolicExpression([
            new SymbolicTerm(1, ['n' => 2])
        ]);
        
        $replacement = new SymbolicExpression([
            new SymbolicTerm(1, ['k' => 1]),
            new SymbolicTerm(1, [])
        ]);
        
        $pkPlus1Raw = $universalConstructor->scaleVariable($expr, 'n', $replacement);
        $arithmetic = new PeanoArithmeticEngine($this->registry);
        $pkPlus1 = $arithmetic->addExpressions($pkPlus1Raw, new SymbolicExpression([]));
        
        // 3. Structural Invariance Prover
        $rhsK = new SymbolicExpression([
            new SymbolicTerm(1, ['k' => 2])
        ]);
        
        // Delta for next term in sequence sum (2i - 1) is 2(k+1) - 1 = 2k + 1
        $delta = new SymbolicExpression([
            new SymbolicTerm(2, ['k' => 1]),
            new SymbolicTerm(1, [])
        ]);
        
        $invarianceValid = $invarianceProver->proveInvariance($rhsK, $delta, $pkPlus1);
        $this->assertTrue($invarianceValid, "E2E: Structural invariance failed for Sum(2i - 1).");
    }

    public function testBaseCaseGeneratorFailure()
    {
        $generator = new BaseCaseGenerator($this->registry);
        
        // P(n): n^2 + n = 5 (Incorrect base case for n=1)
        $lhs = new SymbolicExpression([
            new SymbolicTerm(1, ['n' => 2]),
            new SymbolicTerm(1, ['n' => 1])
        ]);
        
        $rhs = new SymbolicExpression([
            new SymbolicTerm(5, [])
        ]);
        
        $equation = new SymbolicEquation($lhs, "=", $rhs);
        
        $isValid = $generator->evaluateBaseCase($equation, 'n', 1);
        $this->assertFalse($isValid, "Base case generator should fail when 1^2 + 1 != 5");
    }

    public function testStructuralInvarianceProverFailure()
    {
        $prover = new StructuralInvarianceProver($this->registry);
        
        // Let's provide an incorrect delta to make it fail
        $rhsK = new SymbolicExpression([
            new SymbolicTerm(1, ['k' => 2])
        ]); // k^2
        
        $incorrectDelta = new SymbolicExpression([
            new SymbolicTerm(1, ['k' => 1])
        ]); // + k
        
        $rhsKPlus1 = new SymbolicExpression([
            new SymbolicTerm(1, ['k' => 2]),
            new SymbolicTerm(2, ['k' => 1]),
            new SymbolicTerm(1, [])
        ]); // (k+1)^2 = k^2 + 2k + 1
        
        // k^2 + k != k^2 + 2k + 1
        $isValid = $prover->proveInvariance($rhsK, $incorrectDelta, $rhsKPlus1);
        
        $this->assertFalse($isValid, "Prover should fail when structural invariance is broken");
    }

    public function testUniversalScalingHigherDegree()
    {
        $constructor = new UniversalScalingConstructor($this->registry);
        
        // P(n): n^5
        $expr = new SymbolicExpression([
            new SymbolicTerm(1, ['n' => 5])
        ]);
        
        // Replacement: k + 1
        $replacement = new SymbolicExpression([
            new SymbolicTerm(1, ['k' => 1]),
            new SymbolicTerm(1, [])
        ]);
        
        $scaledExpr = $constructor->scaleVariable($expr, 'n', $replacement);
        
        // Expand using Peano Arithmetic
        $arithmetic = new PeanoArithmeticEngine($this->registry);
        $scaledExpr = $arithmetic->addExpressions($scaledExpr, new SymbolicExpression([]));
        
        // Expected: (k+1)^5 = k^5 + 5k^4 + 10k^3 + 10k^2 + 5k + 1
        $expected = new SymbolicExpression([
            new SymbolicTerm(1, ['k' => 5]),
            new SymbolicTerm(5, ['k' => 4]),
            new SymbolicTerm(10, ['k' => 3]),
            new SymbolicTerm(10, ['k' => 2]),
            new SymbolicTerm(5, ['k' => 1]),
            new SymbolicTerm(1, [])
        ]);
        
        $difference = $arithmetic->subtractExpressions($scaledExpr, $expected);
        $this->assertEquals("0", (string)$difference, "Scaling constructor failed on n^5 -> (k+1)^5");
    }

    public function testAbsoluteClosureFormulatorFailure()
    {
        $formulator = new AbsoluteClosureFormulator($this->registry);
        
        $dummyEq = new SymbolicEquation(
            new SymbolicExpression([]), "=", new SymbolicExpression([])
        );
        
        // Simulating a failed base case
        $markdown = $formulator->formulateInductiveProof(
            "Broken Proof",
            $dummyEq,
            false,
            $dummyEq,
            $dummyEq,
            true
        );
        
        $this->assertStringContainsString("**FAILED**: The base case is structurally invalid.", $markdown);
        
        // Simulating a failed inductive step
        $markdown2 = $formulator->formulateInductiveProof(
            "Broken Proof 2",
            $dummyEq,
            true,
            $dummyEq,
            $dummyEq,
            false
        );
        
        $this->assertStringContainsString("**FAILED**: The structural invariance proof collapsed.", $markdown2);
    }
}
