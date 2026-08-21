<?php

namespace App\Services\Dialectical\AxiomEngine\Meta\Fragment23;

use App\Services\DialecticalSynthesisEngine;

class DialecticLeapSynthesisEngine
{
    private DialecticalSynthesisEngine $coreSynthesisEngine;

    public function __construct()
    {
        // Delegates to the globally imported engine to prevent breaking other science branches
        $this->coreSynthesisEngine = app(DialecticalSynthesisEngine::class);
    }

    /**
     * Attempts a Dialectic Leap (Aufheben) for contradictions.
     */
    public function synthesize(string $thesis): ?array
    {
        return $this->coreSynthesisEngine->evaluateSynthesis($thesis);
    }
}
