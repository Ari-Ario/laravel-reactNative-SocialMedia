<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Fragment3;

use App\Services\Dialectical\AxiomEngine\CAS\AbstractSymbolicEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicExpression;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicTerm;

class PeanoArithmeticEngine extends AbstractSymbolicEngine
{
    private PeanoSuccessorLogic $peanoLogic;

    public function __construct(\App\Services\Dialectical\AxiomEngine\AxiomRegistry $registry)
    {
        parent::__construct($registry);
        $this->peanoLogic = new PeanoSuccessorLogic();
    }

    public function ingest(array $astNode): SymbolicExpression
    {
        // In a real flow, this would parse the MathematicalAST JSON nodes.
        // For now, we will return an empty expression, as AST construction 
        // will be tested directly with objects.
        return new SymbolicExpression();
    }

    /**
     * Adds two expressions by concatenating their terms and simplifying.
     */
    public function addExpressions(SymbolicExpression $expr1, SymbolicExpression $expr2): SymbolicExpression
    {
        $result = new SymbolicExpression();
        foreach ($expr1->terms as $term) {
            $result->addTerm($term);
        }
        foreach ($expr2->terms as $term) {
            $result->addTerm($term);
        }
        return $this->simplifyExpression($result);
    }

    /**
     * Subtracts expr2 from expr1 symbolically.
     */
    public function subtractExpressions(SymbolicExpression $expr1, SymbolicExpression $expr2): SymbolicExpression
    {
        $result = clone $expr1;
        foreach ($expr2->terms as $term) {
            $negatedTerm = new SymbolicTerm(
                $this->peanoLogic->negate($term->coefficient), 
                $term->variables
            );
            $result->addTerm($negatedTerm);
        }
        return $this->simplifyExpression($result);
    }

    /**
     * Distributes (multiplies) two expressions via Cartesian product.
     */
    public function multiplyExpressions(SymbolicExpression $expr1, SymbolicExpression $expr2): SymbolicExpression
    {
        $result = new SymbolicExpression();
        
        foreach ($expr1->terms as $term1) {
            foreach ($expr2->terms as $term2) {
                $result->addTerm($this->multiplyTerms($term1, $term2));
            }
        }
        
        return $this->simplifyExpression($result);
    }

    /**
     * Groups like-terms dynamically and evaluates their coefficients via Peano addition.
     */
    public function simplifyExpression(SymbolicExpression $expr): SymbolicExpression
    {
        $grouped = [];
        
        foreach ($expr->terms as $term) {
            $varSig = $this->generateVariableSignature($term->variables);
            if (!isset($grouped[$varSig])) {
                $grouped[$varSig] = new SymbolicTerm(0, $term->variables);
            }
            
            // Symbolic addition via Peano Axioms
            $grouped[$varSig]->coefficient = $this->peanoLogic->add(
                $grouped[$varSig]->coefficient, 
                $term->coefficient
            );
        }

        $result = new SymbolicExpression();
        foreach ($grouped as $term) {
            if ($term->coefficient !== 0) {
                $result->addTerm($term);
            }
        }
        
        return $result;
    }
    
    private function multiplyTerms(SymbolicTerm $term1, SymbolicTerm $term2): SymbolicTerm
    {
        // 1. Multiply coefficients via Peano Recursion
        $newCoeff = $this->peanoLogic->multiply($term1->coefficient, $term2->coefficient);
        
        // 2. Add exponents of like variables via Peano Addition
        $newVars = $term1->variables;
        foreach ($term2->variables as $var => $exp) {
            if (isset($newVars[$var])) {
                $newVars[$var] = $this->peanoLogic->add($newVars[$var], $exp);
            } else {
                $newVars[$var] = $exp;
            }
        }
        
        return new SymbolicTerm($newCoeff, $newVars);
    }
    
    private function generateVariableSignature(array $variables): string
    {
        if (empty($variables)) {
            return 'SCALAR';
        }
        $parts = [];
        foreach ($variables as $v => $exp) {
            $parts[] = $v . '^' . $exp;
        }
        return implode('*', $parts);
    }
}
