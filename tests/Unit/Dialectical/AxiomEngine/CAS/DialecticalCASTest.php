<?php

namespace Tests\Unit\Dialectical\AxiomEngine\CAS;

use PHPUnit\Framework\TestCase;
use App\Services\Dialectical\AxiomEngine\AxiomRegistry;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicExpression;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicTerm;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment3\PeanoArithmeticEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment4\UniversalPowerEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment5\CalculusRadicalEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment6\PropositionalLogicEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment7\FirstOrderModalEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment8\ZfcSetTheoryEngine;

class DialecticalCASTest extends TestCase
{
    private AxiomRegistry $registry;

    protected function setUp(): void
    {
        parent::setUp();
        // Mock AxiomRegistry to bypass DB/DynamicAxiomCompiler dependencies
        $this->registry = $this->createMock(AxiomRegistry::class);
    }

    public function test_fragment3_peano_arithmetic()
    {
        $engine = new PeanoArithmeticEngine($this->registry);

        // Represent 3x^2
        $expr1 = new SymbolicExpression();
        $expr1->addTerm(new SymbolicTerm(3, ['x' => 2]));

        // Represent 2x^2 + 4y
        $expr2 = new SymbolicExpression();
        $expr2->addTerm(new SymbolicTerm(2, ['x' => 2]));
        $expr2->addTerm(new SymbolicTerm(4, ['y' => 1]));

        // Add expressions: (3x^2) + (2x^2 + 4y) = 5x^2 + 4y
        $sum = $engine->addExpressions($expr1, $expr2);

        $this->assertCount(2, $sum->terms);
        // Using toString for quick verification
        $this->assertEquals('5x^2', (string)$sum->terms[0] === '5x^2' || (string)$sum->terms[1] === '5x^2' ? '5x^2' : 'fail');
        $this->assertEquals('4y', (string)$sum->terms[0] === '4y' || (string)$sum->terms[1] === '4y' ? '4y' : 'fail');

        // Subtract expressions: (3x^2) - (2x^2 + 4y) = x^2 - 4y
        $diff = $engine->subtractExpressions($expr1, $expr2);
        $this->assertCount(2, $diff->terms);
        
        // Multiply expressions: (3x^2) * (2x^2 + 4y) = 6x^4 + 12x^2*y
        $prod = $engine->multiplyExpressions($expr1, $expr2);
        $this->assertCount(2, $prod->terms);
    }

    public function test_fragment4_universal_power()
    {
        $engine = new UniversalPowerEngine($this->registry);

        // Represent (2x)^3
        $term = new SymbolicTerm(2, ['x' => 1]);
        $expr = new SymbolicExpression();
        $expr->addTerm($term);
        
        // 8x^3
        $result = $engine->expandExpressionToPower($expr, 3);
        $this->assertCount(1, $result->terms);
        $this->assertEquals(8, $result->terms[0]->coefficient);
        $this->assertEquals(['x' => 3], $result->terms[0]->variables);
    }

    public function test_fragment5_calculus_derivatives()
    {
        $engine = new CalculusRadicalEngine($this->registry);

        // Represent 5x^3 + 2x^2 + 4
        $expr = new SymbolicExpression();
        $expr->addTerm(new SymbolicTerm(5, ['x' => 3]));
        $expr->addTerm(new SymbolicTerm(2, ['x' => 2]));
        $expr->addTerm(new SymbolicTerm(4, [])); // constant

        // d/dx = 15x^2 + 4x
        $derivative = $engine->differentiate($expr, 'x');

        $this->assertCount(2, $derivative->terms);
    }

    public function test_fragment6_propositional_logic()
    {
        $engine = new PropositionalLogicEngine($this->registry);

        // A OR NOT A => Tautology
        $isTautology = $engine->isTautology(['A'], function($state) use ($engine) {
            return $engine->evaluateGate('OR', $state['A'], $engine->evaluateGate('NOT', $state['A']));
        });

        $this->assertTrue($isTautology);
    }

    public function test_fragment7_first_order_modal()
    {
        $engine = new FirstOrderModalEngine($this->registry);

        // ∀x ∈ {1,2,3}, x > 0
        $forAll = $engine->forAll('x', [1, 2, 3], function($state) {
            return $state['x'] > 0;
        });
        $this->assertTrue($forAll);
        
        // ∃x ∈ {1,2,3}, x == 2
        $exists = $engine->exists('x', [1, 2, 3], function($state) {
            return $state['x'] == 2;
        });
        $this->assertTrue($exists);
    }

    public function test_fragment8_zfc_set_theory()
    {
        $engine = new ZfcSetTheoryEngine($this->registry);

        $setA = [1, 2, 3];
        $setB = [3, 4, 5];

        $this->assertEquals([1, 2, 3, 4, 5], array_values($engine->union($setA, $setB)));
        $this->assertEquals([3], array_values($engine->intersection($setA, $setB)));
        $this->assertEquals([1, 2], array_values($engine->difference($setA, $setB)));
        
        $this->assertCount(8, $engine->powerSet($setA)); // 2^3 = 8
    }

    public function test_fragment3_peano_arithmetic_exhaustive()
    {
        $engine = new PeanoArithmeticEngine($this->registry);

        // Test Zero Addition/Subtraction/Multiplication
        $zero = new SymbolicExpression();
        $expr = new SymbolicExpression([new SymbolicTerm(5, ['x' => 2])]);
        
        $sumZero = $engine->addExpressions($expr, $zero);
        $this->assertCount(1, $sumZero->terms);
        $this->assertEquals(5, $sumZero->terms[0]->coefficient);

        $diffZero = $engine->subtractExpressions($expr, $zero);
        $this->assertCount(1, $diffZero->terms);
        
        $prodZero = $engine->multiplyExpressions($expr, $zero);
        $this->assertCount(0, $prodZero->terms);

        // Test Multi-Variable Arithmetic
        // (2x + 3y) * (x - y) = 2x^2 + xy - 3y^2
        $exprA = new SymbolicExpression([
            new SymbolicTerm(2, ['x' => 1]),
            new SymbolicTerm(3, ['y' => 1])
        ]);
        $exprB = new SymbolicExpression([
            new SymbolicTerm(1, ['x' => 1]),
            new SymbolicTerm(-1, ['y' => 1])
        ]);
        
        $prodMultivar = $engine->multiplyExpressions($exprA, $exprB);
        $this->assertCount(3, $prodMultivar->terms);
    }

    public function test_fragment4_universal_power_exhaustive()
    {
        $engine = new UniversalPowerEngine($this->registry);

        // Test binomial expansion: (x + 2)^3 = x^3 + 6x^2 + 12x + 8
        $expr = new SymbolicExpression([
            new SymbolicTerm(1, ['x' => 1]),
            new SymbolicTerm(2, [])
        ]);
        
        $expanded = $engine->expandExpressionToPower($expr, 3);
        $this->assertCount(4, $expanded->terms);
        
        // Zero Power
        $zeroPower = $engine->expandExpressionToPower($expr, 0);
        $this->assertCount(1, $zeroPower->terms);
        $this->assertEquals(1, $zeroPower->terms[0]->coefficient);
        $this->assertEmpty($zeroPower->terms[0]->variables);
    }

    public function test_fragment5_calculus_multi_variable()
    {
        $engine = new CalculusRadicalEngine($this->registry);

        // f(x,y) = 3x^2y + 4xy^2 + x^3
        $expr = new SymbolicExpression([
            new SymbolicTerm(3, ['x' => 2, 'y' => 1]),
            new SymbolicTerm(4, ['x' => 1, 'y' => 2]),
            new SymbolicTerm(1, ['x' => 3])
        ]);

        // df/dx = 6xy + 4y^2 + 3x^2
        $dfdx = $engine->differentiate($expr, 'x');
        $this->assertCount(3, $dfdx->terms);

        // df/dy = 3x^2 + 8xy
        $dfdy = $engine->differentiate($expr, 'y');
        $this->assertCount(2, $dfdy->terms);
        
        // d/dz of f(x,y) = 0
        $dfdz = $engine->differentiate($expr, 'z');
        $this->assertCount(0, $dfdz->terms);
    }
}
