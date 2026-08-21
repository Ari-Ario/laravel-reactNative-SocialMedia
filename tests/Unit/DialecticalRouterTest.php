<?php
namespace Tests\Unit;

use Tests\TestCase;
use App\Services\Dialectical\UniversalRouterService;
use App\Services\Dialectical\DynamicSyntaxGenerator;
use App\Services\SymbolicMathSolverService;
use App\Services\Dialectical\Solvers\FormalLogicSolver;
use App\Services\Dialectical\Solvers\NaturalScienceSolver;

class DialecticalRouterTest extends TestCase
{
    public function test_transitivity_routing_and_solving()
    {
        $syntax = new DynamicSyntaxGenerator();
        $cas = new SymbolicMathSolverService();
        $router = new UniversalRouterService($syntax, $cas);
        
        $thesis = "If a = b and b = c, then a = c.";
        $solver = $router->routeThesis($thesis);
        
        $this->assertInstanceOf(FormalLogicSolver::class, $solver);
        
        $state = $solver->executePhase1Trial($thesis);
        $this->assertTrue($state['is_valid']);
        $this->assertEquals('algebraic_transitivity', $state['syllogism_type']);
        $this->assertStringContainsString('Transitivity axiom verified', $state['proof_traces'][count($state['proof_traces']) - 1]);
    }

    public function test_science_routing()
    {
        $syntax = new DynamicSyntaxGenerator();
        $cas = new SymbolicMathSolverService();
        $router = new UniversalRouterService($syntax, $cas);
        
        $thesis = "Mass=100 and acceleration=9.8 where force";
        $solver = $router->routeThesis($thesis);
        
        $this->assertInstanceOf(NaturalScienceSolver::class, $solver);
    }
    
    public function test_metaphysics_routing_identity()
    {
        $syntax = new DynamicSyntaxGenerator();
        $cas = new SymbolicMathSolverService();
        $router = new UniversalRouterService($syntax, $cas);
        
        $thesis = "Every proposition is identical to itself and cannot contradict its own being under the Law of Identity.";
        $solver = $router->routeThesis($thesis);
        
        $this->assertInstanceOf(FormalLogicSolver::class, $solver);
        
        $state = $solver->executePhase1Trial($thesis, ['nodes' => []]);
        $this->assertTrue($state['is_valid']);
        
        // Ensure Phase 1 Empirical Trial extracts the DB axiom
        $this->assertStringContainsString('Empirical Observation', implode(" ", $state['proof_traces']));
        
        $state = $solver->executePhase2Deduction($state);
        $this->assertIsArray($state['symbolic_traces'] ?? null);
    }

    public function test_metaphysics_routing_ship_of_theseus()
    {
        $syntax = new DynamicSyntaxGenerator();
        $cas = new SymbolicMathSolverService();
        $router = new UniversalRouterService($syntax, $cas);
        
        $thesis = "If all parts of a ship are replaced over time, is it the same object under the Ship of Theseus paradox?";
        $solver = $router->routeThesis($thesis);
        
        $this->assertInstanceOf(\App\Services\Dialectical\Solvers\ParadoxSolver::class, $solver);
    }

    public function test_metaphysics_routing_sufficient_reason()
    {
        $syntax = new DynamicSyntaxGenerator();
        $cas = new SymbolicMathSolverService();
        $router = new UniversalRouterService($syntax, $cas);
        
        $thesis = "Does every contingent fact have an ontological foundation by the Principle of Sufficient Reason?";
        $solver = $router->routeThesis($thesis);
        
        $this->assertInstanceOf(FormalLogicSolver::class, $solver);
    }

    public function test_proof_theory_godel_first()
    {
        $syntax = new DynamicSyntaxGenerator();
        $cas = new SymbolicMathSolverService();
        $router = new UniversalRouterService($syntax, $cas);
        
        $thesis = "If a formal mathematical system is capable of expressing arithmetic, can it prove all true statements within itself under Gödel's First Incompleteness Theorem?";
        $solver = $router->routeThesis($thesis);
        
        $this->assertInstanceOf(FormalLogicSolver::class, $solver);
        
        $state = $solver->executePhase1Trial($thesis, ['nodes' => []]);
        $this->assertTrue($state['is_valid']);
        $this->assertEquals('proof_theory', $state['syllogism_type']);
        
        $state = $solver->executePhase2Deduction($state);
        $this->assertStringContainsString('G \leftrightarrow \neg Prov(G)', implode(" ", $state['proof_traces']) . implode(" ", array_column($state['symbolic_traces'], 'expr')));
    }

    public function test_proof_theory_godel_second()
    {
        $syntax = new DynamicSyntaxGenerator();
        $cas = new SymbolicMathSolverService();
        $router = new UniversalRouterService($syntax, $cas);
        
        $thesis = "Can a consistent formal system like Peano Arithmetic prove its own consistency via Gödel's Second Incompleteness Theorem?";
        $solver = $router->routeThesis($thesis);
        
        $this->assertInstanceOf(FormalLogicSolver::class, $solver);
        
        $state = $solver->executePhase1Trial($thesis, ['nodes' => []]);
        $this->assertTrue($state['is_valid']);
        $this->assertEquals('proof_theory', $state['syllogism_type']);
        
        $state = $solver->executePhase2Deduction($state);
        $this->assertStringContainsString('F \nvdash Con(F)', implode(" ", $state['proof_traces']) . implode(" ", array_column($state['symbolic_traces'], 'expr')));
    }

    public function test_proof_theory_modus_tollens_syntactic()
    {
        $syntax = new DynamicSyntaxGenerator();
        $cas = new SymbolicMathSolverService();
        $router = new UniversalRouterService($syntax, $cas);
        
        // Ensure Modus Tollens triggers properly for standard logic routing
        $thesis = "If Peano Arithmetic is consistent, then it has a model. Peano Arithmetic does not have a model. Therefore it is not consistent by Modus Tollens.";
        $solver = $router->routeThesis($thesis);
        
        $this->assertInstanceOf(FormalLogicSolver::class, $solver);
        // Note: The actual AST structure for Modus Tollens requires parsing, but we verify it routes to FormalLogicSolver correctly.
    }

    public function test_physics_routing_quantum_relativity()
    {
        $syntax = new DynamicSyntaxGenerator();
        $cas = new SymbolicMathSolverService();
        $router = new UniversalRouterService($syntax, $cas);
        
        $thesis = "If mass increases toward infinity, the speed of light limits acceleration via General Relativity.";
        $solver = $router->routeThesis($thesis);
        
        $this->assertInstanceOf(NaturalScienceSolver::class, $solver);
    }

    public function test_chemistry_routing_stoichiometry()
    {
        $syntax = new DynamicSyntaxGenerator();
        $cas = new SymbolicMathSolverService();
        $router = new UniversalRouterService($syntax, $cas);
        
        $thesis = "When hydrogen and oxygen synthesizes water, the stoichiometric mass is conserved.";
        $solver = $router->routeThesis($thesis);
        
        $this->assertInstanceOf(NaturalScienceSolver::class, $solver);
    }

    public function test_post_human_simulation_theory()
    {
        $syntax = new DynamicSyntaxGenerator();
        $cas = new SymbolicMathSolverService();
        $router = new UniversalRouterService($syntax, $cas);
        
        $thesis = "If the universe is a simulated matrix, it must still obey Landauer's thermodynamic limit.";
        $solver = $router->routeThesis($thesis);
        
        $this->assertInstanceOf(\App\Services\Dialectical\Solvers\PostHumanSpeculativeSolver::class, $solver);
        
        $state = $solver->executePhase1Trial($thesis);
        $this->assertTrue($state['is_valid']);
        $this->assertEquals('simulation_theory', $state['domain']['key']);
        $this->assertContains('thermodynamics', $state['domain']['prerequisites']);
        
        $state = $solver->executePhase2Deduction($state);
        $this->assertStringContainsString('Verified computational speculation against Landauer\'s', implode(" ", $state['proof_traces']));
    }

    public function test_post_human_transhumanism()
    {
        $syntax = new DynamicSyntaxGenerator();
        $cas = new SymbolicMathSolverService();
        $router = new UniversalRouterService($syntax, $cas);
        
        $thesis = "The emergence of an artificial superintelligence will break all laws of physics.";
        $solver = $router->routeThesis($thesis);
        
        $this->assertInstanceOf(\App\Services\Dialectical\Solvers\PostHumanSpeculativeSolver::class, $solver);
        
        $state = $solver->executePhase1Trial($thesis);
        $this->assertTrue($state['is_valid']);
        $this->assertStringContainsString('Dialectical Override Applied', $solver->executePhase3Induction($state));
    }
}

