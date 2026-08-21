<?php

namespace App\Services\Dialectical\Semantic;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class DatasetIngestionService
{
    /**
     * Reads a LLaMA-Factory formatted JSONL file and converts it into the PHP-ML training corpus format.
     * Expects each line to be JSON with "instruction" (the text) and "output" (the domain label).
     */
    public static function ingestJsonl(string $filePath): array
    {
        if (!file_exists($filePath)) {
            Log::warning("JSONL dataset not found at {$filePath}. Falling back to default array.");
            return [];
        }

        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $corpus = [];

        foreach ($lines as $line) {
            $data = json_decode($line, true);
            if (isset($data['instruction']) && isset($data['output'])) {
                // Incorporate 'input' context if it exists (like LLaMA-Factory)
                $text = $data['instruction'];
                if (!empty($data['input'])) {
                    $text .= " " . $data['input'];
                }
                
                $corpus[] = [
                    $text,
                    $data['output']
                ];
            }
        }

        return $corpus;
    }
    
    /**
     * Helper to append to the JSONL dataset programmatically (used by Expert Training hub).
     */
    public static function appendToJsonl(string $filePath, string $instruction, string $output, string $input = ""): void
    {
        $entry = json_encode([
            "instruction" => $instruction,
            "input" => $input,
            "output" => $output
        ]);
        
        file_put_contents($filePath, $entry . PHP_EOL, FILE_APPEND);
    }
}
