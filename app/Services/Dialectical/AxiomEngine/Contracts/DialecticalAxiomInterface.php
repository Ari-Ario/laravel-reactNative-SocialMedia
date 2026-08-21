<?php

namespace App\Services\Dialectical\AxiomEngine\Contracts;

/**
 * Interface DialecticalAxiomInterface
 *
 * Defines the contract for an abstract mathematical or logical axiom within the Dialectical Engine.
 * This structure allows the AST parser to dynamically trace, substitute, and prove problems 
 * based on pure axiomatic principles rather than hardcoded string templates.
 */
interface DialecticalAxiomInterface
{
    /**
     * Unique identifier for the axiom (e.g., 'peano_induction', 'zfc_choice').
     */
    public function getAxiomId(): string;

    /**
     * Full formal name of the axiom (e.g., 'Peano Axiom of Mathematical Induction').
     */
    public function getFormalName(): string;

    /**
     * The overarching formal system this axiom belongs to (e.g., 'Peano Arithmetic', 'ZFC Set Theory').
     */
    public function getSystemFamily(): string;

    /**
     * Parent axioms or systems that this axiom depends upon (for hierarchical graph resolution).
     * Returns an array of Axiom IDs.
     */
    public function getParentDependencies(): array;

    /**
     * Symbolic representation of the axiom (e.g., '∀P. (P(0) ∧ ∀n(P(n) → P(n+1))) → ∀n P(n)').
     */
    public function getSymbolicRepresentation(): string;

    /**
     * Given a specific sub-AST or mathematical expression, check if this axiom is applicable.
     */
    public function isApplicable(array $astContext): bool;

    /**
     * Applies the axiom to a given context, performing structural mapping or dynamic substitution.
     * Returns the dynamically derived structural mapping or new expression state.
     */
    public function applyAxiom(array $astContext): array;
}
