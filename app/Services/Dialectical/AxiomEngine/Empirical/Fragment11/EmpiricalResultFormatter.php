<?php

namespace App\Services\Dialectical\AxiomEngine\Empirical\Fragment11;

class EmpiricalResultFormatter
{
    /**
     * Converts a Boolean empirical result matrix into a Markdown Truth Table.
     * Output format is LaTeX/Markdown compatible.
     */
    public function formatTruthTable(array $empiricalData, string $resultHeader = 'Result'): string
    {
        $matrix = $empiricalData['matrix'];
        if (empty($matrix)) {
            return "No empirical data to format.";
        }
        
        $variables = array_keys($matrix[0]['state']);
        
        // Build Markdown Table Header
        $headerLine = "| " . implode(" | ", $variables) . " | $resultHeader |\n";
        $separatorLine = "|" . str_repeat("---|", count($variables) + 1) . "\n";
        
        $markdown = $headerLine . $separatorLine;
        
        // Build Rows
        foreach ($matrix as $row) {
            $stateCells = [];
            foreach ($variables as $var) {
                // Map boolean true/false to T/F
                $stateCells[] = $row['state'][$var] ? 'T' : 'F';
            }
            
            $resultCell = $row['result'] ? 'T' : 'F';
            
            $markdown .= "| " . implode(" | ", $stateCells) . " | $resultCell |\n";
        }
        
        return $markdown;
    }

    /**
     * Converts a Numerical empirical result matrix into a generic Markdown table.
     */
    public function formatNumericalTable(array $empiricalData, string $resultHeader = 'f(x)'): string
    {
        $matrix = $empiricalData['matrix'];
        if (empty($matrix)) {
            return "No empirical data to format.";
        }
        
        $variables = array_keys($matrix[0]['state']);
        
        // Build Markdown Table Header
        $headerLine = "| " . implode(" | ", $variables) . " | $resultHeader |\n";
        $separatorLine = "|" . str_repeat("---|", count($variables) + 1) . "\n";
        
        $markdown = $headerLine . $separatorLine;
        
        // Build Rows
        foreach ($matrix as $row) {
            $stateCells = [];
            foreach ($variables as $var) {
                $stateCells[] = $row['state'][$var];
            }
            
            // Format result (could be int, float, array, etc)
            $resultVal = $row['result'];
            if (is_bool($resultVal)) {
                $resultStr = $resultVal ? 'True' : 'False';
            } elseif (is_array($resultVal)) {
                $resultStr = json_encode($resultVal);
            } else {
                $resultStr = (string) $resultVal;
            }
            
            $markdown .= "| " . implode(" | ", $stateCells) . " | $resultStr |\n";
        }
        
        return $markdown;
    }
}
