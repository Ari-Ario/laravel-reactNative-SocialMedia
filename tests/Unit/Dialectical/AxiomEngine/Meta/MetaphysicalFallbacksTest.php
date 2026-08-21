<?php

namespace Tests\Unit\Dialectical\AxiomEngine\Meta;

use Tests\TestCase;
use App\Services\DialecticalSynthesisEngine;
use App\Services\Dialectical\AxiomEngine\Meta\Fragment21\UndecidabilityRecognizer;
use App\Services\Dialectical\AxiomEngine\Meta\Fragment22\MillenniumDynamicsRecognizer;
use App\Services\Dialectical\AxiomEngine\Meta\Fragment23\DialecticLeapSynthesisEngine;
use App\Services\Dialectical\AxiomEngine\Meta\Fragment24\GlobalFormatter;
use App\Services\Dialectical\Semantic\SemanticEngine;
use App\Services\DialecticalOracleService;
use Illuminate\Support\Facades\DB;
use App\Models\KnowledgeAxiom;
use Mockery;

class MetaphysicalFallbacksTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_undecidability_recognizer()
    {
        $mockSemanticEngine = Mockery::mock(SemanticEngine::class);
        $mockSemanticEngine->shouldReceive('query')->andReturn([
            ['id' => 1, 'similarity' => 0.9]
        ]);
        $this->app->instance(SemanticEngine::class, $mockSemanticEngine);

        $mockAxiom = new \stdClass();
        $mockAxiom->id = 1;
        $mockAxiom->thesis_statement = "Gödel Incompleteness Theorem";

        DB::shouldReceive('table')->with('knowledge_axioms')->andReturnSelf();
        DB::shouldReceive('find')->with(1)->andReturn($mockAxiom);

        $recognizer = app(UndecidabilityRecognizer::class);
        $result = $recognizer->evaluateUndecidability("Is mathematics complete?", "The sequence halted due to Gödel Incompleteness");

        $this->assertNotNull($result);
        $this->assertFalse($result['is_valid']);
        $this->assertStringContainsString('HALTED: Undecidable Mathematical/Logical Structure Detected', $result['proof_details']);
    }

    public function test_millennium_dynamics_recognizer()
    {
        $mockOracle = Mockery::mock(DialecticalOracleService::class);
        $mockOracle->shouldReceive('isUnsolvedProblem')->andReturn(true);
        $this->app->instance(DialecticalOracleService::class, $mockOracle);

        $recognizer = app(MillenniumDynamicsRecognizer::class);
        $result = $recognizer->evaluateMillenniumDynamics("Prove P vs NP", "We try to reduce 3-SAT to 2-SAT");

        $this->assertNotNull($result);
        $this->assertTrue($result['is_valid']);
        $this->assertStringContainsString('[CERTIFIED: Creative Proof Bridging Applied', $result['proof_details']);
    }

    public function test_dialectic_leap_synthesis_engine()
    {
        $mockCoreEngine = Mockery::mock(DialecticalSynthesisEngine::class);
        $mockCoreEngine->shouldReceive('evaluateSynthesis')->andReturn([
            'is_valid' => true,
            'confidence' => 0.99,
            'proof_details' => 'Phase 3: Total Inductive System'
        ]);
        $this->app->instance(DialecticalSynthesisEngine::class, $mockCoreEngine);

        $engine = app(DialecticLeapSynthesisEngine::class);
        $thesis = "The universe is expanding infinitely but it also contradicts absolute zero.";
        $result = $engine->synthesize($thesis);

        $this->assertNotNull($result);
        $this->assertTrue($result['is_valid']);
        $this->assertStringContainsString('Phase 3: Total Inductive System', $result['proof_details']);
    }

    public function test_global_formatter()
    {
        $formatter = new GlobalFormatter();
        $mathFormat = $formatter->formatAxiom("Testing inductive logic", true, false);
        $this->assertStringContainsString('[CERTIFIED ✅ — Global Axiom] Mathematically Proven', $mathFormat);

        $softFormat = $formatter->formatAxiom("Testing inductive logic", false, true);
        $this->assertStringContainsString('[CERTIFIED: Validated via Linguistic/Empirical Logic.', $softFormat);
    }
}
