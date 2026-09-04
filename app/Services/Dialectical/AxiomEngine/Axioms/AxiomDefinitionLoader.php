<?php

namespace App\Services\Dialectical\AxiomEngine\Axioms;

class AxiomDefinitionLoader
{
    private static array $cache = [];

    /**
     * Load the dialectical axiom definitions for a given domain/solver.
     *
     * @param string $domain The configuration file name (e.g. 'computational_logic')
     * @return array
     */
    public static function load(string $domain): array
    {
        if (isset(self::$cache[$domain])) {
            return self::$cache[$domain];
        }

        $path = app_path("Services/Dialectical/AxiomEngine/Axioms/Definitions/{$domain}.php");
        
        if (file_exists($path)) {
            $axioms = require $path;
            self::$cache[$domain] = $axioms;
            return $axioms;
        }

        return [];
    }
}
