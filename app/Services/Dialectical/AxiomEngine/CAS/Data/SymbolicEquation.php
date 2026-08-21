<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Data;

class SymbolicEquation
{
    public SymbolicExpression $lhs;
    public SymbolicExpression $rhs;
    public string $operator; // e.g., '=', '<', '>', '<=', '>='

    public function __construct(SymbolicExpression $lhs, string $operator, SymbolicExpression $rhs)
    {
        $this->lhs = $lhs;
        $this->operator = $operator;
        $this->rhs = $rhs;
    }

    public function __toString(): string
    {
        return $this->lhs . ' ' . $this->operator . ' ' . $this->rhs;
    }
}
