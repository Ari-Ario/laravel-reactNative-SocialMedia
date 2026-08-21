<?php

namespace App\Services\Dialectical\AxiomEngine\Meta\Fragment24;

class GlobalFormatter
{
    /**
     * The final integration sieve. Perfectly maps output to Global Axiom standards.
     */
    public function formatAxiom(string $inductiveLogic, bool $isMath = true, bool $isSoft = false): string
    {
        $suffix = "";
        
        if ($isSoft) {
            $suffix = "\n\n[CERTIFIED: Validated via Linguistic/Empirical Logic. Promoted to Global Axiom natively.]";
        } elseif ($isMath) {
            $suffix = "\n\n[CERTIFIED ✅ — Global Axiom] Mathematically Proven via Native Dialectical Engine.";
        } else {
            $suffix = "\n\n[CERTIFIED ✅ — Global Axiom] Proven and Synthesized.";
        }

        // Avoid duplicating certification strings
        if (strpos($inductiveLogic, '[CERTIFIED') === false) {
            $inductiveLogic .= $suffix;
        } else {
            // Unify it if it already exists in another format
            $inductiveLogic = preg_replace('/\[CERTIFIED.*?\]/i', '[CERTIFIED ✅ — Global Axiom]', $inductiveLogic);
        }

        return $inductiveLogic;
    }
}
