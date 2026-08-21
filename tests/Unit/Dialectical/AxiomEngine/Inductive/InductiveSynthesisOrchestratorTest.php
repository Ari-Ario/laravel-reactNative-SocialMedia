<?php

namespace Tests\Unit\Dialectical\AxiomEngine\Inductive;

use Tests\TestCase;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicTerm;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicExpression;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicEquation;
use App\Services\Dialectical\AxiomEngine\Inductive\InductiveSynthesisOrchestrator;
use App\Services\Dialectical\AxiomEngine\AxiomRegistry;

class InductiveSynthesisOrchestratorTest extends TestCase
{
    private AxiomRegistry $registry;
    private InductiveSynthesisOrchestrator $orchestrator;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->registry = $this->createMock(\App\Services\Dialectical\AxiomEngine\AxiomRegistry::class);
        $this->registry->method('getAxiom')->willReturn(null);
        
        $this->orchestrator = new InductiveSynthesisOrchestrator($this->registry);
    }

    public function testOrchestrateGaussSummation()
    {
        // P(n): 2 * sum(1..n) = n^2 + n
        // LHS base: 1^2 + 1^1 = 2
        $lhs = new SymbolicExpression([
            new SymbolicTerm(1, ['n' => 2]),
            new SymbolicTerm(1, ['n' => 1])
        ]);
        
        // RHS base: 2
        $rhs = new SymbolicExpression([
            new SymbolicTerm(2, [])
        ]);
        
        $equation = new SymbolicEquation($lhs, "=", $rhs);
        
        // P(n) RHS pattern = n^2 + n
        $hypothesisRhs = new SymbolicExpression([
            new SymbolicTerm(1, ['n' => 2]),
            new SymbolicTerm(1, ['n' => 1])
        ]);

        // Delta for 2(k+1) = 2k + 2
        $delta = new SymbolicExpression([
            new SymbolicTerm(2, ['k' => 1]),
            new SymbolicTerm(2, [])
        ]);

        $result = $this->orchestrator->orchestrate(
            "Proof that 2 * sum(1..n) = n^2 + n",
            $equation,
            $hypothesisRhs,
            'n',
            1,
            $delta
        );

        $this->assertTrue($result['success'], "Orchestrator failed to prove Gauss summation");
        $this->assertStringContainsString("Absolute Closure", $result['markdown']);
    }

    public function testOrchestrateBaseCaseFailure()
    {
        // Incorrect P(n): 2 * sum(1..n) = n^2 + 5n
        // LHS base: 1^2 + 1 = 2
        $lhs = new SymbolicExpression([
            new SymbolicTerm(1, ['n' => 2]),
            new SymbolicTerm(1, ['n' => 1])
        ]);
        
        // RHS base incorrect: 6 (1^2 + 5*1)
        $rhs = new SymbolicExpression([
            new SymbolicTerm(6, [])
        ]);
        
        $equation = new SymbolicEquation($lhs, "=", $rhs);
        
        $hypothesisRhs = new SymbolicExpression([
            new SymbolicTerm(1, ['n' => 2]),
            new SymbolicTerm(5, ['n' => 1])
        ]);

        $delta = new SymbolicExpression([
            new SymbolicTerm(2, ['k' => 1]),
            new SymbolicTerm(2, [])
        ]);

        $result = $this->orchestrator->orchestrate(
            "Proof that fails at base case",
            $equation,
            $hypothesisRhs,
            'n',
            1,
            $delta
        );

        $this->assertFalse($result['success'], "Orchestrator should fail the base case");
        $this->assertStringContainsString("FAILED", $result['markdown']);
    }

    public function testOrchestrateSumOfFirstNOddNumbers()
    {
        // P(n): sum(2k-1) from 1 to n = n^2
        // Base case n=1: LHS = 1, RHS = 1^2 = 1
        $lhs = new SymbolicExpression([
            new SymbolicTerm(1, [])
        ]);
        
        $rhs = new SymbolicExpression([
            new SymbolicTerm(1, [])
        ]);
        
        $equation = new SymbolicEquation($lhs, "=", $rhs);
        
        // Hypothesis RHS: n^2
        $hypothesisRhs = new SymbolicExpression([
            new SymbolicTerm(1, ['n' => 2])
        ]);

        // Delta for sum of odd numbers at k+1 is 2(k+1)-1 = 2k + 1
        $delta = new SymbolicExpression([
            new SymbolicTerm(2, ['k' => 1]),
            new SymbolicTerm(1, [])
        ]);

        $result = $this->orchestrator->orchestrate(
            "Proof that sum of first n odd numbers is n^2",
            $equation,
            $hypothesisRhs,
            'n',
            1,
            $delta
        );

        $this->assertTrue($result['success'], "Orchestrator failed to prove Sum of First N Odd Numbers");
        $this->assertStringContainsString("Absolute Closure", $result['markdown']);
    }
}
